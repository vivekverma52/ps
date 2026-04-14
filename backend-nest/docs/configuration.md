# Configuration

All configuration is loaded via `@nestjs/config` from the `.env` file in `backend-nest/`.

---

## Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP port the server listens on |
| `NODE_ENV` | `development` | `development` or `production` |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin; also used to build invite URLs |

---

## MySQL

| Variable | Example | Description |
|---|---|---|
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | — | MySQL password |
| `DB_NAME` | `prescription_db` | Database name (created automatically if it doesn't exist) |

The schema (all tables) is auto-initialized by `DatabaseModule` on startup. No migration tool is used — DDL statements run with `IF NOT EXISTS`.

---

## MongoDB

| Variable | Example | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/medicines` | Full MongoDB connection URI |

Used exclusively by `MedicinePrescriptionsModule` for the medicine reference database.

---

## JWT

| Variable | Description | Expiry |
|---|---|---|
| `JWT_SECRET` | Secret for user access tokens | — |
| `JWT_EXPIRES_IN` | Access token lifetime (e.g. `15m`) | Default `15m` |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | — |
| `JWT_REFRESH_EXPIRES` | Refresh token lifetime (e.g. `7d`) | Default `7d` |

Use long, random hex strings for secrets in production (≥ 64 chars). Example:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Superadmin

| Variable | Description |
|---|---|
| `SUPERADMIN_JWT_SECRET` | Secret used to sign/verify superadmin tokens (separate from user JWT) |
| `SUPERADMIN_EMAIL` | Email seeded into `superadmins` table on first boot |
| `SUPERADMIN_PASSWORD` | Password seeded on first boot (bcrypt-hashed before storage) |

The superadmin account is created once. Re-running the app will not overwrite an existing record.

---

## AWS S3

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `AWS_REGION` | AWS region, e.g. `ap-south-1` |
| `AWS_S3_BUCKET` | Bucket name; objects are stored with public-read ACL |

The IAM user needs `s3:PutObject` on the bucket. Files are stored under the `prescriptions/` prefix.

---

## Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_TTL` | `900` | Window size in seconds (900 s = 15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window globally |
| `RATE_LIMIT_AUTH_MAX` | `10` | Max requests per window for auth endpoints |

---

## Example `.env`

```dotenv
# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=prescription_db

# MongoDB
MONGODB_URI=mongodb://localhost:27017/medicines

# JWT
JWT_SECRET=change_me_64_char_hex
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change_me_64_char_hex_refresh
JWT_REFRESH_EXPIRES=7d

# Superadmin
SUPERADMIN_JWT_SECRET=change_me_64_char_hex_superadmin
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=StrongPassword123!

# AWS S3
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name

# Rate limiting
RATE_LIMIT_TTL=900
RATE_LIMIT_MAX=100
RATE_LIMIT_AUTH_MAX=10
```
