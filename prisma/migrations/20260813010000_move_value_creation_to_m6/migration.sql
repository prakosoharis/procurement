-- Value Creation is a mandatory M6 requirement. The preceding taxonomy
-- migration has already moved the old M6 Code of Conduct document rows to
-- OTHER / Additional, so only the controlled Value Creation type is renamed.

BEGIN;

UPDATE "DocumentType"
SET "code" = 'M6',
    "name" = 'Value Creation',
    "sortOrder" = 6
WHERE "code" = 'M7'
  AND lower("name") = 'value creation';

COMMIT;
