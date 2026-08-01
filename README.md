# Procurement Governance Hub

Procurement Governance Hub is an internal web application for managing SOP
documents, Business Unit submissions, human refinement, audit appointments, and
governance reporting.

The approved product interface is available at
[http://localhost:3000](http://localhost:3000).

## Documentation

- [Product overview](docs/PRODUCT.md)
- [Business workflows](docs/WORKFLOW.md)
- [System architecture](docs/ARCHITECTURE.md)
- [Technical setup and deployment](docs/TECHNICAL-GUIDE.md)
- [API reference](docs/API.md)

## Local quick start

Start all local services:

```bash
docker compose up --build
```

This starts the Next.js application on port 3000, PostgreSQL on port 5432, and
the local MinIO console on port 9001. The development database is initialized
from the Prisma schema and seed data.

Stop services without deleting data:

```bash
docker compose down
```

For local development without Docker, configure PostgreSQL and storage values in
`.env.local`, then run:

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Do not commit `.env`, `.env.local`, OAuth secrets, or production connection
strings.
