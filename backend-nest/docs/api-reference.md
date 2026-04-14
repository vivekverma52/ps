# API Reference

Base URL: `http://localhost:5000/api`

Authentication: `Authorization: Bearer <access_token>` (except public routes).

---

## Auth

### POST /auth/register

Register a new user. DOCTOR registrations auto-create an organization. PHARMACIST registrations require an `invite_token`.

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | Yes | Min 2 characters |
| `email` | string | Yes | Must be unique |
| `password` | string | Yes | Min 6 characters |
| `role` | `DOCTOR` \| `PHARMACIST` | No | Default: `DOCTOR` |
| `clinic_name` | string | No | |
| `invite_token` | string | No | Required for PHARMACIST |

**Response 201**

```json
{
  "success": true,
  "data": {
    "token": "<access_jwt>",
    "user": { "id": "uuid", "name": "...", "email": "...", "role": "DOCTOR", "orgId": "uuid" }
  }
}
```

Sets `refreshToken` httpOnly cookie (7 days).

---

### POST /auth/login

**Body**

| Field | Type | Required |
|---|---|---|
| `email` | string | Yes |
| `password` | string | Yes |

**Response 200** — same shape as register.

---

### POST /auth/superadmin/login

**Body** — same fields as login.

**Response 200**

```json
{
  "success": true,
  "data": {
    "token": "<superadmin_jwt>",
    "superAdmin": { "id": "uuid", "name": "...", "email": "..." }
  }
}
```

No cookie is set. The token is returned in the body.

---

### GET /auth/me

Auth: `JwtAuthGuard`

Returns the full profile of the authenticated user including org info and custom role.

---

### GET /auth/check-invite?token=`<token>`

Validate an invite token before showing the registration form.

**Response 200**

```json
{
  "success": true,
  "data": {
    "email": "invited@example.com",
    "role": "PHARMACIST",
    "orgName": "Sunrise Clinic"
  }
}
```

---

### POST /auth/refresh

Reads the `refreshToken` httpOnly cookie. No body required.

**Response 200**

```json
{ "success": true, "data": { "token": "<new_access_jwt>" } }
```

Sets a new `refreshToken` cookie.

---

### POST /auth/logout

Reads the `refreshToken` cookie, deletes the stored token, clears the cookie.

**Response 200** `{ "success": true }`

---

## Prescriptions

### POST /prescriptions

Auth: `JwtAuthGuard` + `@Roles('DOCTOR')`

Multipart form upload.

| Field | Type | Required | Notes |
|---|---|---|---|
| `patient_name` | string | Yes | |
| `patient_phone` | string | Yes | |
| `language` | string | No | Default: `English` |
| `notes` | string | No | |
| `image` | file | No | Max 10 MB, image or PDF |

Enforces the monthly prescription limit for the org's plan. Returns `429`-like `AppError.conflict` with `current`, `limit`, `plan` fields when exceeded.

---

### GET /prescriptions

Auth: `JwtAuthGuard`

Query params: `page`, `limit`, `status`, `search` (patient name/phone).

Filtering by role:
- `DOCTOR` — sees only their own prescriptions.
- `PHARMACIST` — sees all prescriptions in their org.

---

### GET /prescriptions/public/:token

No auth. Accesses a prescription by its `access_token` field (a random 8-byte hex string attached at creation).

---

### GET /prescriptions/:id

Auth: `JwtAuthGuard`

---

### PUT /prescriptions/:id/render

Auth: `JwtAuthGuard` + `@Roles('DOCTOR')`

**Body**

| Field | Type | Notes |
|---|---|---|
| `video_url` | string | Optional URL |

Sets `status` to `RENDERED`.

---

### PUT /prescriptions/:id/status

Auth: `JwtAuthGuard` + `@Roles('DOCTOR')`

**Body**

| Field | Type | Notes |
|---|---|---|
| `status` | `UPLOADED` \| `RENDERED` \| `SENT` | |

---

### DELETE /prescriptions/:id

Auth: `JwtAuthGuard` + `@Roles('DOCTOR')`

---

## Medicines

### GET /medicines/search?q=`<query>`

Auth: `JwtAuthGuard`

Full-text search across 60+ pre-loaded common medicine names. Returns a list of matching names.

---

### POST /medicines

Auth: `JwtAuthGuard` + `@Roles('DOCTOR')`

Multipart form upload.

| Field | Type | Required | Notes |
|---|---|---|---|
| `prescription_id` | string (UUID) | Yes | Must belong to requesting doctor |
| `name` | string | Yes | |
| `quantity` | string | No | Default: `1` |
| `frequency` | string | Yes | e.g. `1-0-1` |
| `course` | string | Yes | e.g. `5 days` |
| `description` | string | No | |
| `image` | file | No | Max 10 MB |

---

### PUT /medicines/:id

Auth: `JwtAuthGuard` + `@Roles('DOCTOR')`

Same multipart fields as POST (all optional).

---

### DELETE /medicines/:id

Auth: `JwtAuthGuard` + `@Roles('DOCTOR')`

---

## Medicine Prescriptions (MongoDB)

A reference database of medicines separate from prescriptions. Accessible to all authenticated users.

### POST /medicine-prescriptions

Auth: `JwtAuthGuard`

**Body**

| Field | Type | Required |
|---|---|---|
| `medicine_name` | string | Yes |
| `generic_name` | string | No |
| `dosage_description` | string | Yes |
| `common_usage` | string | Yes |
| `drug_category` | string | Yes |
| `alternative_medicines` | string[] | No |

---

### GET /medicine-prescriptions

Auth: `JwtAuthGuard`

Query params:

| Param | Type | Notes |
|---|---|---|
| `page` | number | Default: 1 |
| `limit` | number | Default: 10, max: 100 |
| `search` | string | Searches `medicine_name` and `generic_name` |
| `drug_category` | string | Filter by category |

---

### GET /medicine-prescriptions/:id

Auth: `JwtAuthGuard`

---

### PUT /medicine-prescriptions/:id

Auth: `JwtAuthGuard`

Same fields as POST (all optional).

---

### POST /medicine-prescriptions/:id/image

Auth: `JwtAuthGuard`

Multipart: `image` field (file). Uploads to S3 and sets `medicine_image`.

---

### DELETE /medicine-prescriptions/:id

Auth: `JwtAuthGuard`

---

## Organizations

### GET /organizations/me

Auth: `JwtAuthGuard`

Returns org details plus live usage counters (prescriptions this month, team size).

---

### PUT /organizations/me

Auth: `JwtAuthGuard` + `OrgAdminGuard`

**Body**

| Field | Type | Required |
|---|---|---|
| `name` | string | Yes |
| `address` | string | No |
| `phone` | string | No |
| `website` | string | No |

---

### GET /organizations/me/team

Auth: `JwtAuthGuard`

Returns `{ members: [...], invites: [...] }` for the org.

---

### POST /organizations/me/invite

Auth: `JwtAuthGuard` + `OrgAdminGuard`

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | Yes | Must not already be a member |
| `role` | `DOCTOR` \| `PHARMACIST` | No | Default: `DOCTOR` |
| `custom_role_id` | string (UUID) | No | Assign a custom role on join |

Enforces the team limit. Returns a 7-day invite token (to be included in a registration link).

---

### DELETE /organizations/me/members/:memberId

Auth: `JwtAuthGuard` + `OrgAdminGuard`

Cannot remove the org owner.

---

### DELETE /organizations/me/invites/:inviteId

Auth: `JwtAuthGuard` + `OrgAdminGuard`

Cancels a pending (not yet accepted) invitation.

---

### PUT /organizations/me/plan

Auth: `JwtAuthGuard` + `OrgAdminGuard`

**Body**

| Field | Type | Required |
|---|---|---|
| `plan` | `FREE` \| `PRO` \| `ENTERPRISE` | Yes |

Immediately updates `prescription_limit` and `team_limit` on the org.

---

## Roles

Custom roles are scoped per organization.

### GET /roles

Auth: `JwtAuthGuard`

Returns all custom roles for the requester's org.

---

### POST /roles

Auth: `JwtAuthGuard` + `OrgAdminGuard`

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | Yes | Unique within the org |
| `display_name` | string | Yes | |
| `base_role` | `DOCTOR` \| `PHARMACIST` \| `VIEWER` \| `ADMIN` | No | Default: `DOCTOR` |
| `permissions` | object | No | Arbitrary JSON |
| `color` | string | No | Hex color, default `#1D9E75` |
| `is_default` | boolean | No | |

---

### PUT /roles/:id

Auth: `JwtAuthGuard` + `OrgAdminGuard`

All fields optional.

---

### DELETE /roles/:id

Auth: `JwtAuthGuard` + `OrgAdminGuard`

Clears `custom_role_id` on all users who held this role.

---

### POST /roles/assign

Auth: `JwtAuthGuard` + `OrgAdminGuard`

**Body**

| Field | Type | Required |
|---|---|---|
| `user_id` | string (UUID) | Yes |
| `role_id` | string (UUID) | Yes |

---

## Superadmin

All endpoints require `Authorization: Bearer <superadmin_jwt>`.

### GET /superadmin/dashboard

Returns platform-wide counts: organizations, users, prescriptions this month.

---

### GET /superadmin/organizations

Query params: `page`, `limit`, `search` (name/slug).

---

### POST /superadmin/organizations

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | Yes | |
| `slug` | string | No | Auto-generated from name if omitted |
| `plan` | `FREE` \| `PRO` \| `ENTERPRISE` | No | Default: `FREE` |
| `prescription_limit` | number | No | |
| `team_limit` | number | No | |
| `owner_id` | string (UUID) | No | |
| `address` | string | No | |
| `phone` | string | No | |
| `website` | string | No | |
| `status` | `ACTIVE` \| `SUSPENDED` | No | Default: `ACTIVE` |

Seeds default roles for the new org.

---

### GET /superadmin/organizations/:id

Returns org details with member list.

---

### PUT /superadmin/organizations/:id

Same body shape as POST, all fields optional.

---

### DELETE /superadmin/organizations/:id

Deletes the org and all related data (cascade).

---

### GET /superadmin/users

Query params: `page`, `limit`, `search` (name/email), `org_id`.

---

## Health

### GET /health

No auth.

```json
{ "status": "ok", "time": "2026-01-01T00:00:00.000Z", "env": "development" }
```
