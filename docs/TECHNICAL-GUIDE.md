# Technical Guide

## Requirements

- Node.js 22
- Docker Desktop for the recommended local setup
- PostgreSQL for database storage
- A connected Google Drive account for document uploads, previews, and downloads

## Environment

Copy `.env.example` to a local environment file and provide values suitable
for the chosen runtime.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `AUTH_SECRET` | Secret used to sign sessions. Use a strong, unique value outside local development. |
| `STORAGE_PROVIDER` | Set to `google-drive`. |
| `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REDIRECT_URI`, `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` | Required for Google Drive storage. The encryption key must be base64-encoded 32 random bytes. |
| `BLOB_READ_WRITE_TOKEN` | Required by Vercel Blob private transit uploads. Configure the same value in Vercel and Trigger.dev; never expose it to a browser. |
| `TRIGGER_PROJECT_ID`, `TRIGGER_SECRET_KEY` | Required to run Trigger.dev background workers for Refinement processing. Use the DEV secret key locally and environment-specific keys in deployment. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Server-only credentials and model for structured Refinement analysis. |
| `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_DIMENSIONS` | Server-only credentials and settings for source-section embeddings. |

Never commit real values for these variables.

## Production performance visibility

The deployed application and Neon database are both in Singapore (`sin1` and
`ap-southeast-1`). Keep this regional alignment when changing deployment
settings. Repository list responses load only the latest SOP version; complete
version history is retrieved when a user opens SOP detail or update actions.

Selected read APIs return a standard `Server-Timing` response header with
non-sensitive `auth`, `db`, `serialize`, and `total` durations. Inspect it in
the browser Network panel or with `curl -I`; it never contains SQL, user data,
or credentials. Set `API_PERFORMANCE_LOGGING=true` only when temporary
structured server timing logs are required. It logs route names and durations
only.

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

## AI runtime for Chatbot and Refinement

Chatbot and Refinement call one internal surface, `lib/ai/ai-service.js`. That
service owns the prompts, output schemas, retry policy, and usage telemetry; a
provider owns transport only. Neither feature imports an Anthropic client, so
changing the runtime is a configuration change rather than an application
rewrite.

```text
Chatbot ─┐
         ├─> AIService ─> provider-factory (AI_PROVIDER) ─> AIProvider
Refinement ┘                                                └── AnthropicApiProvider
```

### Supported provider

| `AI_PROVIDER` | Status |
| --- | --- |
| `anthropic-api` | Supported. Metered Claude Developer Platform access through `ANTHROPIC_API_KEY`. |
| `claude-max-agent` | Reserved identifier with no deployable implementation. Selecting it fails validation with an explanatory error. |

Anthropic's Legal and compliance policy restricts Free, Pro, and Max OAuth
credentials to Claude Code and claude.ai, and does not permit routing
application requests through them on behalf of users. A deployed Procurement
Governance Hub therefore authenticates with an API key. The provider boundary
exists so a second runtime can be added later without touching Chatbot,
Refinement, retrieval, schemas, or the interface.

### Configuration

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | Runtime selection. Defaults to `anthropic-api`. |
| `ANTHROPIC_API_KEY` | Server-only credential. Configure in Vercel and in the Trigger.dev environment. |
| `ANTHROPIC_MODEL` | Defaults to `claude-opus-5`. |
| `AI_CHAT_ENABLED`, `AI_REFINEMENT_ENABLED` | Kill switches. A feature is enabled unless the value is explicitly `false`. |
| `AI_MAX_CONTEXT_TOKENS` | Upper bound applied when building retrieval context. |
| `AI_REQUEST_TIMEOUT_MS` | Provider request timeout. |
| `AI_CHAT_RATE_LIMIT_PER_MINUTE` | Per-user chat request ceiling. |

No browser, static hub script, client DTO, or database record receives a
credential. Provider failures are translated into a fixed code set and a safe
user message; the underlying provider error is logged server-side only.

### Verifying the deployed runtime

`npm run env:check` validates the provider selection without making a request.
For a live check, sign in as Superuser and request:

```bash
curl -s -H "Cookie: session=<session>" https://<deployment>/api/ai/health
```

The route makes one small structured request and returns provider, model,
latency, and flag state. It returns `503` when the provider is unreachable or
unconfigured, and never returns a credential or a raw provider payload.

### Usage and cost accounting

Every call writes an `AiUsage` row with feature, provider, model, prompt
version, latency, token counts, and an estimated cost derived from the rate
table in `lib/ai/telemetry.js`. Update `PRICING_VERSION` there whenever a rate
changes so historical rows stay interpretable. Rate limiting, malformed output,
retries, and scope refusals are recorded as `AiEvent` rows. Telemetry never
blocks a feature: a failed write is logged and swallowed.

## Docker local setup

```bash
docker compose up --build
```

Services:

| Service | Address |
| --- | --- |
| Application | `http://localhost:3000` |
| PostgreSQL | `localhost:5432` |

The Docker application container runs Prisma schema synchronization and the
local seed before starting the development server. Its PostgreSQL data uses a
named Docker volume. Google Drive remains external and is configured with the
environment variables above.

## Database commands

```bash
npx prisma generate
npx prisma validate
npx prisma db push
npm run db:seed
```

The additive People migrations are
`20260803020000_add_people_organization_foundation` and
`20260803020100_add_people_structure_invariants`. They add organization,
position, person, qualification, and assignment tables, then protect the active
structure/root invariants, without changing user, Business Unit, or SOP
records. Apply committed migrations through the normal deployment workflow; do
not use reset commands against shared databases.

`20260804000000_add_people_group_structures_and_experience` extends People
additively with Business Unit or Group structure scope and
`Person.firstWorkStartedAt`. Existing People records remain Business Unit
scoped. It should be applied through the same migration deployment workflow;
do not use `db push` against a shared database.

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

Repository SOP uploads support files up to 25 MB without sending file bytes to
a Vercel Function. The browser receives a short-lived, single-file upload URL
for a **private Vercel Blob** object. After the upload, Trigger.dev streams the
file to Google Drive and deletes the Blob transit object after the SOP draft or
version is committed. Google Drive remains the permanent private store; no
public Google Drive links are created.

### Vercel Blob and Trigger.dev setup

1. In the Vercel project, open **Storage**, create a **Blob** store, and choose
   **Private** access.
2. Attach it to the Production and Preview environments. Vercel creates
   `BLOB_READ_WRITE_TOKEN`; do not copy it into source control.
3. Add the same `BLOB_READ_WRITE_TOKEN` to the corresponding Trigger.dev
   environment, together with `DATABASE_URL`, the Google Drive variables,
   `STORAGE_PROVIDER=google-drive`, and `AUTH_SECRET` where required by shared
   runtime code.
4. Deploy the Trigger.dev worker with `npm run trigger:deploy` after the web
   application deployment. The `sop-blob-transfer` task performs the private
   Blob-to-Drive transfer.
5. Apply the committed Prisma migrations before accepting uploads. The upload
   UI waits for `COMPLETED`; a draft/version does not appear while the transfer
   is pending or failed.

For local work, create a Blob store in the linked Vercel project, add the token
to `.env`, start `npm run trigger:dev` in one terminal, then start the Docker
application as usual. Do not use a public Blob store for SOP uploads.

The connected root folder is `Procurement Governance Hub`. The locked document
organization is:

```text
SOP/<Business Unit name>/
Sumber Pembanding/<Penerbit atau Regulator>/<Nomor regulasi>/
```

For example, SOP documents for SMI will be stored in `SOP/SMI/`, while
revisions of a POJK will be stored under
`Sumber Pembanding/OJK/<Nomor regulasi>/`. Internal
sources may add their own category below `Sumber Pembanding/Internal/`, such as
`Best Practice` or `Hasil Audit`.

The application stores the Drive file ID, not its path. Therefore existing
application-owned files can be moved into this convention without changing
their database references. Bulk organization must run with a dry-run and audit
record before any parent folders are changed.

To inspect the plan for existing SOP files, run:

```bash
npm run storage:drive:organize-sops
```

After reviewing the dry-run output, apply the parent-folder changes without
re-uploading the files:

```bash
npm run storage:drive:organize-sops -- --apply
```

The command only processes SOP versions with `gdrive:<fileId>` storage keys,
creates missing `SOP/<Business Unit>/` folders idempotently, and writes a
`GOOGLE_DRIVE_REORGANIZED` audit record for each moved file.

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
apply committed Prisma migrations to the production database, and configure the
same Google Drive OAuth values and connected integration. Docker Compose is
local-only and is not available to Vercel deployments.

Push/deployment automation is controlled by the connected Git repository and
deployment platform configuration.
