-- WHAI Intelligence Hub — Supabase Schema
-- Run this in Supabase SQL Editor to create all tables
-- Uses camelCase column names (quoted) to match frontend expectations

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPANIES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  "legalName" TEXT,
  website TEXT,
  description TEXT,
  "companyType" TEXT,
  "ownershipStatus" TEXT,
  "foundedYear" INTEGER,
  "employeeCountRange" TEXT,
  "annualRevenueRange" TEXT,
  "headquartersCountry" TEXT,
  "headquartersCity" TEXT,
  "headquartersStateProvince" TEXT,
  "stockTicker" TEXT,
  "stockExchange" TEXT,
  tags TEXT,
  "engagementScore" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONTACTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "firstName" TEXT,
  "lastName" TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  "linkedinUrl" TEXT,
  "jobTitle" TEXT,
  seniority TEXT,
  department TEXT,
  "companyName" TEXT,
  "companyId" TEXT REFERENCES companies(id) ON DELETE SET NULL,
  country TEXT,
  city TEXT,
  "stateProvince" TEXT,
  bio TEXT,
  tags TEXT,
  "engagementScore" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts ("companyId");
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);

-- ─────────────────────────────────────────────────────────────────────────────
-- DEALS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  "dealType" TEXT,
  "dealStage" TEXT,
  "dealValueUsd" BIGINT,
  "announcedDate" TIMESTAMPTZ,
  "closedDate" TIMESTAMPTZ,
  "acquirerCompanyId" TEXT REFERENCES companies(id) ON DELETE SET NULL,
  "targetCompanyId" TEXT REFERENCES companies(id) ON DELETE SET NULL,
  description TEXT,
  "sourceUrl" TEXT,
  tags TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_acquirer ON deals ("acquirerCompanyId");
CREATE INDEX IF NOT EXISTS idx_deals_target ON deals ("targetCompanyId");

-- ─────────────────────────────────────────────────────────────────────────────
-- DEAL INVESTORS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deal_investors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "dealId" TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  "investorCompanyName" TEXT,
  "investorCompanyId" TEXT REFERENCES companies(id) ON DELETE SET NULL,
  "investorRole" TEXT,
  "investmentAmountUsd" BIGINT
);

CREATE INDEX IF NOT EXISTS idx_deal_investors_deal ON deal_investors ("dealId");
CREATE INDEX IF NOT EXISTS idx_deal_investors_company ON deal_investors ("investorCompanyId");

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPANY VERTICALS (many-to-many)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_verticals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "verticalSlug" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("companyId", "verticalSlug")
);

CREATE INDEX IF NOT EXISTS idx_company_verticals_company ON company_verticals ("companyId");

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPANY THERAPEUTIC AREAS (many-to-many)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_therapeutic_areas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "therapeuticArea" TEXT NOT NULL,
  UNIQUE ("companyId", "therapeuticArea")
);

CREATE INDEX IF NOT EXISTS idx_company_therapeutic_areas_company ON company_therapeutic_areas ("companyId");

-- ─────────────────────────────────────────────────────────────────────────────
-- INSIGHTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  "contentType" TEXT,
  summary TEXT,
  body TEXT,
  author TEXT,
  "publishedAt" TIMESTAMPTZ,
  "isPremium" BOOLEAN NOT NULL DEFAULT false,
  tags TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (allow public read access via anon key)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_therapeutic_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Allow public read access (via anon key)
CREATE POLICY "Allow public read" ON companies FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON contacts FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON deals FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON deal_investors FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON company_verticals FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON company_therapeutic_areas FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON insights FOR SELECT USING (true);

-- Allow insert/update/delete via service_role key (used by seed endpoint)
CREATE POLICY "Allow service write" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON deal_investors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON company_verticals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON company_therapeutic_areas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write" ON insights FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
