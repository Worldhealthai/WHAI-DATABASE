-- Marketing CRM: post tracking for the admin panel's line-up.
--
-- The speakers and sponsors shown in the Marketing portal come live from
-- the Nexus admin panel (the event's Speakers section, the sponsor
-- onboarding forms and manually added sponsors). This table holds only
-- what the marketing team records against them: welcome-post state and
-- link for a speaker, posts made against the package for a sponsor.
-- `ref` is the admin panel's record id; `edition` the event label.
create table if not exists marketing_tracking (
  id           text primary key default gen_random_uuid()::text,
  kind         text not null,                -- 'speaker' | 'sponsor'
  ref          text not null,                -- Nexus speaker / sponsor id
  edition      text not null,                -- e.g. 'World Health AI London 2026'
  "postStatus" text,                         -- speakers: 'To do' | 'Posted' | 'Not needed'
  "postUrl"    text,
  "postedAt"   timestamptz,
  "postsDue"   integer,                      -- sponsors: override of the package allowance
  "postsDone"  integer not null default 0,   -- sponsors: posts made
  log          jsonb not null default '[]',  -- [{ url, note, at }]
  notes        text,
  "updatedAt"  timestamptz not null default now(),
  unique (kind, ref, edition)
);
create index if not exists idx_marketing_tracking_edition on marketing_tracking(edition);
alter table marketing_tracking enable row level security;
drop policy if exists "service full access marketing_tracking" on marketing_tracking;
create policy "service full access marketing_tracking" on marketing_tracking using (true) with check (true);
