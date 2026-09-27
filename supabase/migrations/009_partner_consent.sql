-- Consent to share contact details with the event's sponsors and partners.
--
-- worldpharma.ai asks registrants, with an unticked box, whether they agree
-- to share their name, job title and organisation with the event's sponsors
-- and partners. The registration webhook stores the answer here, and the
-- delegate lists and CSV export show it, so sponsor and partner lead lists
-- only ever include people who said yes.
--
--   true  — agreed to share
--   false — asked, and did not agree
--   null  — not asked (e.g. worldhealth.ai, or contacts added by hand)
--
-- Run once in the Supabase SQL editor. Purely additive and safe to run more
-- than once. Until it runs, the webhook still saves every contact, just
-- without this answer.
alter table delegates add column if not exists "partnerConsent" boolean;
alter table speakers  add column if not exists "partnerConsent" boolean;

comment on column delegates."partnerConsent" is
  'Agreed to share name, job title and organisation with the event''s sponsors and partners: true = yes, false = no, null = not asked.';
comment on column speakers."partnerConsent" is
  'Agreed to share name, job title and organisation with the event''s sponsors and partners: true = yes, false = no, null = not asked.';

-- Tell PostgREST (the Supabase API layer) to reload its schema cache so the
-- new column is usable straight away.
notify pgrst, 'reload schema';
