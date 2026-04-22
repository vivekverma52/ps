# Backend Architecture

NestJS · TypeScript · MongoDB + MySQL · AWS S3 + SQS · WhatsApp Cloud API

---

## Table of Contents

1. [Module Structure](#1-module-structure)
2. [Request Lifecycle](#2-request-lifecycle)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Database Layer](#4-database-layer)
5. [Error Handling](#5-error-handling)
6. [File Uploads & S3](#6-file-uploads--s3)
7. [SQS — Async Messaging](#7-sqs--async-messaging)
8. [Retry & Resilience](#8-retry--resilience)
9. [Validation & DTOs](#9-validation--dtos)
10. [Rate Limiting](#10-rate-limiting)
11. [Logging & Tracing](#11-logging--tracing)
12. [Metrics](#12-metrics)
13. [WhatsApp Integration](#13-whatsapp-integration)
14. [Security Hardening](#14-security-hardening)
15. [Prescription Domain — Full Data Flow](#15-prescription-domain--full-data-flow)
16. [Environment Variables](#16-environment-variables)

---

## 1. Module Structure

```
src/
├── app.module.ts               ← Root module; wires everything together
├── main.ts                     ← Bootstrap, global middleware, pipes, filters
│
├── modules/                    ← Bounded contexts (business domains)
│   ├── auth/                   ← Login, register, JWT, refresh tokens
│   ├── prescription/           ← Core medical flow (upload → OCR → render → WhatsApp)
│   ├── organization/           ← Org management, members, plans
│   ├── hospital/               ← Hospital staff, profiles
│   └── platform/               ← Superadmin — plans, orgs, metrics
│
├── common/                     ← Cross-cutting infrastructure (@Global)
│   ├── s3/                     ← AWS S3 client (upload, presigned URLs, delete)
│   ├── sqs/                    ← AWS SQS producer + long-poll consumer
│   ├── whatsapp/               ← Meta Cloud API notifications
│   ├── mail/                   ← Nodemailer SMTP
│   ├── logger/                 ← Structured JSON logging + AsyncLocalStorage
│   ├── metrics/                ← Prometheus counters and histograms
│   ├── filters/                ← AllExceptionsFilter (global error handler)
│   ├── guards/                 ← JwtAuthGuard, RolesGuard, OrgAdminGuard
│   ├── interceptors/           ← Logging, response envelope, refresh token cookie
│   ├── decorators/             ← @CurrentUser(), @Roles(), @HttpMessage()
│   ├── errors/                 ← AppError class + MySQL error mapping
│   └── types/                  ← Shared interfaces (JwtPayload, etc.)
│
└── database/
    ├── database.module.ts      ← Raw mysql2 pool (MYSQL_POOL token)
    ├── data-source.ts          ← TypeORM AppDataSource (migrations CLI)
    ├── entities/               ← TypeORM entity classes (12 tables)
    └── migrations/             ← SQL migrations (auto-run on startup)
```

**Key pattern:** Infrastructure modules are decorated `@Global()` and imported once in `AppModule`. Bounded-context modules import only what they need.

---

## 2. Request Lifecycle

Every HTTP request passes through layers in this order:

```
HTTP Request
    │
    ▼
[ThrottlerGuard]           ← Rate limit: 100 req / 15 min / IP (global APP_GUARD)
    │
    ▼
[LoggingInterceptor]       ← Assign requestId, open AsyncLocalStorage traceId context
    │                         Log "Incoming request" (method, path, userId, orgId)
    ▼
[JwtAuthGuard]             ← Validate Bearer token via Passport JWT strategy
    │                         Live user-status check on every request
    ▼
[RolesGuard]               ← Check @Roles() metadata against user.baseRole
    │
    ▼
[ValidationPipe]           ← class-validator on all DTO params
    │                         whitelist=true, forbidNonWhitelisted=true, transform=true
    ▼
[Controller handler]       ← Thin: delegates immediately to Service
    │
    ▼
[ResponseInterceptor]      ← Wrap return value in { success: true, data: ... }
    │
    ▼
HTTP Response
    │
    ▼  (on any throw)
[AllExceptionsFilter]      ← Catch everything, map to { success: false, message, errorCode }
                              Increment error metrics, emit ALERT on 5xx
```

**Files:** `main.ts`, `src/common/interceptors/logging.interceptor.ts`, `src/common/filters/http-exception.filter.ts`

---

## 3. Authentication & Authorization

### JWT Access Token

- **Library:** `passport-jwt` + `@nestjs/passport`
- **Extraction:** `Authorization: Bearer <token>` header only (no query-param fallback)
- **TTL:** 15 minutes (configurable via `JWT_EXPIRES_IN`)
- **Validation in `JwtStrategy.validate()`:**
  1. Rejects tokens with `type === 'REFRESH'` or `type === 'SUPERADMIN'`
  2. Calls `authRepository.findUserById()` — live check ensures suspended accounts are blocked immediately even within token TTL

```typescript
// src/modules/auth/strategies/jwt.strategy.ts
async validate(payload: any) {
  if (!payload || payload.type === 'REFRESH') throw new UnauthorizedException();
  const user = await this.authRepository.findUserById(payload.userId);
  if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();
  return payload;
}
```

### JWT Payload Shape (`src/common/types/jwt-payload.interface.ts`)

```typescript
interface JwtPayload {
  userId: string;
  name: string;
  email: string;
  role: string;         // DOCTOR | PHARMACIST | ORG_ADMIN | HOSPITAL_ADMIN
  baseRole: string;     // effective role (handles custom roles)
  orgId: string | null;
  hospitalId: string | null;
  isOrgAdmin: boolean;
  customRoleId: string | null;
}
```

### Refresh Token

- **TTL:** 7 days
- **Storage:** SHA-256 hash in MySQL `refresh_tokens` table (raw token never touches the DB)
- **Transport:** `httpOnly; Secure; SameSite=Strict` cookie at path `/api/auth`
  - Set/cleared by `RefreshTokenInterceptor` — strips `refreshToken` from JSON body, moves it to cookie
- **Rotation:** Each refresh issues a new pair; old token is deleted

### Superadmin Isolation

- Separate `SUPERADMIN_JWT_SECRET` — completely independent from user tokens
- `SuperAdminAuthGuard` manually verifies the token (does not use Passport)
- `JwtAuthGuard` explicitly rejects any token with `type === 'SUPERADMIN'` on user endpoints

### Guards

| Guard | File | What it checks |
|---|---|---|
| `JwtAuthGuard` | `guards/jwt-auth.guard.ts` | Valid JWT; rejects SUPERADMIN tokens |
| `RolesGuard` | `guards/roles.guard.ts` | `user.baseRole` in `@Roles(...)` list |
| `OrgAdminGuard` | `guards/org-admin.guard.ts` | `user.isOrgAdmin` or ORG_ADMIN / HOSPITAL_ADMIN role |
| `SuperAdminAuthGuard` | `guards/superadmin-auth.guard.ts` | Manual verification against SUPERADMIN_JWT_SECRET |

### Decorators

```typescript
@CurrentUser()          // injects req.user (full JwtPayload) or req.user[field]
@Roles('DOCTOR', 'PHARMACIST')   // sets metadata read by RolesGuard
```

---

## 4. Database Layer

The backend deliberately uses **two databases** for different reasons:

### MySQL — Relational Data (TypeORM + raw pool)

Used for: users, organizations, hospitals, plans, roles, refresh tokens.

```
TypeORM (via TypeOrmModule.forRootAsync)
  ├── synchronize: false          ← Never auto-sync; migrations are source of truth
  ├── migrationsRun: true         ← Auto-run pending migrations on startup
  └── entities: 12 entity classes (src/database/entities/)

Raw mysql2 Pool (via DatabaseModule, token MYSQL_POOL)
  ├── poolSize: 50 connections
  ├── queueLimit: 100             ← Rejects beyond; no unbounded queue growth
  └── Used for: custom queries that bypass TypeORM overhead (e.g. org limit checks)
```

**Typed queries** (no `any` on rows):
```typescript
// src/modules/prescription/prescription.service.ts
interface OrgRow extends RowDataPacket { id: string; plan: string; prescription_limit: number; }
const [orgRows] = await this.pool.execute<OrgRow[]>('SELECT ...', [orgId]);
```

### MongoDB — Document Store (Mongoose)

Used for: prescriptions and medicine library — fields that vary by OCR output and language.

```
MongooseModule.forRootAsync   ← Connection with lifecycle event logging
Schemas: src/modules/prescription/schemas/
  ├── prescription.schema.ts        ← Prescription collection
  └── medicine-prescription.schema.ts ← Medicine library collection
```

**Typed lean queries** (`lean<T>()` overrides inferred type):
```typescript
const doc = await this.prescriptionModel.findOne({ id }).lean<Prescription>();
```

### Why Two Databases

| Data | DB | Reason |
|---|---|---|
| Users, orgs, plans, roles | MySQL | Relational integrity, FK constraints, ACID transactions |
| Prescriptions, medicines | MongoDB | Schema flexibility (OCR output shape varies), nested documents, no JOIN needed |

---

## 5. Error Handling

### `AppError` (`src/common/errors/app.error.ts`)

All business logic throws `AppError` — never raw `Error` or HTTP exceptions directly.

```typescript
// Factory methods
AppError.badRequest('message')         // 400
AppError.unauthorized()                // 401
AppError.forbidden()                   // 403
AppError.notFound('Resource')          // 404
AppError.conflict('message')           // 409
AppError.validation('message')         // 400 VALIDATION_ERROR
AppError.tooManyRequests()             // 429

// Optional metadata fields (for limit-exceeded errors)
err.current = count;
err.limit   = org.prescription_limit;
err.plan    = org.plan;
```

### `AllExceptionsFilter` (`src/common/filters/http-exception.filter.ts`)

Registered globally in `main.ts` via `app.useGlobalFilters(...)`. Catches **everything**:

| Exception type | HTTP Status | Notes |
|---|---|---|
| `AppError` (isOperational) | AppError.statusCode | Includes current/limit/plan fields if set |
| `HttpException` (NestJS) | exception.getStatus() | Validation pipe errors (400) land here |
| Mongoose ValidationError | 422 | Field-level messages joined |
| Mongoose CastError | 400 | Bad ObjectId format |
| MongoDB duplicate key (11000) | 409 | CONFLICT |
| MySQL errors | Mapped via `mapMySqlError()` | 30+ codes: ER_DUP_ENTRY→409, ECONNREFUSED→503, etc. |
| Multer `LIMIT_FILE_SIZE` | 400 | FILE_TOO_LARGE |
| JWT errors | 401 | UNAUTHORIZED |
| Unknown | 500 | INTERNAL_ERROR; ALERT log emitted |

**Response envelope (all errors):**
```json
{ "success": false, "message": "...", "errorCode": "NOT_FOUND" }
```

**5xx alerting:** Filter logs `ALERT: 5xx error detected` — scrape this in your log aggregator to trigger PagerDuty / Slack.

---

## 6. File Uploads & S3

### Multer Configuration

Defined as a module-level constant in `prescription.controller.ts` — shared between both controllers to avoid duplication:

```typescript
const imageFileInterceptor = FileInterceptor('image', {
  storage: memoryStorage(),             // Buffer held in Node.js heap (no temp files)
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard limit
  fileFilter: (_req, file, cb) => {
    const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    cb(allowed ? null : new Error('Only images and PDFs are allowed'), allowed);
  },
});
```

### Upload Concurrency Guard (`prescription.service.ts`)

Prevents the Node.js heap from being overwhelmed by simultaneous large uploads:

```
MAX_CONCURRENT_UPLOADS = 20   (~200 MB peak on a 512 MB ECS task)

acquireUploadSlot()  → throws 429 if at limit
releaseUploadSlot()  → called in finally block (always releases)
```

### S3Service (`src/common/s3/s3.service.ts`)

| Method | Purpose |
|---|---|
| `uploadToS3(buffer, name, mime)` | Upload; key = `prescriptions/{uuid}{ext}` |
| `getObjectUrl(key)` | Public HTTPS URL (permanent) |
| `getPresignedDownloadUrl(key, filename, 300s)` | Force-download link, 5-minute TTL |
| `getPresignedViewUrl(key, 72h)` | Inline viewing link for WhatsApp share |
| `deleteObject(key)` | S3 rollback when DB write fails after upload |

**S3 Rollback pattern** (in `uploadAndCreatePrescription`):
```
S3 upload  ──→ withRetry (3 attempts)
                    ↓ success
DB create  ──→ withRetry (3 attempts)
                    ↓ ALL retries fail
             deleteObject(imageKey)   ← prevents S3 orphan
                    ↓
             re-throw DB error to client
```

---

## 7. SQS — Async Messaging

### Queues in Use

| Queue | Direction | Purpose |
|---|---|---|
| `SQS_UPLOAD_QUEUE_URL` | Send | Trigger OCR lambda with new prescription image |
| `SQS_RESULT_QUEUE_URL` | Receive | OCR lambda returns extracted medicine/patient data |
| `SQS_VIDEO_RESULT_QUEUE_URL` | Receive | Video render service returns S3 video key |
| `SQS_RENDER_QUEUE_URL` | Send | Trigger video render service with prescription data |

### `SqsService` (`src/common/sqs/sqs.service.ts`)

**Producer:**
```typescript
sqsService.sendMessage(queueUrl, body)
// Serializes body to JSON, sends via SQSClient
// Caller wraps in withRetry() for transient failures
```

**Consumer (long-poll loop):**
```
startPolling(queueUrl, handler)
  ├── WaitTimeSeconds: 20s    ← Long polling (no empty receives)
  ├── MaxNumberOfMessages: 10
  └── Per message:
       ├── Parse JSON body
       ├── Call handler(body)
       ├── On success: delete message (safeDelete)
       └── On failure:
            ├── attempt < 3: extend visibility 60s, sleep, retry
            └── attempt >= 3: log ERROR, leave in queue → DLQ picks it up
```

**DLQ Validation:** `validateDlqConfigured()` warns at startup if no DLQ is attached (messages would loop forever past 3 failures).

### Non-Fatal SQS Sends

SQS `sendMessage` calls for OCR and render are **non-fatal** — they cannot fail the HTTP response because the DB record is already committed at that point:

```typescript
try {
  await this.withRetry(() => sqsService.sendMessage(queueUrl, payload), 'SQS OCR enqueue');
} catch (sqsErr) {
  // Prescription is saved. Log for monitoring; do not throw.
  // Prescription stays in UPLOADED status — re-queue via sweep job.
  this.logger.error(`[UPLOAD] SQS OCR enqueue failed — prescriptionId=${id}: ${sqsErr.message}`);
}
```

**Why:** If SQS was fatal, a client would get a 500 even though the prescription exists in DB. They'd retry the upload, creating a duplicate.

---

## 8. Retry & Resilience

### `withRetry<T>()` (private method on `PrescriptionService`)

```typescript
private async withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T>
```

**Backoff:** 300ms · 600ms · 900ms (linear, not exponential — keeps total wait under 2s)

### Selective Retry (`isRetryable()`)

Not all errors should be retried. The method fails fast for deterministic errors:

```typescript
private isRetryable(err: unknown): boolean {
  if (err instanceof AppError) return false;  // Business logic errors — won't fix on retry

  const httpStatus = err.$metadata?.httpStatusCode;
  if (httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429) return false;  // AWS 4xx (not throttle)

  return true;  // Network errors, timeouts, AWS 5xx, 429 throttle → retry
}
```

| Error type | Retry? | Reason |
|---|---|---|
| `AppError` (400/403/404) | No | Business logic is deterministic |
| AWS 4xx (403, 400) | No | Bad credentials / wrong config — won't self-heal |
| AWS 429 (throttle) | Yes | Back off and retry |
| AWS 5xx | Yes | Service unavailable — transient |
| Network (ETIMEDOUT, ECONNREFUSED) | Yes | Transient |

### What Uses `withRetry`

| Operation | Reason |
|---|---|
| S3 upload | Network-bound; S3 transiently unavailable |
| DB create (MongoDB) | Connection pool exhausted; replica failover |
| SQS OCR enqueue | SQS transiently unavailable |
| SQS render enqueue | Same |
| S3 medicine image upload | Same as prescription upload |

---

## 9. Validation & DTOs

### Global ValidationPipe (`main.ts`)

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // Strip fields not in DTO
  forbidNonWhitelisted: true,   // 400 if unknown fields are sent
  transform: true,              // Auto-coerce query string numbers/booleans
}));
```

### DTO Pattern

Every request body and query string is a typed DTO class:

```typescript
// src/modules/prescription/dto/create-prescription.dto.ts
export class CreatePrescriptionDto {
  @IsOptional() @IsString() patient_name?: string;
  @IsOptional() @IsString() patient_phone?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() notes?: string;
}
```

Query DTOs use `@IsNumberString()` (query params arrive as strings):
```typescript
// src/modules/prescription/dto/list-prescriptions-query.dto.ts
export class ListPrescriptionsQueryDto {
  @IsOptional() @IsNumberString()                page?: string;
  @IsOptional() @IsNumberString()                limit?: string;
  @IsOptional() @IsString() @MaxLength(200)      search?: string;
  @IsOptional() @IsIn(VALID_STATUSES)            status?: string;
}
```

### Mongoose Filter Typing

Instead of `let filter: any`, Mongoose's `FilterQuery<T>` is used:

```typescript
let filter: FilterQuery<PrescriptionDocument> = {};
if (role === 'DOCTOR') filter = { doctor_id: userId };
// ...
```

---

## 10. Rate Limiting

**Library:** `@nestjs/throttler`

**Global configuration** (`app.module.ts`):
```
Default: 100 requests per 15 minutes per IP
Configurable via: RATE_LIMIT_TTL (seconds) and RATE_LIMIT_MAX
```

**Global guard** (registered as `APP_GUARD` in `AppModule.providers`):
```typescript
{ provide: APP_GUARD, useClass: ThrottlerGuard }
```

**Per-handler override:**
```typescript
@Throttle({ default: { limit: 5, ttl: 60000 } })  // 5 req/min (login brute-force)
@SkipThrottle()                                      // Health check, metrics
```

---

## 11. Logging & Tracing

### `AppLogger` (`src/common/logger/app-logger.service.ts`)

Structured JSON to stdout/stderr. Every log entry shape:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level":     "info",
  "context":   "PrescriptionService",
  "message":   "[UPLOAD] S3 upload complete — key=prescriptions/abc.jpg",
  "traceId":   "req-uuid",
  "userId":    "user-123",
  "orgId":     "org-456"
}
```

### AsyncLocalStorage Trace Propagation

`requestContextStorage` (`src/common/context/request-context.ts`) is an `AsyncLocalStorage<{ traceId, userId, orgId }>`. The `LoggingInterceptor` sets it at request start:

```
HTTP request enters
    ↓
LoggingInterceptor.intercept()
    └── requestContextStorage.run({ traceId: requestId, userId, orgId }, () => next.handle())
             ↓
        All async code in that request's chain automatically has traceId in context
        AppLogger reads it and appends to every log entry
```

**Result:** Every log line from DB queries to SQS sends within a single request shares the same `traceId` — trivial to grep all logs for one request.

---

## 12. Metrics

**Library:** `prom-client`

### Metrics Registered (`src/common/metrics/metrics.service.ts`)

| Metric | Type | Labels | What it measures |
|---|---|---|---|
| `http_requests_total` | Counter | method, route, status_code | Request throughput |
| `http_duration_seconds` | Histogram | method, route, status_code | Latency distribution |
| `errors_total` | Counter | type | Errors by category (db, app_error, mongodb, unhandled) |

Default Node.js metrics (heap, GC, event loop lag) are also collected automatically.

**Route normalization** prevents cardinality explosion:
```typescript
// /api/prescriptions/550e8400-e29b-41d4-a716-446655440000  →  /api/prescriptions/:id
normaliseRoute('/api/prescriptions/550e8400-...')  // replaces UUIDs and ObjectIds with :id
```

### Prometheus Endpoint

```
GET /api/metrics  →  Prometheus text format
```

Protect this endpoint at the load-balancer/VPC level — it is not authenticated.

**Integration with error filter:** `AllExceptionsFilter` calls `metrics.errorsTotal.inc({ type })` on every error.

---

## 13. WhatsApp Integration

**Service:** `src/common/whatsapp/whatsapp.service.ts`  
**API:** Meta Graph API v19.0 with a pre-approved message template

### Trigger

After a prescription video is processed by the render service and the S3 key is received via SQS, the service:

1. Generates a 72-hour presigned S3 view URL
2. Normalizes the patient phone number to E.164 (`91XXXXXXXXXX` for India)
3. POSTs to Meta Cloud API with template variables:
   - `{{1}}` = patient name
   - `{{2}}` = video share URL

### Non-Fatal Design

```typescript
try {
  const waResult = await this.whatsAppService.sendVideoReady(phone, name, videoShareUrl);
  if (!waResult.success) this.logger.warn(`WhatsApp failed: ${waResult.error}`);
} catch (err) {
  this.logger.error(`WhatsApp dispatch error: ${err.message}`);
  // Video is saved; WhatsApp is best-effort. Never throws.
}
```

The video is already in S3 and the DB is updated regardless of WhatsApp success.

**Phone numbers skipped:** Placeholder `0000000000` (used for "Quick Upload" prescriptions before OCR fills in the real number).

---

## 14. Security Hardening

All security middleware is applied in `main.ts` before any route handling.

| Mechanism | How | File |
|---|---|---|
| **Helmet** | `app.use(helmet())` — sets X-Content-Type-Options, X-Frame-Options, HSTS, etc. | `main.ts` |
| **CORS** | `app.enableCors({ origin: FRONTEND_URL, credentials: true })` | `main.ts` |
| **Body size limits** | JSON 1 MB, form 1 MB, multipart 10 MB | `main.ts` |
| **NoSQL injection** | `express-mongo-sanitize` strips `$` and `.` operators from all inputs | `main.ts` |
| **Input validation** | `ValidationPipe` with whitelist + forbidNonWhitelisted | `main.ts` |
| **Rate limiting** | ThrottlerGuard (100 req/15 min default) | `app.module.ts` |
| **Password hashing** | bcrypt 10 rounds | `auth.service.ts` |
| **Token storage** | Refresh token stored as SHA-256 hash; raw token never in DB | `auth.service.ts` |
| **Cookie security** | `httpOnly; Secure; SameSite=Strict` | `refresh-token.interceptor.ts` |
| **Prepared statements** | TypeORM + mysql2 parameterized queries everywhere | All services |
| **CSPRNG tokens** | `crypto.randomBytes(32)` for access_token (prescription sharing) | `prescription.service.ts` |
| **Superadmin isolation** | Separate JWT secret; guard explicitly rejects on user routes | `jwt.strategy.ts`, `superadmin-auth.guard.ts` |
| **ETag disabled** | `app.set('etag', false)` — prevents 304 leaking response cache info | `main.ts` |

---

## 15. Prescription Domain — Full Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  1. UPLOAD                                                       │
│                                                                  │
│  POST /api/prescriptions  (DOCTOR only)                          │
│  ├─ FileInterceptor: validate MIME + size (10 MB)               │
│  ├─ assertSubscriptionLimit() — check monthly org quota (MySQL)  │
│  ├─ acquireUploadSlot() — semaphore (max 20 concurrent)          │
│  ├─ S3Service.uploadToS3() → imageKey                           │
│  │   └─ withRetry (3×)                                           │
│  ├─ prescriptionModel.create() → MongoDB doc  [status=UPLOADED]  │
│  │   └─ withRetry (3×); on all-fail: deleteObject(imageKey)     │
│  ├─ sqsService.sendMessage(SQS_UPLOAD_QUEUE_URL, { imageKey })   │
│  │   └─ withRetry (3×); failure is NON-FATAL (prescription saved)│
│  └─ releaseUploadSlot()                                          │
└──────────────────────────────────────────────────────────────────┘
                              ↓ async (SQS)
┌──────────────────────────────────────────────────────────────────┐
│  2. OCR  (external lambda → SQS_RESULT_QUEUE_URL)                │
│                                                                  │
│  handleResultMessage() (SQS consumer, runs in background)        │
│  ├─ Verify status === 'success'                                  │
│  ├─ Lookup prescription by image_key (fallback: patient_uid)     │
│  ├─ Back-fill patient_name/patient_phone if still placeholders   │
│  └─ $set interpreted_data:                                       │
│       { medicines: [], ocr_source: true,                         │
│         interpreted_data: { medicines, doctor_details,           │
│         patient_details, hospital_details, raw_text_preview } }  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  3. REVIEW & EDIT                                                │
│                                                                  │
│  GET  /api/prescriptions/:id          ← View with image_url      │
│  PUT  /api/prescriptions/:id/interpreted-data  ← Edit OCR data   │
│  POST /api/prescriptions/:id/medicines          ← Add medicine   │
│    └─ Atomic $concatArrays pipeline (no read-modify-write race)  │
│  PUT  /api/prescriptions/:id/medicines/:medId   ← Update med     │
│    └─ Atomic $[elem] positional update + arrayFilters            │
│  DELETE /api/prescriptions/:id/medicines/:medId ← Remove med     │
│    └─ Atomic $pull                                               │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  4. RENDER TRIGGER                                               │
│                                                                  │
│  PUT /api/prescriptions/:id/render  (DOCTOR or PHARMACIST)       │
│  ├─ Update DB: video_key, status = RENDERED                      │
│  ├─ Build RenderPayload (patient + doctor + merged medicines)     │
│  │   Merges: OCR medicines + manual pharmacist-added medicines   │
│  └─ sqsService.sendMessage(SQS_RENDER_QUEUE_URL, payload)        │
│      └─ withRetry (3×); failure is NON-FATAL (DB already updated)│
└──────────────────────────────────────────────────────────────────┘
                              ↓ async (SQS)
┌──────────────────────────────────────────────────────────────────┐
│  5. VIDEO RESULT  (render service → SQS_VIDEO_RESULT_QUEUE_URL)  │
│                                                                  │
│  handleVideoResultMessage() (SQS consumer)                       │
│  ├─ Resolve prescription ID (tries: request_id, id, prescriptionId)│
│  ├─ Resolve video URL (tries: s3_url, video_url, videoUrl, url)  │
│  ├─ Extract S3 key from full URL (strips presigned params)       │
│  ├─ Update MongoDB: video_key, status = RENDERED                 │
│  └─ WhatsApp notification (non-fatal):                           │
│       ├─ S3Service.getPresignedViewUrl(videoKey, 72h)            │
│       └─ WhatsAppService.sendVideoReady(phone, name, shareUrl)   │
└──────────────────────────────────────────────────────────────────┘
```

### Access Control Matrix

| Action | DOCTOR | PHARMACIST | ORG_ADMIN | HOSPITAL_ADMIN |
|---|---|---|---|---|
| Create prescription | Own only | ✗ | ✗ | ✗ |
| View prescription | Own only | Hospital/org scope | Org scope | Org scope |
| Delete prescription | Own only | ✗ | ✗ | ✗ |
| Add/edit/delete medicines | ✗ | Hospital/org scope | ✗ | ✗ |
| Trigger render | Own only | Hospital/org scope | ✗ | ✗ |
| Download video | Own only | Hospital/org scope | ✗ | ✗ |
| Update status | Own only | SENT only | ✗ | ✗ |
| Manage medicine library | ✗ | ✗ | Yes | Yes |

**PHARMACIST hospital scoping:** A pharmacist JWT carrying a `hospitalId` can only see prescriptions with the same `hospital_id`. They can never access another hospital's prescriptions even within the same org.

### Prescription Status Lifecycle

```
UPLOADED → CLAIMED → PROCESSING → RENDERED → SENT
```

Doctors and pharmacists can transition status. Pharmacists are restricted to `SENT` only (enforced in `updateStatus()`).

### Public Sharing

`GET /api/prescriptions/public/:token` — unauthenticated endpoint. Each prescription has a `access_token` (256-bit random hex, `crypto.randomBytes(32)`). Returns only: `doctor_name`, `patient_name`, `language`, `image_url`, `video_url`, `interpreted_data`. No org/doctor IDs exposed.

---

## 16. Environment Variables

### Required

```bash
# MySQL
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=

# MongoDB
MONGODB_URI=

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=
SUPERADMIN_JWT_SECRET=

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

# Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

### Optional (with defaults)

```bash
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES=7d

RATE_LIMIT_TTL=900       # seconds (15 minutes)
RATE_LIMIT_MAX=100       # requests per TTL window

# SQS — if unset, respective flow is skipped (warning logged)
SQS_UPLOAD_QUEUE_URL=    # Trigger OCR
SQS_RESULT_QUEUE_URL=    # Receive OCR results
SQS_RENDER_QUEUE_URL=    # Trigger video render
SQS_VIDEO_RESULT_QUEUE_URL=  # Receive video results

# WhatsApp — disabled if unset
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VIDEO_TEMPLATE_NAME=prescription_video_ready
WHATSAPP_VIDEO_TEMPLATE_LANG=en_US
```
