-- ─────────────────────────────────────────────────────────────────────────────
-- 004 — Rename the "Exhibitor" sponsor tier to "Exhibition Partner".
--
-- The tier is free text on sponsors/partners, and the CRM's tier dropdown now
-- offers "Exhibition Partner". Existing rows keep the old value until this
-- runs; the badge falls back to displaying the new label either way, so this
-- is safe to run whenever.
-- ─────────────────────────────────────────────────────────────────────────────

update sponsors
   set tier = 'Exhibition Partner', "updatedAt" = now()
 where tier = 'Exhibitor';

update partners
   set tier = 'Exhibition Partner', "updatedAt" = now()
 where tier = 'Exhibitor';
