# Architecture

## Module Graph

```
AppModule
├── ConfigModule (global)
├── MongooseModule (global, MongoDB)
├── ThrottlerModule (global, rate limiting)
├── DatabaseModule (MySQL pool + schema init)
├── S3Module (global, AWS S3)
│
├── AuthModule
│   └── JwtModule, PassportModule, JwtStrategy
│
├── PrescriptionsModule
├── MedicinesModule
├── MedicinePrescriptionsModule  ← uses MongoDB
├── OrganizationsModule
├── RolesModule
└── SuperadminModule
```

---

## Middleware Stack (bootstrap order)

| Order | Middleware | Purpose |
|---|---|---|
| 1 | `helmet` | Secure HTTP headers |
| 2 | CORS | Allow requests from `FRONTEND_URL` with credentials |
| 3 | `cookie-parser` | Parse `refreshToken` httpOnly cookie |
| 4 | mongo-sanitize wrapper | Strip `$` keys from body/params/query to prevent NoSQL injection |
| 5 | `RequestIdInterceptor` | Attach `X-Request-Id` to every response |
| 6 | `AllExceptionsFilter` | Normalize all thrown errors to JSON |
| 7 | `ValidationPipe` | Run class-validator on DTOs; auto-transform primitive types |

---

## Guards

### JwtAuthGuard

`src/common/guards/jwt-auth.guard.ts`

Extends Passport's `AuthGuard('jwt')`. After the JWT signature is verified by `JwtStrategy`, the guard additionally rejects tokens with `type !== 'USER'` (blocks refresh tokens and superadmin tokens from reaching regular routes).

Returns **401** on any failure.

### RolesGuard

`src/common/guards/roles.guard.ts`

Must be used **after** `JwtAuthGuard`. Reads the `@Roles(...roles)` decorator metadata and compares against `req.user.baseRole ?? req.user.role`. The `baseRole` field is derived from the user's custom role mapping, so a custom `ADMIN` role maps to the `DOCTOR` base permission set.

Returns **403** when the user's effective role is not in the allowed list.

### OrgAdminGuard

`src/common/guards/org-admin.guard.ts`

Allows access only when `req.user.isOrgAdmin === true` or `is_owner === true`. Used for all organization mutation endpoints and role management.

Returns **403** otherwise.

### SuperAdminAuthGuard

`src/common/guards/superadmin-auth.guard.ts`

Manually verifies the `Authorization: Bearer` token using `SUPERADMIN_JWT_SECRET` and checks `payload.type === 'SUPERADMIN'`. Not part of the Passport flow — completely separate from user JWTs.

Returns **401** on missing/invalid token, **403** on wrong type.

---

## Decorators

### @CurrentUser(field?)

```ts
// Full payload
@CurrentUser() user: JwtPayload

// Single field
@CurrentUser('userId') userId: string
```

Extracts the validated JWT payload (or a specific field) from `req.user`.

### @Roles(...roles)

```ts
@Roles('DOCTOR', 'PHARMACIST')
```

Sets metadata consumed by `RolesGuard`. Accepts any combination of `DOCTOR | PHARMACIST | VIEWER | ADMIN`.

---

## Error Handling

### AppError

`src/common/errors/app.error.ts`

Operational errors should be thrown using the static factory methods:

```ts
throw AppError.notFound('Prescription');       // 404 NOT_FOUND
throw AppError.conflict('Email already used'); // 409 CONFLICT
throw AppError.forbidden('Org admins only');   // 403 FORBIDDEN
throw AppError.unauthorized('Token expired');  // 401 UNAUTHORIZED
throw AppError.badRequest('Invalid input');    // 400 BAD_REQUEST
throw AppError.validation('Name too short');   // 400 VALIDATION_ERROR
```

### AllExceptionsFilter

`src/common/filters/http-exception.filter.ts`

Catches every unhandled exception and maps it to a structured JSON response:

| Thrown | Status | errorCode |
|---|---|---|
| `AppError` (isOperational) | `error.statusCode` | `error.errorCode` |
| NestJS `HttpException` | `exception.getStatus()` | — |
| Mongoose `ValidationError` | 400 | `VALIDATION_ERROR` |
| Mongoose `CastError` | 400 | `INVALID_ID` |
| MySQL `ER_DUP_ENTRY` | 409 | `DUPLICATE_ENTRY` |
| `JsonWebTokenError` | 401 | `INVALID_TOKEN` |
| Multer `LIMIT_FILE_SIZE` | 413 | `FILE_TOO_LARGE` |
| Multer invalid type | 415 | `INVALID_FILE_TYPE` |
| Unknown | 500 | `INTERNAL_SERVER_ERROR` |

---

## S3 Service

`src/common/s3/s3.service.ts`

Wraps `@aws-sdk/client-s3`. Upload constraints:

| Property | Value |
|---|---|
| Max file size | 10 MB |
| Accepted MIME types | `image/*`, `application/pdf` |
| Key pattern | `prescriptions/prescription-{timestamp}{ext}` |
| URL format | `https://{bucket}.s3.{region}.amazonaws.com/{key}` |

The returned URL is stored directly on the prescription/medicine record. No signed URLs — objects are public-read.

---

## Multi-Tenancy Model

Every resource is scoped to an `org_id`:

- A `DOCTOR` who registers without an invite automatically becomes the owner of a new organization.
- A `PHARMACIST` can only join via invitation.
- Resources (prescriptions, medicines, roles) are always filtered by the requester's `orgId` from the JWT payload.
- The superadmin plane (`/api/superadmin/*`) has cross-tenant read/write access.

---

## Subscription Limits

Enforced in `PrescriptionsService` and `OrganizationsService`:

| Plan | Prescriptions / month | Team members |
|---|---|---|
| `FREE` | 10 | 2 |
| `PRO` | 200 | 10 |
| `ENTERPRISE` | Unlimited (99 999) | Unlimited (99 999) |

Upgrading the plan via `PUT /api/organizations/me/plan` immediately updates the org's stored limits.

---

## Request Tracing

Every request gets a `X-Request-Id` response header. The value is taken from the incoming `x-request-id` header if present, otherwise a UUID is generated. Use this for correlating logs.
