-- Deal enrichment: add detailed deal metadata columns
-- Run this against your Supabase database to add the new fields

-- Strategic & classification
ALTER TABLE deals ADD COLUMN IF NOT EXISTS rationale TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS geography TEXT;

-- Valuation multiples (for M&A / PE)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "premiumPct" NUMERIC(5,1);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "evRevenueMultiple" NUMERIC(6,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "evEbitdaMultiple" NUMERIC(6,2);

-- Financing
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "financingType" TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "cashComponent" BIGINT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "stockComponent" BIGINT;

-- Regulatory
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "regulatoryStatus" TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "regulatoryBodies" TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "expectedCloseDate" TIMESTAMPTZ;

-- Terms
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "earnoutTerms" TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "breakupFeePct" NUMERIC(4,1);

-- Advisors
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "advisorAcquirer" TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "advisorTarget" TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "legalAdvisorAcquirer" TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "legalAdvisorTarget" TEXT;

-- Indexes for common filter columns
CREATE INDEX IF NOT EXISTS idx_deals_sector ON deals (sector);
CREATE INDEX IF NOT EXISTS idx_deals_geography ON deals (geography);
CREATE INDEX IF NOT EXISTS idx_deals_regulatory_status ON deals ("regulatoryStatus");
