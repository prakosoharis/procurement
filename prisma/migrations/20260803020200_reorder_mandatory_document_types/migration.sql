-- Keep existing SopDocument relations intact by moving the codes on the
-- existing DocumentType rows instead of creating replacement rows.
-- The old Anti-Bribery Policy requirement becomes the approved Ethic Policy.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "DocumentType"
    WHERE "name" = 'Ethic Policy'
      AND "code" NOT IN ('M1', 'M2', 'M3', 'M4', 'M5', 'M6')
  ) THEN
    RAISE EXCEPTION 'Cannot reorder mandatory document types because Ethic Policy already exists outside M1-M6.';
  END IF;
END
$$;

-- Avoid the unique code constraint while the M1-M5 values are permuted.
UPDATE "DocumentType"
SET "code" = '__mandatory_reorder__' || "code",
    "name" = '__mandatory_reorder__' || "name"
WHERE "code" IN ('M1', 'M2', 'M3', 'M4', 'M5');

UPDATE "DocumentType"
SET "code" = 'M1', "name" = 'Procurement Policy', "category" = 'MANDATORY', "sortOrder" = 1
WHERE "code" = '__mandatory_reorder__M2';

UPDATE "DocumentType"
SET "code" = 'M2', "name" = 'Procurement SOP', "category" = 'MANDATORY', "sortOrder" = 2
WHERE "code" = '__mandatory_reorder__M3';

UPDATE "DocumentType"
SET "code" = 'M3', "name" = 'Supplier Info & Performance Mgmt SOP', "category" = 'MANDATORY', "sortOrder" = 3
WHERE "code" = '__mandatory_reorder__M4';

UPDATE "DocumentType"
SET "code" = 'M4', "name" = 'Matrix Level Authorization', "category" = 'MANDATORY', "sortOrder" = 4
WHERE "code" = '__mandatory_reorder__M5';

UPDATE "DocumentType"
SET "code" = 'M5', "name" = 'Ethic Policy', "category" = 'MANDATORY', "sortOrder" = 5
WHERE "code" = '__mandatory_reorder__M1';

UPDATE "DocumentType"
SET "name" = 'Code of Conduct', "category" = 'MANDATORY', "sortOrder" = 6
WHERE "code" = 'M6';

COMMIT;
