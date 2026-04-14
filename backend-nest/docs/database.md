# Database Schemas

The system uses two databases:

| Database | Engine | Used for |
|---|---|---|
| `prescription_db` | MySQL 8 | All relational data (users, orgs, prescriptions, medicines, roles, tokens) |
| `medicines` | MongoDB | Medicine reference database (`medicine-prescriptions` module) |

---

## MySQL

The schema is auto-initialized by `DatabaseModule` on startup. All primary keys are UUID strings (`VARCHAR(36)`).

### `superadmins`

Platform administrators. Seeded from env vars at boot.

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(36) PK | UUID |
| `name` | VARCHAR(255) | |
| `email` | VARCHAR(255) UNIQUE | |
| `password` | VARCHAR(255) | bcrypt hash |
| `created_at` | TIMESTAMP | Default CURRENT_TIMESTAMP |

---

### `organizations`

Top-level tenant entity. One doctor registration = one org.

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(36) PK | |
| `name` | VARCHAR(255) | |
| `slug` | VARCHAR(100) UNIQUE | URL-safe identifier |
| `plan` | ENUM(`FREE`,`PRO`,`ENTERPRISE`) | Default `FREE` |
| `prescription_limit` | INT | Monthly limit; default 10 |
| `team_limit` | INT | Max members; default 2 |
| `owner_id` | VARCHAR(36) | References `users.id` (not FK — circular) |
| `address` | TEXT | Nullable |
| `phone` | VARCHAR(20) | Nullable |
| `website` | VARCHAR(255) | Nullable |
| `status` | ENUM(`ACTIVE`,`SUSPENDED`) | Default `ACTIVE` |
| `created_at` | TIMESTAMP | |

---

### `users`

Clinic staff. Every user belongs to at most one org.

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(36) PK | |
| `name` | VARCHAR(255) | |
| `email` | VARCHAR(255) UNIQUE | |
| `password` | VARCHAR(255) | bcrypt hash |
| `role` | ENUM(`DOCTOR`,`PHARMACIST`) | Base system role |
| `clinic_name` | VARCHAR(255) | Nullable |
| `org_id` | VARCHAR(36) | FK → `organizations.id`, nullable |
| `is_owner` | TINYINT(1) | Boolean flag |
| `is_org_admin` | TINYINT(1) | Boolean flag |
| `custom_role_id` | VARCHAR(36) | FK → `roles.id`, nullable |
| `created_at` | TIMESTAMP | |

**Indexes:** `org_id`, `email`

---

### `prescriptions`

Core entity. One prescription per patient visit.

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(36) PK | |
| `doctor_id` | VARCHAR(36) | FK → `users.id` |
| `doctor_name` | VARCHAR(255) | Denormalized for display |
| `patient_name` | VARCHAR(255) | |
| `patient_phone` | VARCHAR(20) | |
| `language` | VARCHAR(50) | Default `English` |
| `image_url` | TEXT | S3 URL, nullable |
| `video_url` | TEXT | S3 URL, nullable |
| `access_token` | VARCHAR(50) UNIQUE | Public share token (8-byte hex) |
| `status` | ENUM(`UPLOADED`,`RENDERED`,`SENT`) | Default `UPLOADED` |
| `notes` | TEXT | |
| `org_id` | VARCHAR(36) | FK → `organizations.id`, nullable |
| `created_at` | TIMESTAMP | |

**Indexes:** `doctor_id`, `org_id`, `access_token`

**Status flow:**
```
UPLOADED → RENDERED → SENT
```

---

### `medicines`

Individual medicine line-items on a prescription.

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(36) PK | |
| `prescription_id` | VARCHAR(36) | FK → `prescriptions.id` |
| `name` | VARCHAR(255) | |
| `quantity` | VARCHAR(50) | Default `1` |
| `frequency` | VARCHAR(255) | e.g. `1-0-1` |
| `course` | VARCHAR(100) | e.g. `5 days` |
| `description` | TEXT | Nullable |
| `image_url` | TEXT | S3 URL, nullable |
| `created_at` | TIMESTAMP | |

**Index:** `prescription_id`

---

### `roles`

Custom roles defined per organization.

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(36) PK | |
| `org_id` | VARCHAR(36) | FK → `organizations.id` |
| `name` | VARCHAR(100) | Unique within the org |
| `display_name` | VARCHAR(100) | Human-readable label |
| `base_role` | ENUM(`DOCTOR`,`PHARMACIST`,`VIEWER`,`ADMIN`) | Determines permission set |
| `permissions` | JSON | Arbitrary permissions object |
| `color` | VARCHAR(20) | UI color, default `#1D9E75` |
| `is_default` | TINYINT(1) | Whether new members get this role |
| `created_at` | TIMESTAMP | |

**Index:** `org_id`

**Base role mapping:**

| `base_role` | Effective permissions |
|---|---|
| `DOCTOR` | Full prescription/medicine write access |
| `ADMIN` | Same as DOCTOR |
| `PHARMACIST` | Read-only prescription access |
| `VIEWER` | Same as PHARMACIST |

---

### `invitations`

Pending email invitations to join an organization. Expire after 7 days.

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(36) PK | |
| `org_id` | VARCHAR(36) | FK → `organizations.id` |
| `email` | VARCHAR(255) | Invited address |
| `role` | ENUM(`DOCTOR`,`PHARMACIST`) | Default `DOCTOR` |
| `token` | VARCHAR(64) UNIQUE | Random hex token |
| `invited_by` | VARCHAR(36) | `users.id` of inviter |
| `custom_role_id` | VARCHAR(36) | FK → `roles.id`, nullable |
| `accepted_at` | TIMESTAMP | Null until used |
| `expires_at` | TIMESTAMP | `created_at + 7 days` |
| `created_at` | TIMESTAMP | |

**Indexes:** `org_id`, `token`

---

### `refresh_tokens`

Active refresh tokens. One record per live session; rotated on every `/auth/refresh` call.

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(36) PK | |
| `user_id` | VARCHAR(36) | FK → `users.id` |
| `token` | VARCHAR(512) UNIQUE | Signed JWT string |
| `expires_at` | TIMESTAMP | `now + 7 days` |
| `created_at` | TIMESTAMP | |

**Indexes:** `token` (UNIQUE), `user_id`

---

## MongoDB

### Collection: `medicine_prescriptions`

Managed by `MedicinePrescriptionsModule`. A reference catalogue of medicines, separate from the per-patient prescription records in MySQL.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | — | Auto-generated |
| `medicine_name` | String | Yes | Trimmed |
| `generic_name` | String | No | Trimmed |
| `medicine_image` | String | No | S3 URL |
| `dosage_description` | String | Yes | Trimmed |
| `common_usage` | String | Yes | Trimmed |
| `drug_category` | String | Yes | Trimmed |
| `alternative_medicines` | String[] | No | Array of medicine names |
| `createdAt` | Date | — | Auto (timestamps: true) |
| `updatedAt` | Date | — | Auto (timestamps: true) |

**Search:** The list endpoint performs a case-insensitive regex search across `medicine_name` and `generic_name` when the `search` query param is provided.
