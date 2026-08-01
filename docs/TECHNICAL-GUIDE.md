# Technical Guide

## Requirements

- Node.js 22
- Docker Desktop for the recommended local setup
- PostgreSQL for database storage
- MinIO or another configured storage provider for document files

## Environment

Copy `.env.example` to a local environment file and provide values suitable
for the chosen runtime.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `AUTH_SECRET` | Secret used to sign sessions. Use a strong, unique value outside local development. |
| `STORAGE_PROVIDER` | `s3` or `google-drive`. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE` | S3-compatible storage configuration. |
| `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REDIRECT_URI`, `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` | Required only for Google Drive storage. The encryption key must be base64-encoded 32 random bytes. |

Never commit real values for these variables.

## Docker local setup

```bash
docker compose up --build
```

Services:

| Service | Address |
| --- | --- |
| Application | `http://localhost:3000` |
| PostgreSQL | `localhost:5432` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |

The Docker application container runs Prisma schema synchronization and the
local seed before starting the development server. Its PostgreSQL and MinIO
data use named Docker volumes.

## Database commands

```bash
npx prisma generate
npx prisma validate
npx prisma db push
npm run db:seed
```

For a migration-managed deployment, commit the migration with the application
and apply it deliberately:

```bash
npm run db:migrate:deploy
npm run db:migrate:status
```

Do not use `prisma db push` or reset commands against a production database.

## Google Drive setup

1. Create Google OAuth web credentials and configure the authorized callback
   URI as `/api/integrations/google-drive/callback` on the application's
   public origin.
2. Configure the four Google Drive environment variables.
3. Set `STORAGE_PROVIDER=google-drive`.
4. Sign in as an administrator and use the Google Drive connection action.
5. Complete OAuth consent. The application creates and stores its private Drive
   folder connection.

The Drive OAuth scope is `drive.file`. Refresh tokens are encrypted with
AES-256-GCM before they are stored.

## Build, test, and deployment

Build the application:

```bash
npm run build
```

Focused and regression tests use Node's built-in test runner:

```bash
node --test test/*.test.mjs
```

The application can be deployed to Vercel with a PostgreSQL provider such as
Neon. Configure production environment variables in the deployment platform,
apply committed Prisma migrations to the production database, and configure a
production-accessible storage provider. Docker Compose and local MinIO are not
available to Vercel deployments.

Push/deployment automation is controlled by the connected Git repository and
deployment platform configuration.
