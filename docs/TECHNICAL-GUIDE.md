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
| `TRIGGER_PROJECT_ID`, `TRIGGER_SECRET_KEY` | Required to run Trigger.dev background workers for Refinement processing. Use the DEV secret key locally and environment-specific keys in deployment. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Server-only credentials and model for structured Refinement analysis. |
| `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_DIMENSIONS` | Server-only credentials and settings for source-section embeddings. |

Never commit real values for these variables.

## pgvector

The Refinement foundation uses PostgreSQL's `vector` extension for future
source-section embeddings. The extension is enabled by migration
`20260803000000_enable_pgvector`; no embedding column is added until the source
catalog models are introduced.

Local Docker uses `pgvector/pgvector:pg16`. Start or recreate the local stack
after pulling this change; the named `postgres_data` volume remains intact:

```bash
docker compose up -d --build
docker compose exec app node scripts/verify-pgvector.js
```

For staging, apply repository migrations through the approved deployment
workflow, then run the same verification command with the staging
`DATABASE_URL`:

```bash
npm run db:migrate:deploy
npm run db:vector:verify
```

The verification uses a temporary table, inserts three 3-dimensional vectors,
and confirms that an exact vector is returned first by the `<->` similarity
operator. It does not retain test records.

## AI provider foundation

Refinement uses two server-side provider adapters:

- Anthropic returns parsed output constrained by a caller-supplied JSON Schema.
- OpenAI returns float embeddings in the same order as the submitted text.

No browser, static hub script, client DTO, or database record receives an API
key. Provider output is not an official finding or SOP change; later Refinement
work must retain human approval and audit controls.

Check the configured environment without making an AI request:

```bash
npm run env:check
```

Run a live provider smoke test only after both AI keys are configured. This
makes one Anthropic structured-output request and one OpenAI embedding request,
which may incur provider charges:

```bash
npm run ai:smoke
```

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

Run Trigger.dev workers locally:

```bash
npm run trigger:dev
```

The initial tasks are `refinement-smoke` and `refinement-pdf-smoke`. Trigger.dev
requires a configured project id and environment secret key before the local
worker can connect to the cloud project. If the CLI reports `Project not found`,
login with the Trigger.dev account/profile that has access to the configured
project, then update both `TRIGGER_PROJECT_ID` and `trigger.config.ts` to the
exact project ref from the Trigger.dev dashboard.

The application can be deployed to Vercel with a PostgreSQL provider such as
Neon. Configure production environment variables in the deployment platform,
apply committed Prisma migrations to the production database, and configure a
production-accessible storage provider. Docker Compose and local MinIO are not
available to Vercel deployments.

Push/deployment automation is controlled by the connected Git repository and
deployment platform configuration.
