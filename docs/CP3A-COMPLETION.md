# CP3A completion

CP3A exposes governance read and approved mutation routes under `/api/governance`. Routes use authenticated server-side users, scoped Prisma queries, named CP2B services, standard error responses, request IDs, and safe Date/Decimal serialization.

Human-only refinement is a single approved operation: `REFINEMENT → VALIDATION`; it stores the HUMAN_ONLY justification and does not call AI or create AI evidence. SOP activity aggregates the permitted document and its version-level AuditLog entries. CP3A has no approval, publishing, audit mutation, AI, or UI migration endpoint.
