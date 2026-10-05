-- One row per person PER EDITION, for speakers and delegates.
--
-- Until now an email could appear once in each table, so a speaker who
-- spoke at London 2026 could not be added for London 2027: the CRM said
-- "duplicate". Each row is filed under one edition (`event`), so the rule
-- becomes: the same email at most once per edition. A speaker's 2027 row is
-- a fresh lead (status, session, fee and contract start again) that reuses
-- their contact details; the 2026 row stays as the record of that year.
--
-- The old rule was case-sensitive, so a few contacts are in twice for one
-- edition with emails differing only in capitalisation. Those are merged
-- first: the earliest row stays, its later copies' activity history moves
-- to it, and the copies go. Safe to re-run.

alter table speakers  drop constraint if exists speakers_email_key;
alter table delegates drop constraint if exists delegates_email_key;

-- Merge case-only duplicates within an edition.
with ranked as (
  select id,
         first_value(id) over (partition by lower(email), coalesce(event, '')
                               order by "createdAt", id) as keep_id
  from delegates
  where email is not null and email <> ''
), dup as (select id, keep_id from ranked where id <> keep_id)
update activities a set "delegateId" = dup.keep_id from dup where a."delegateId" = dup.id;

with ranked as (
  select id,
         first_value(id) over (partition by lower(email), coalesce(event, '')
                               order by "createdAt", id) as keep_id
  from delegates
  where email is not null and email <> ''
)
delete from delegates d using ranked r where d.id = r.id and r.id <> r.keep_id;

with ranked as (
  select id,
         first_value(id) over (partition by lower(email), coalesce(event, '')
                               order by "createdAt", id) as keep_id
  from speakers
  where email is not null and email <> ''
), dup as (select id, keep_id from ranked where id <> keep_id)
update activities a set "speakerId" = dup.keep_id from dup where a."speakerId" = dup.id;

with ranked as (
  select id,
         first_value(id) over (partition by lower(email), coalesce(event, '')
                               order by "createdAt", id) as keep_id
  from speakers
  where email is not null and email <> ''
)
delete from speakers s using ranked r where s.id = r.id and r.id <> r.keep_id;

-- Case-insensitive, and rows without an edition count as one edition.
create unique index if not exists speakers_email_edition_key
  on speakers (lower(email), coalesce(event, ''))
  where email is not null and email <> '';
create unique index if not exists delegates_email_edition_key
  on delegates (lower(email), coalesce(event, ''))
  where email is not null and email <> '';

notify pgrst, 'reload schema';
