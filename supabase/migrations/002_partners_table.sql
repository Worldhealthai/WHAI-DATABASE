-- ─────────────────────────────────────────────────────────────────────────────
-- 002 — Give Partners their own table (split out of `sponsors`)
--
-- Partners were previously stored in the `sponsors` table and distinguished only
-- by tier ('Media Partner' / 'Association Partner'). This migration creates a
-- dedicated `partners` table that mirrors `sponsors` exactly (including the
-- self-referencing `companyId` used for multi-contact companies) and COPIES the
-- existing partner records into it. It is purely ADDITIVE — it does not delete
-- anything from `sponsors`. Run 003 to remove the copies from `sponsors` only
-- after you've verified the Partners section works.
--
-- Run this in your Supabase SQL editor (Database → SQL editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. The partners table (1:1 mirror of the live sponsors table) ───────────────
CREATE TABLE IF NOT EXISTS partners (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId"          TEXT,
  "companyName"        TEXT NOT NULL,
  website              TEXT,
  "contactFirstName"   TEXT,
  "contactLastName"    TEXT,
  "contactEmail"       TEXT,
  "contactPhone"       TEXT,
  "contactLinkedinUrl" TEXT,
  "contactJobTitle"    TEXT,
  country              TEXT,
  city                 TEXT,
  tier                 TEXT DEFAULT 'Media Partner',
  status               TEXT NOT NULL DEFAULT 'Not Contacted',
  event                TEXT,
  "valueAmount"        NUMERIC(12,2),
  "valueCurrency"      TEXT DEFAULT 'GBP',
  "contractStatus"     TEXT DEFAULT 'Not Started',
  "packageDetails"     TEXT,
  tags                 TEXT,
  notes                TEXT,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_status  ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_tier    ON partners(tier);
CREATE INDEX IF NOT EXISTS idx_partners_country ON partners(country);
CREATE INDEX IF NOT EXISTS idx_partners_company ON partners("companyId");
CREATE INDEX IF NOT EXISTS idx_partners_created ON partners("createdAt" DESC);

-- Reuse the shared updatedAt trigger function defined in schema.sql
DROP TRIGGER IF EXISTS partners_updated_at ON partners;
CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service full access partners" ON partners;
CREATE POLICY "service full access partners" ON partners USING (true) WITH CHECK (true);

-- 2. Activity feed support — partners need their own FK on `activities` ────────
ALTER TABLE activities ADD COLUMN IF NOT EXISTS "partnerId" TEXT REFERENCES partners(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_activities_partner ON activities("partnerId");

-- 3. Copy partner records (companies AND their linked contacts) into partners ──
--    Companies carry the partner tier; their linked contacts do NOT (they keep
--    the default tier), so contacts are matched by companyId, not by tier.
--    IDs are preserved so existing activity rows still line up.
INSERT INTO partners (
  id, "companyId", "companyName", website,
  "contactFirstName", "contactLastName", "contactEmail", "contactPhone",
  "contactLinkedinUrl", "contactJobTitle", country, city, tier, status, event,
  "valueAmount", "valueCurrency", "contractStatus", "packageDetails", tags, notes,
  "createdAt", "updatedAt"
)
SELECT
  s.id, s."companyId", s."companyName", s.website,
  s."contactFirstName", s."contactLastName", s."contactEmail", s."contactPhone",
  s."contactLinkedinUrl", s."contactJobTitle", s.country, s.city, s.tier, s.status, s.event,
  s."valueAmount", s."valueCurrency", s."contractStatus", s."packageDetails", s.tags, s.notes,
  s."createdAt", s."updatedAt"
FROM sponsors s
WHERE s."companyId" IS NULL AND s.tier IN ('Media Partner', 'Association Partner')
   OR s."companyId" IN (
        SELECT id FROM sponsors
        WHERE "companyId" IS NULL AND tier IN ('Media Partner', 'Association Partner')
      )
ON CONFLICT (id) DO NOTHING;

-- 4. Re-key partner activities onto partnerId and DETACH from sponsorId so the
--    cascade delete in migration 003 cannot wipe out partner activity history.
UPDATE activities
SET "partnerId"  = "sponsorId",
    "sponsorId"  = NULL,
    "entityType" = 'partner'
WHERE "sponsorId" IN (SELECT id FROM partners);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify, then run 003_partners_cleanup_sponsors.sql to remove the duplicates
-- from `sponsors`. Until then, partners safely exist in both tables — the
-- sponsors list already filters partner tiers out, so nothing shows twice.
-- ─────────────────────────────────────────────────────────────────────────────
