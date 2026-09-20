-- The digital agenda, one per edition: sessions in running order with their
-- speaker slots and whether each person is confirmed or still TBC. Edited
-- in the Production portal, read in Sales, exported to Word.
create table if not exists agendas (
  edition      text primary key,             -- e.g. 'World Health AI London 2026'
  data         jsonb not null default '{}',  -- { title, dateLabel, venue, sessions: [...] }
  "sourceFile" text,
  "updatedAt"  timestamptz not null default now()
);
alter table agendas enable row level security;
drop policy if exists "service full access agendas" on agendas;
create policy "service full access agendas" on agendas using (true) with check (true);
