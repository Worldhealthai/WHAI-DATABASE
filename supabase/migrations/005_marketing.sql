-- Marketing CRM: LinkedIn welcome posts for speakers, post allowances for
-- sponsors. Run once in the Supabase SQL editor.

-- Speakers: consent from the registration form checkbox, and whether their
-- welcome post has been made.
alter table speakers add column if not exists "linkedinConsent" boolean;
alter table speakers add column if not exists "postStatus"      text;         -- 'To do' | 'Posted' | 'Not needed'
alter table speakers add column if not exists "postUrl"         text;
alter table speakers add column if not exists "postedAt"        timestamptz;

-- Sponsors: what the package includes and how many posts have been made.
alter table sponsors add column if not exists "linkedinPostsDue"  integer;
alter table sponsors add column if not exists "linkedinPostsDone" integer not null default 0;
alter table sponsors add column if not exists "onboardedAt"       timestamptz;
alter table sponsors add column if not exists "logoUrl"           text;

create index if not exists idx_speakers_post_status on speakers("postStatus");
