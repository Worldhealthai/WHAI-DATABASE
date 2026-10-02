-- Marketing CRM: LinkedIn content, one post per row.
--
-- Each row is a post the Content tab drafted for an edition: the words on
-- the card (kicker, headline, subline), the caption and hashtags, the link
-- it points at, and where the idea came from (an Insights article, a
-- speaker, a session, a sponsor, the countdown). The image is drawn from
-- the row on request (/api/marketing/content/<id>/image), so nothing is
-- stored for it. `status` moves to 'posted' when the team has put it up.
create table if not exists marketing_content (
  id           text primary key default gen_random_uuid()::text,
  edition      text not null,                -- e.g. 'World Pharma AI London 2027'
  series       text not null,                -- 'World Health AI' | 'World Pharma AI'
  kind         text not null,                -- 'insight' | 'speaker' | 'session' | 'sponsor' | 'countdown' | 'theme'
  ref          text,                         -- the source's id, so it is not used again soon
  "forDate"    date,                         -- the day it is meant for
  kicker       text not null default '',
  headline     text not null,
  subline      text not null default '',
  caption      text not null,
  hashtags     text[] not null default '{}',
  link         text,
  source       jsonb not null default '{}',  -- what the draft was built from
  brief        text,                         -- what the admin asked for, if anything
  status       text not null default 'draft',-- 'draft' | 'posted'
  "postUrl"    text,
  "postedAt"   timestamptz,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);
create index if not exists idx_marketing_content_edition on marketing_content(edition, "forDate");
alter table marketing_content enable row level security;
drop policy if exists "service full access marketing_content" on marketing_content;
create policy "service full access marketing_content" on marketing_content using (true) with check (true);
