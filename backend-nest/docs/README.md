# Prescription System — NestJS Backend

A multi-tenant prescription management API built with NestJS, MySQL, and MongoDB. It supports role-based access control, subscription limits, AWS S3 file uploads, and a separate superadmin plane.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](./architecture.md)
- [Authentication & Authorization](./authentication.md)
- [API Reference](./api-reference.md)
- [Database Schemas](./database.md)
- [Configuration](./configuration.md)

---

## Quick Start

### Prerequisites

| Dependency | Version |
|---|---|
| Node.js | ≥ 18 |
| MySQL | 8.x |
| MongoDB | 6.x |

### Installation

```bash
cd backend-nest
npm install
```

### Environment

Copy `.env` and fill in your values (see [Configuration](./configuration.md)):

```bash
cp .env.example .env
```

### Database seed

The MySQL schema is **auto-initialized** on first boot. The superadmin account is seeded from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` env vars. To seed the MongoDB medicine database manually:

```bash
npm run seed
```

### Run

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build && npm run start
```

The server starts on port `5000` by default (`PORT` env var). A health check is available at `GET /api/health`.

---

## Project Layout

```
src/
├── main.ts                      # Bootstrap: middleware, pipes, filters
├── app.module.ts                # Root module
├── auth/                        # JWT auth, register, login, refresh
├── prescriptions/               # Prescription CRUD + file upload
├── medicines/                   # Medicine CRUD per prescription
├── medicine-prescriptions/      # MongoDB medicine reference database
├── organizations/               # Multi-tenant org management
├── roles/                       # Custom RBAC per org
├── superadmin/                  # Platform admin plane
├── database/                    # MySQL pool + schema init
└── common/
    ├── guards/                  # JwtAuthGuard, RolesGuard, OrgAdminGuard, SuperAdminAuthGuard
    ├── decorators/              # @CurrentUser(), @Roles()
    ├── filters/                 # AllExceptionsFilter
    ├── interceptors/            # RequestIdInterceptor
    ├── errors/                  # AppError factory
    └── s3/                      # AWS S3 upload service
```

---

## Response Envelope

All endpoints return a consistent JSON shape.

**Success**

```json
{
  "success": true,
  "message": "Optional human-readable message",
  "data": { ... }
}
```

**Error**

```json
{
  "message": "Human-readable description",
  "errorCode": "SNAKE_CASE_CODE",
  "statusCode": 400
}
```

Subscription-limit errors include extra fields:

```json
{
  "message": "Prescription limit reached",
  "errorCode": "PRESCRIPTION_LIMIT_REACHED",
  "current": 10,
  "limit": 10,
  "plan": "FREE"
}
```

---

## Rate Limiting

Global throttle via `@nestjs/throttler`:

| Window | Limit |
|---|---|
| 15 minutes | 100 requests |

Auth endpoints have a tighter limit (`RATE_LIMIT_AUTH_MAX`, default 10 per window).
