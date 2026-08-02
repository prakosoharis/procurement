-- pgvector is enabled before vector-backed source-section models are
-- introduced in REF-S1/REF-S3. Prisma does not model the `vector` type
-- directly, so future embedding queries use reviewed raw SQL.
CREATE EXTENSION IF NOT EXISTS vector;
