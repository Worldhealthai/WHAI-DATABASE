-- One row per person PER EDITION, for speakers and delegates.
--
-- Until now an email could appear once in each table, so a speaker who
-- spoke at London 2026 could not be added for London 2027: the CRM said
-- "duplicate". Each row is filed under one edition (`event`), so the rule
-- becomes: the same email at most once per edition. A speaker's 2027 row is
-- a fresh lead (status, session, fee and contract start again) that reuses
-- their contact details; the 2026 row stays as the record of that year.
--
-- Safe to re-run.

alter table speakers  drop constraint if exists speakers_email_key;
alter table delegates drop constraint if exists delegates_email_key;

-- Case-insensitive, and rows without an edition count as one edition.
create unique index if not exists speakers_email_edition_key
  on speakers (lower(email), coalesce(event, ''))
  where email is not null and email <> '';
create unique index if not exists delegates_email_edition_key
  on delegates (lower(email), coalesce(event, ''))
  where email is not null and email <> '';

notify pgrst, 'reload schema';
