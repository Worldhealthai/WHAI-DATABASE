-- Adds the event / subType / year columns that the CRM UI and the website
-- registration webhook read and write. The original schema.sql never created
-- them, so on databases built from that file the webhook insert fails with
-- "column does not exist" and approved registrations never appear in the CRM.
--
-- Run this in the Supabase SQL editor of the WHAI-DATABASE project.
-- Purely additive: ADD COLUMN IF NOT EXISTS only — no rows are modified or
-- deleted, and it is safe to run more than once.

ALTER TABLE delegates ADD COLUMN IF NOT EXISTS event     text;
ALTER TABLE delegates ADD COLUMN IF NOT EXISTS "subType" text;

ALTER TABLE speakers  ADD COLUMN IF NOT EXISTS event     text;
ALTER TABLE speakers  ADD COLUMN IF NOT EXISTS "subType" text;
ALTER TABLE speakers  ADD COLUMN IF NOT EXISTS year      integer;

ALTER TABLE sponsors  ADD COLUMN IF NOT EXISTS event     text;

CREATE INDEX IF NOT EXISTS idx_delegates_event ON delegates(event);
CREATE INDEX IF NOT EXISTS idx_speakers_event  ON speakers(event);
CREATE INDEX IF NOT EXISTS idx_sponsors_event  ON sponsors(event);

-- Tell PostgREST (the Supabase API layer) to reload its schema cache so the
-- new columns are usable immediately, without waiting or restarting.
NOTIFY pgrst, 'reload schema';
