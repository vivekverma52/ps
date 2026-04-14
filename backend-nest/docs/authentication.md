# Authentication & Authorization

## Overview

The system uses **JWT + rotating refresh tokens**. There are two completely separate auth planes:

| Plane | Secret env var | Token type field | Expiry |
|---|---|---|---|
| Regular users | `JWT_SECRET` | `USER` | 15 min |
| Superadmin | `SUPERADMIN_JWT_SECRET` | `SUPERADMIN` | 1 day |

Refresh tokens are signed with `JWT_REFRESH_SECRET`, stored in MySQL (`refresh_tokens` table), and rotated on every use.

---

## Token Payloads

### Access Token (`type: "USER"`)

```json
{
  "type": "USER",
  "userId": "uuid",
  "name": "Dr. Smith",
  "email": "doctor@example.com",
  "role": "DOCTOR",
  "baseRole": "DOCTOR",
  "orgId": "uuid-or-null",
  "isOrgAdmin": true,
  "customRoleId": "uuid-or-null",
  "iat": 1700000000,
  "exp": 1700000900
}
```

`baseRole` is the resolved base role from the user's custom role (e.g. a custom `ADMIN` role has `baseRole: "DOCTOR"`). Guards use `baseRole` for permission checks.

### Refresh Token (`type: "REFRESH"`)

```json
{
  "type": "REFRESH",
  "userId": "uuid",
  "jti": "uuid",
  "iat": 1700000000,
  "exp": 1700604800
}
```

Stored in the `refresh_tokens` table; invalidated on use (rotation).

### Superadmin Token (`type: "SUPERADMIN"`)

```json
{
  "type": "SUPERADMIN",
  "superAdminId": "uuid",
  "name": "Admin",
  "email": "admin@exato.in",
  "iat": 1700000000,
  "exp": 1700086400
}
```

Never accepted by `JwtAuthGuard`. Only accepted by `SuperAdminAuthGuard`.

---

## Auth Flows

### 1. User Registration

```
POST /api/auth/register
```

```
Client ──► register(name, email, password, role, invite_token?)
             │
             ├─ Validate DTO
             ├─ Check duplicate email
             │
             ├─ [with invite_token]
             │    ├─ Validate token (not expired, email matches)
             │    ├─ Mark invitation as accepted
             │    └─ Join invited organization
             │
             ├─ [DOCTOR without invite]
             │    └─ Auto-create organization → set as owner + org_admin
             │
             ├─ bcrypt hash password (10 rounds)
             ├─ Insert user
             ├─ Issue access token (15m) + refresh token (7d)
             └─ Store refresh token in DB
```

**Response:** `{ token, user }` + `Set-Cookie: refreshToken` (httpOnly)

### 2. User Login

```
POST /api/auth/login
```

```
Client ──► login(email, password)
             │
             ├─ Find user by email (case-insensitive)
             ├─ bcrypt.compare(password, hash)
             ├─ Resolve customRoleId → baseRole
             ├─ Delete old refresh token (rotation)
             ├─ Issue new access token + refresh token
             └─ Store refresh token in DB
```

**Response:** `{ token, user }` + `Set-Cookie: refreshToken` (httpOnly)

### 3. Token Refresh

```
POST /api/auth/refresh
```

No `Authorization` header needed — reads the `refreshToken` cookie.

```
Client ──► refresh()  [cookie: refreshToken=<jwt>]
             │
             ├─ Verify JWT with JWT_REFRESH_SECRET
             ├─ Assert payload.type === 'REFRESH'
             ├─ Look up token in refresh_tokens table
             ├─ Assert not expired / revoked
             ├─ Delete old refresh token (rotation)
             ├─ Issue new access token + refresh token
             └─ Store new refresh token in DB
```

**Response:** `{ token }` + updated `Set-Cookie: refreshToken`

### 4. Logout

```
POST /api/auth/logout
```

Reads the `refreshToken` cookie, deletes the record from `refresh_tokens`, and clears the cookie.

### 5. Superadmin Login

```
POST /api/auth/superadmin/login
```

Same bcrypt flow as user login, but uses the `superadmins` table and signs with `SUPERADMIN_JWT_SECRET`. No refresh token — the 1-day access token is returned directly (not in a cookie).

### 6. Invite-Based Registration

```
POST /api/organizations/me/invite   →  creates invitation record (7-day token)
GET  /api/auth/check-invite?token   →  validate before showing registration form
POST /api/auth/register             →  register with invite_token param
```

The invite validates:
- Token exists and is not expired
- `accepted_at` is null (not already used)
- Email in request body matches the invited email

---

## Making Authenticated Requests

Include the access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The refresh token is managed automatically via the httpOnly `refreshToken` cookie.

---

## Role Hierarchy

```
System roles:  DOCTOR  |  PHARMACIST
Custom roles per org (stored in `roles` table):
  - have a base_role: DOCTOR | PHARMACIST | VIEWER | ADMIN
  - ADMIN base role → DOCTOR permissions
  - VIEWER base role → PHARMACIST permissions
```

Guards resolve permissions against `baseRole` (from the custom role's mapping), not the raw `role` field. This means a user with a custom "Head Pharmacist" role that has `base_role: DOCTOR` will pass `@Roles('DOCTOR')` checks.

---

## Guard Summary

| Guard | Applied to | Checks |
|---|---|---|
| `JwtAuthGuard` | Most routes | Valid JWT, `type === 'USER'` |
| `RolesGuard` | Role-restricted routes | `effectiveRole` ∈ `@Roles(...)` |
| `OrgAdminGuard` | Org mutation routes | `isOrgAdmin` or `is_owner` |
| `SuperAdminAuthGuard` | `/api/superadmin/*` | Valid JWT, `type === 'SUPERADMIN'`, different secret |

Public routes (no guards): `POST /auth/register`, `POST /auth/login`, `POST /auth/superadmin/login`, `GET /auth/check-invite`, `POST /auth/refresh`, `POST /auth/logout`, `GET /prescriptions/public/:token`, `GET /health`.
