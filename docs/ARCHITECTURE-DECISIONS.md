# Architecture decisions

- Native governance work uses `/sop-governance/*` → `/api/governance/*` → governance services.
- Legacy iframe remains until an explicit retirement checkpoint.
- Four roles only: Superuser, Tim Procurement, Business Unit, Executive.
- Published version is immutable; revisions originate from the official published pointer.
- Human authority is mandatory; AI may assist later but never approves/publishes.
