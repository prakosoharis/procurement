-- Preserve monetary precision for AI usage and pricing rates. Rates are USD per 1,000,000 tokens.
ALTER TABLE "AiUsage"
  ALTER COLUMN "estimatedCost" SET DATA TYPE DECIMAL(20,10) USING "estimatedCost"::numeric(20,10),
  ALTER COLUMN "pricingInputRate" SET DATA TYPE DECIMAL(20,10) USING "pricingInputRate"::numeric(20,10),
  ALTER COLUMN "pricingOutputRate" SET DATA TYPE DECIMAL(20,10) USING "pricingOutputRate"::numeric(20,10);

-- A legacy/manual ActionItem may have no source; an ActionItem must never have both sources.
ALTER TABLE "ActionItem"
  ADD CONSTRAINT "ActionItem_single_finding_source_check"
  CHECK (NOT ("findingId" IS NOT NULL AND "refinementFindingId" IS NOT NULL));
