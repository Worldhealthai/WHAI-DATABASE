-- ─────────────────────────────────────────────────────────────────────────────
-- 003 — Remove the partner rows that 002 copied into the `partners` table
--       from the `sponsors` table.
--
-- ⚠️  RUN THIS ONLY AFTER:
--     1. You have run 002_partners_table.sql successfully.
--     2. You have opened the Partners section in the app and confirmed all your
--        partners (and their contacts) are present and correct.
--
-- This is the destructive step. Because 002 preserved the original IDs, every
-- row we delete here has an exact copy already living in `partners`. Partner
-- activities were already detached from `sponsorId` in 002 step 4, so this
-- delete will NOT cascade-delete any activity history.
-- ─────────────────────────────────────────────────────────────────────────────

-- This delete can only ever remove rows whose id already exists in `partners`
-- (i.e. were copied by 002), so it cannot touch a genuine sponsor. Wrapped in a
-- transaction so it is all-or-nothing.
BEGIN;

DELETE FROM sponsors
WHERE id IN (SELECT id FROM partners);

COMMIT;

-- After this runs, `sponsors` contains only true sponsors and `partners`
-- contains only partners. The two sections are fully independent.
