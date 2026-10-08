-- LinkedIn posting from the Content tab.
--
-- One row: the LinkedIn sign-in the CRM posts with (made once with
-- "Connect LinkedIn" by an admin of the company pages), the pages that
-- sign-in may post to, and which page each brand posts to. The tokens are
-- LinkedIn's own, good for about two months; "Connect LinkedIn" again
-- renews them. Safe to re-run.
create table if not exists linkedin_connection (
  id                   text primary key default 'default',
  access_token         text not null,
  refresh_token        text,
  expires_at           timestamptz not null,
  refresh_expires_at   timestamptz,
  scope                text,
  pages                jsonb not null default '[]',  -- [{ urn, name }]
  page_for             jsonb not null default '{}',  -- { health, pharma, nexus } -> urn
  pages_error          text,
  "connectedAt"        timestamptz not null default now(),
  "updatedAt"          timestamptz not null default now()
);
alter table linkedin_connection enable row level security;
drop policy if exists "service full access linkedin_connection" on linkedin_connection;
create policy "service full access linkedin_connection" on linkedin_connection using (true) with check (true);

notify pgrst, 'reload schema';
