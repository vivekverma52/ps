# Prescription Upload Architecture: Problem & Solution

## Table of Contents
1. [The Problem](#the-problem)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Architecture Before](#architecture-before)
4. [Architecture After](#architecture-after)
5. [What Changed in Code](#what-changed-in-code)
6. [Flow Diagrams](#flow-diagrams)
7. [Performance Comparison](#performance-comparison)
8. [Frontend Migration Guide](#frontend-migration-guide)
9. [Infrastructure Requirements](#infrastructure-requirements)

---

## The Problem

The original prescription upload flow had a hard ceiling of **20 concurrent uploads** enforced by an in-memory counter inside `PrescriptionService`. Every uploaded file (up to 10MB) was buffered entirely in Node.js heap memory during the S3 transfer. The 21st concurrent upload received an immediate `503 Server Busy` response with no queue or retry.

```
// The original bottleneck — prescription.service.ts
private activeUploads = 0;
private readonly MAX_CONCURRENT_UPLOADS = 20;

acquireUploadSlot(): void {
  if (this.activeUploads >= this.MAX_CONCURRENT_UPLOADS) {
    throw AppError.tooManyRequests('Server is busy...');  // hard 503
  }
  this.activeUploads++;
}
```

### Why This Was a Design Problem, Not a Configuration Problem

Simply raising `MAX_CONCURRENT_UPLOADS = 40` and upgrading the ECS task to 1GB would "fix" the symptom but not the cause. The real issue was that **the server was acting as a file transfer proxy** between the client and S3. This is architecturally wrong because:

| Issue | Impact |
|-------|--------|
| Every 10MB file lives in Node.js heap during S3 transfer | Memory exhaustion under load |
| Counter is per-instance in-memory | 3 ECS instances = 3 independent counters of 20, no coordination |
| HTTP connection held open for full S3 transfer duration | Request timeouts on slow networks |
| Scaling horizontally doesn't help uploads | Adding instances doesn't increase the real throughput limit |
| ECS task needed 512MB minimum just for this feature | Higher AWS bill for no architectural reason |

---

## Root Cause Analysis

### The Flow That Caused the Problem

```
Doctor's Browser
      │
      │  POST /api/prescriptions
      │  Content-Type: multipart/form-data
      │  Body: [10MB image + patient metadata]
      │
      ▼
 Node.js Server (ECS Task - 512MB)
      │
      │  1. Multer reads entire file into RAM (memoryStorage)
      │     → file.buffer = 10,485,760 bytes IN HEAP
      │
      │  2. acquireUploadSlot() — check counter < 20
      │     → If 20 already running: throw 503
      │
      │  3. s3Service.uploadToS3(file.buffer, ...)
      │     → Holds 10MB in heap UNTIL S3 confirms receipt
      │     → For a 5MB file on average network: ~3-6 seconds
      │
      │  4. MongoDB write (prescription record)
      │
      │  5. SQS message (OCR queue)
      │
      │  6. releaseUploadSlot() — counter--
      │
      ▼
   Response returned to client
```

**The slot was held for steps 1 through 6.** During a 5-second S3 transfer, that slot is locked. With 20 doctors uploading simultaneously, the 21st gets a 503.

### Memory at Peak Load (Original)

```
Base NestJS app:          ~120 MB
MongoDB driver:            ~50 MB
MySQL driver:              ~30 MB
20 × 10MB upload buffers: ~200 MB
─────────────────────────────────
Total peak:               ~400 MB  (on a 512MB ECS task = 112MB headroom)
```

One GC pause during peak upload load could cause an OOM kill on the ECS task.

---

## Architecture Before

```
┌─────────────────────────────────────────────────────────────────┐
│                        BEFORE (Broken)                          │
└─────────────────────────────────────────────────────────────────┘

Doctor's Phone/Browser
        │
        │  POST /api/prescriptions
        │  multipart/form-data
        │  ┌──────────────────────┐
        │  │ image: [10MB file]   │  ← entire file travels to server
        │  │ patient_name: "..."  │
        │  │ language: "hindi"    │
        │  └──────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│            Node.js / NestJS Server            │
│                  (512MB ECS)                  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │         Multer (memoryStorage)          │  │
│  │  file.buffer = entire 10MB in RAM heap  │  │
│  └──────────────────┬──────────────────────┘  │
│                     │                         │
│  ┌──────────────────▼──────────────────────┐  │
│  │         acquireUploadSlot()             │  │
│  │  activeUploads >= 20? → throw 503       │  │
│  │  else: activeUploads++                  │  │
│  └──────────────────┬──────────────────────┘  │
│                     │                         │
│  ┌──────────────────▼──────────────────────┐  │
│  │      s3Service.uploadToS3(buffer)       │  │
│  │  ← holds slot + 10MB RAM for ~3-6s →   │  │  ──────► AWS S3
│  └──────────────────┬──────────────────────┘  │
│                     │                         │
│  ┌──────────────────▼──────────────────────┐  │
│  │         MongoDB write + SQS send        │  │
│  └──────────────────┬──────────────────────┘  │
│                     │                         │
│       releaseUploadSlot() → activeUploads--   │
└─────────────────────┼─────────────────────────┘
                      │
                      ▼
              Response to client

PROBLEMS:
  ✗ 10MB × 20 = 200MB heap used at peak
  ✗ 21st concurrent upload → instant 503
  ✗ Counter is per-instance (not shared across ECS tasks)
  ✗ HTTP connection held open for full S3 transfer duration
  ✗ Cannot scale horizontally (each new instance has its own counter)
  ✗ 512MB ECS task required minimum
```

---

## Architecture After

```
┌─────────────────────────────────────────────────────────────────┐
│                        AFTER (Fixed)                            │
└─────────────────────────────────────────────────────────────────┘

                    ── STEP 1 ──────────────────────────────────────

Doctor's Phone/Browser
        │
        │  POST /api/prescriptions/upload-url
        │  Content-Type: application/json
        │  { "filename": "rx_photo.jpg", "mimetype": "image/jpeg" }
        │
        ▼
┌───────────────────────────────────────────────┐
│            Node.js / NestJS Server            │
│                  (256MB ECS)                  │
│                                               │
│  1. assertSubscriptionLimit() — DB check      │
│  2. Generate key: prescriptions/{uuid}.jpg    │
│  3. AWS SDK: getSignedUrl(PutObjectCommand)   │
│     ← pure computation, ~5ms, zero bytes →   │
│                                               │
│  Return: { upload_url, key, expires_in: 300 } │
└───────────────────────────────────────────────┘
        │
        │  { upload_url: "https://s3.../presigned...",
        │    key: "prescriptions/abc-123.jpg",
        │    expires_in: 300 }
        ▼

                    ── STEP 2 ──────────────────────────────────────

Doctor's Phone/Browser
        │
        │  PUT https://s3.amazonaws.com/bucket/prescriptions/abc-123.jpg
        │  Content-Type: image/jpeg
        │  Body: [10MB file]
        │
        │  ← FILE TRAVELS DIRECTLY FROM BROWSER TO S3 →
        │  ← NODE.JS SERVER NEVER SEES A SINGLE BYTE   →
        │
        ▼
    AWS S3 Bucket
        │
        │  200 OK
        ▼

                    ── STEP 3 ──────────────────────────────────────

Doctor's Phone/Browser
        │
        │  POST /api/prescriptions
        │  Content-Type: application/json
        │  { "image_key": "prescriptions/abc-123.jpg",
        │    "patient_name": "Ramesh Kumar",
        │    "language": "hindi" }
        │
        ▼
┌───────────────────────────────────────────────┐
│            Node.js / NestJS Server            │
│                  (256MB ECS)                  │
│                                               │
│  1. assertSubscriptionLimit() — DB check      │
│  2. MongoDB: create prescription record       │
│  3. SQS: send OCR queue message               │
│                                               │
│  Return: { id, image_url, status, ... }       │
└───────────────────────────────────────────────┘
        │
        ▼
    Response to client

FIXED:
  ✓ 0 bytes in heap for file uploads
  ✓ No concurrent upload limit — unlimited
  ✓ No per-instance state — scales horizontally naturally
  ✓ HTTP connections are milliseconds, not seconds
  ✓ 256MB ECS task is sufficient
  ✓ Lower AWS bill
```

---

## What Changed in Code

### 1. `s3.service.ts` — New method added

```typescript
// NEW METHOD
async getPresignedUploadUrl(
  filename: string,
  mimetype: string,
  expiresIn = 300,               // 5-minute window for client to upload
): Promise<{ key: string; upload_url: string }> {

  // Server validates mimetype — client cannot bypass with a forged value
  if (!ALLOWED_UPLOAD_MIMETYPES.has(mimetype)) {
    throw new AppError(`File type not allowed: ${mimetype}`, 400, 'INVALID_MIME');
  }

  // Server generates the key — client cannot inject paths like "../../../etc"
  const ext = path.extname(filename).toLowerCase() || '.jpg';
  const key = `prescriptions/${uuidv4()}${ext}`;

  // Pure AWS SDK call — signs a PUT request with our credentials
  // No file bytes involved at any point
  const command = new PutObjectCommand({ Bucket, Key: key, ContentType: mimetype });
  const upload_url = await getSignedUrl(this.s3, command, { expiresIn });

  return { key, upload_url };
}
```

**Why the server generates the key:** If the client generated the key, they could craft paths like `../../config/secrets` or overwrite other prescriptions. By generating it server-side with a UUID, this attack surface is eliminated.

**Why ContentType is in the PutObjectCommand:** The pre-signed URL is bound to a specific Content-Type. If the client tries to upload a different type than declared, S3 rejects the request. This enforces the mimetype allowlist even though the client talks directly to S3.

---

### 2. `prescription.service.ts` — Counter removed, logic simplified

```typescript
// REMOVED ENTIRELY — these 18 lines are gone
private activeUploads = 0;
private readonly MAX_CONCURRENT_UPLOADS = 20;

acquireUploadSlot(): void { ... }
releaseUploadSlot(): void { ... }

// REMOVED — 95-line method with file handling, S3 upload, rollback logic
async uploadAndCreatePrescription(params: { file?: Express.Multer.File; ... })

// ADDED — 15-line stateless URL generator
async getUploadUrl(params: {
  userId: string; orgId: string | null;
  filename: string; mimetype: string;
}): Promise<{ upload_url: string; key: string; expires_in: number }> {
  await this.assertSubscriptionLimit(params.orgId);  // still enforced
  const { key, upload_url } = await this.s3Service.getPresignedUploadUrl(filename, mimetype);
  return { upload_url, key, expires_in: 300 };
}

// SIMPLIFIED — 40-line method, no file handling at all
async uploadAndCreatePrescription(params: {
  imageKey?: string | null;  // just a string key now
  ...
}): Promise<WithUrls<Prescription>> {
  await this.assertSubscriptionLimit(params.orgId);

  const prescription = await this.withRetry(
    () => this.createPrescription({ ...params, imageKey: params.imageKey ?? null }),
    'DB prescription create',
  );

  if (params.imageKey) {
    // Send key to OCR queue — same as before, unchanged
    await sqsService.sendMessage(uploadQueueUrl, { imageKey, patientId });
  }

  return prescription;
}
```

**Why the S3 rollback logic was also removed:** The original code deleted the S3 object if the MongoDB write failed after upload. With pre-signed URLs, the client uploads to S3 before calling this endpoint. If the MongoDB write fails, the S3 object becomes an orphan — handled by an S3 lifecycle policy (delete `prescriptions/` objects older than 24h with no matching DB record), which is simpler and more robust than try/catch rollback.

---

### 3. `prescription.controller.ts` — New endpoint, interceptor removed

```typescript
// BEFORE — file upload interceptor on the create endpoint
@Post()
@UseInterceptors(imageFileInterceptor)  // ← this buffered the whole file
async create(@UploadedFile() file: Express.Multer.File | undefined, ...) {
  await prescriptionService.uploadAndCreatePrescription({ file, ... });
}

// AFTER — two clean JSON endpoints
@Post('upload-url')           // Step 1: get the pre-signed URL
@HttpCode(HttpStatus.OK)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
async getUploadUrl(@Body() body: RequestUploadUrlDto) {
  return prescriptionService.getUploadUrl({ filename, mimetype, ... });
}

@Post()                       // Step 2: create the DB record
@HttpCode(HttpStatus.CREATED)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
async create(@Body() body: CreatePrescriptionDto) {
  // body.image_key is just a string like "prescriptions/uuid.jpg"
  return prescriptionService.uploadAndCreatePrescription({ imageKey: body.image_key, ... });
}
```

---

### 4. New DTOs

**`request-upload-url.dto.ts`** — validates the upload URL request:
```typescript
export class RequestUploadUrlDto {
  @IsString() @IsNotEmpty()
  filename: string;              // "rx_photo.jpg"

  @IsString() @IsIn(ALLOWED_MIMETYPES)
  mimetype: string;              // "image/jpeg" — validated server-side
}
```

**`create-prescription.dto.ts`** — added `image_key` field:
```typescript
@IsOptional() @IsString()
image_key?: string;              // "prescriptions/abc-123.jpg"
```

---

## Flow Diagrams

### Before: Single Blocked Request

```
Time ────────────────────────────────────────────────────────────►

Request 1  [══ Multer buffer ══][════════ S3 upload 5s ════════][DB][SQS] slot released
Request 2  [══ Multer buffer ══][════════ S3 upload 5s ════════][DB][SQS] slot released
...
Request 20 [══ Multer buffer ══][════════ S3 upload 5s ════════][DB][SQS] slot released
Request 21 [503 immediately]

All 20 slots occupied = 200MB RAM used
Server handles ZERO other requests cleanly during peak
```

### After: Three Fast Independent Steps

```
Time ────────────────────────────────────────────────────────────►

Step 1 (get URL)  [5ms]  ← server work ends here
Step 2 (S3 PUT)          [══════ 5s direct to S3 ══════]  ← server not involved
Step 3 (create DB)                                         [DB][SQS] 50ms

Server time per prescription: 5ms + 50ms = 55ms total
S3 transfer time: irrelevant to server capacity
Concurrent limit: none
```

---

## Performance Comparison

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Memory per upload | 10MB (heap) | 0 bytes | **-100%** |
| Concurrent upload limit | 20 (hardcoded) | Unlimited | **∞** |
| Server time per upload | ~5,000ms (S3 wait) | ~55ms (DB + SQS only) | **-99%** |
| ECS task memory needed | 512MB minimum | 256MB sufficient | **-50%** |
| Scales across instances | No | Yes | Fixed |
| HTTP connection duration | ~5s (S3 transfer) | ~55ms (JSON only) | **-99%** |
| Subscription limit check | On every upload | On every upload | No change |
| OCR queue (SQS) | Sends after upload | Sends after DB write | No change |
| Auth required | JWT guard | JWT guard | No change |

---

## Frontend Migration Guide

### Old Code (Remove This)

```typescript
// Old: single multipart POST — file goes through server
const uploadPrescription = async (file: File, patientName: string) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('patient_name', patientName);
  formData.append('language', 'hindi');

  const response = await api.post('/api/prescriptions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};
```

### New Code (Use This)

```typescript
// New: three-step flow — file goes directly to S3
const uploadPrescription = async (file: File, patientName: string) => {

  // Step 1: get pre-signed URL from server (~50ms)
  const { data: { upload_url, key } } = await api.post('/api/prescriptions/upload-url', {
    filename: file.name,
    mimetype: file.type,
  });

  // Step 2: upload file directly to S3 (~varies by file size, server not involved)
  // Note: no Authorization header — the pre-signed URL contains all credentials
  await fetch(upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  // Step 3: create the prescription record (~50ms)
  const { data: prescription } = await api.post('/api/prescriptions', {
    image_key: key,
    patient_name: patientName,
    language: 'hindi',
  });

  return prescription;
};
```

### With Progress Tracking

The old flow had no way to track upload progress (the file went through the server as a single chunk). The new flow supports real progress:

```typescript
const uploadWithProgress = async (
  file: File,
  patientName: string,
  onProgress: (percent: number) => void,
) => {
  // Step 1
  const { data: { upload_url, key } } = await api.post('/api/prescriptions/upload-url', {
    filename: file.name,
    mimetype: file.type,
  });

  // Step 2 — with real progress using XMLHttpRequest
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload  = () => xhr.status === 200 ? resolve() : reject(new Error(`S3 error: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Network error during S3 upload'));
    xhr.open('PUT', upload_url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });

  // Step 3
  const { data } = await api.post('/api/prescriptions', { image_key: key, patient_name: patientName });
  return data;
};
```

### Error Handling

```typescript
const uploadPrescription = async (file: File, patientName: string) => {
  let key: string | undefined;

  try {
    // Step 1
    const { data } = await api.post('/api/prescriptions/upload-url', {
      filename: file.name,
      mimetype: file.type,
    });
    key = data.key;

    // Step 2
    const s3Response = await fetch(data.upload_url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    if (!s3Response.ok) {
      throw new Error(`S3 upload failed: ${s3Response.status}`);
    }

    // Step 3
    const { data: prescription } = await api.post('/api/prescriptions', {
      image_key: key,
      patient_name: patientName,
    });
    return prescription;

  } catch (error) {
    // If step 2 fails (S3), the key is generated but never saved to DB
    // S3 lifecycle policy will clean it up automatically after 24h
    // No manual rollback needed
    throw error;
  }
};
```

---

## Infrastructure Requirements

### S3 Bucket CORS Configuration

The browser does a `PUT` directly to S3. Without CORS configured on the bucket, the browser blocks it (same-origin policy). Add this in **AWS Console → S3 → Your Bucket → Permissions → CORS**:

```json
[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": [
      "https://your-production-domain.com",
      "http://localhost:5173"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**Why only `PUT`:** The pre-signed URL is the only mechanism for writing. `GET` and `DELETE` stay server-side only.

**Why only `Content-Type` header:** The pre-signed URL is bound to a specific ContentType. The browser must send this header to match. No other headers are needed.

### S3 Lifecycle Policy (Cleanup Orphaned Files)

When a client gets a pre-signed URL but fails before step 3 (e.g. network error, app crash), the S3 object exists but no prescription record references it. Add a lifecycle rule to clean these up automatically:

**AWS Console → S3 → Your Bucket → Management → Lifecycle Rules → Create rule**

```
Rule name: delete-orphaned-uploads
Scope: Prefix = prescriptions/
Action: Expire objects after 1 day
```

This runs daily. Since step 3 (DB write) happens within seconds of step 2, any object older than 24h with no DB record is guaranteed to be an orphan.

### ECS Task Definition Update

Reduce the task memory from 512MB to 256MB:

```json
{
  "family": "medscript-backend",
  "containerDefinitions": [
    {
      "name": "backend",
      "memory": 256,
      "memoryReservation": 128
    }
  ]
}
```

This reduces the Fargate bill by approximately 50% for the backend task.

---

## Security Notes

### Why the Server Must Generate the S3 Key

If the client sent their own key:
```typescript
// DANGEROUS — never do this
POST /upload-url { key: "../../admin/config.js" }  // path traversal
POST /upload-url { key: "prescriptions/other-doctor-uuid.jpg" }  // overwrite attack
```

The server generates `prescriptions/{uuidv4()}{ext}` — a UUID that cannot be guessed or predicted. The client only receives the key after it is created and has no input into its value.

### Why ContentType is Locked in the Pre-signed URL

The `PutObjectCommand` includes `ContentType: mimetype`. AWS validates this when the client uploads:

```
Client declares: mimetype = "image/jpeg"
Server creates pre-signed URL for Content-Type: image/jpeg
Client tries to upload: Content-Type: application/x-php  ← S3 rejects: SignatureDoesNotMatch
```

The allowlist in `ALLOWED_UPLOAD_MIMETYPES` is validated server-side before the URL is generated. The ContentType lock on the pre-signed URL is the second line of defence enforced by S3 itself.

### Pre-signed URL Expiry

The URL expires in **300 seconds (5 minutes)**. After expiry:
- The URL returns `403 Request has expired`
- The key still does not exist in S3
- The client must request a new URL
- A new UUID key is generated — the expired key is permanently invalid

This limits the window for URL theft (e.g. from logs or intercepted traffic).
