-- WHAI CRM — PostgreSQL Schema (Supabase)
-- Run this in the Supabase SQL editor to create all tables.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- DELEGATES
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists delegates (
  id                    text primary key default gen_random_uuid()::text,
  "firstName"           text not null,
  "lastName"            text not null,
  email                 text unique,
  phone                 text,
  "linkedinUrl"         text,
  organization          text,
  "jobTitle"            text,
  country               text,
  city                  text,
  status                text not null default 'Registered',
  event                 text,
  "subType"             text,
  "ticketType"          text,
  "dietaryRequirements" text,
  "accessibilityNeeds"  text,
  source                text,
  bio                   text,
  tags                  text,
  notes                 text,
  "createdAt"           timestamptz not null default now(),
  "updatedAt"           timestamptz not null default now()
);

create index if not exists idx_delegates_status  on delegates(status);
create index if not exists idx_delegates_event   on delegates(event);
create index if not exists idx_delegates_country on delegates(country);
create index if not exists idx_delegates_email   on delegates(email);
create index if not exists idx_delegates_created on delegates("createdAt" desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- SPEAKERS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists speakers (
  id                   text primary key default gen_random_uuid()::text,
  "firstName"          text not null,
  "lastName"           text not null,
  email                text unique,
  phone                text,
  "linkedinUrl"        text,
  organization         text,
  "jobTitle"           text,
  country              text,
  city                 text,
  "headshotUrl"        text,
  bio                  text,
  "expertiseAreas"     text,
  status               text not null default 'Prospecting',
  event                text,
  "subType"            text,
  year                 integer,
  "sessionTitle"       text,
  "sessionDescription" text,
  "sessionType"        text,
  fee                  numeric(10,2),
  "feeCurrency"        text default 'GBP',
  "feeStatus"          text default 'Not Set',
  "contractStatus"     text default 'Not Started',
  "travelRequired"     boolean not null default false,
  "hotelRequired"      boolean not null default false,
  tags                 text,
  notes                text,
  "createdAt"          timestamptz not null default now(),
  "updatedAt"          timestamptz not null default now()
);

create index if not exists idx_speakers_status  on speakers(status);
create index if not exists idx_speakers_event   on speakers(event);
create index if not exists idx_speakers_country on speakers(country);
create index if not exists idx_speakers_email   on speakers(email);
create index if not exists idx_speakers_created on speakers("createdAt" desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- SPONSORS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists sponsors (
  id                   text primary key default gen_random_uuid()::text,
  "companyId"          text,
  "companyName"        text not null,
  website              text,
  "contactFirstName"   text,
  "contactLastName"    text,
  "contactEmail"       text,
  "contactPhone"       text,
  "contactLinkedinUrl" text,
  "contactJobTitle"    text,
  country              text,
  city                 text,
  tier                 text default 'Bronze',
  status               text not null default 'Prospecting',
  event                text,
  "valueAmount"        numeric(12,2),
  "valueCurrency"      text default 'GBP',
  "contractStatus"     text default 'Not Started',
  "packageDetails"     text,
  tags                 text,
  notes                text,
  "createdAt"          timestamptz not null default now(),
  "updatedAt"          timestamptz not null default now()
);

create index if not exists idx_sponsors_status  on sponsors(status);
create index if not exists idx_sponsors_event   on sponsors(event);
create index if not exists idx_sponsors_tier    on sponsors(tier);
create index if not exists idx_sponsors_country on sponsors(country);
create index if not exists idx_sponsors_company on sponsors("companyId");
create index if not exists idx_sponsors_created on sponsors("createdAt" desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- ACTIVITIES — universal activity log
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists activities (
  id           text primary key default gen_random_uuid()::text,
  "entityType" text not null,
  "delegateId" text references delegates(id) on delete cascade,
  "speakerId"  text references speakers(id) on delete cascade,
  "sponsorId"  text references sponsors(id) on delete cascade,
  type         text not null,
  content      text not null,
  metadata     text,
  "createdBy"  text,
  "createdAt"  timestamptz not null default now()
);

create index if not exists idx_activities_delegate on activities("delegateId");
create index if not exists idx_activities_speaker  on activities("speakerId");
create index if not exists idx_activities_sponsor  on activities("sponsorId");
create index if not exists idx_activities_created  on activities("createdAt" desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTO updatedAt triggers
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists delegates_updated_at on delegates;
create trigger delegates_updated_at
  before update on delegates
  for each row execute function update_updated_at();

drop trigger if exists speakers_updated_at on speakers;
create trigger speakers_updated_at
  before update on speakers
  for each row execute function update_updated_at();

drop trigger if exists sponsors_updated_at on sponsors;
create trigger sponsors_updated_at
  before update on sponsors
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- STAGED CONTACTS — CSV import inbox, pending triage
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists staged_contacts (
  id              text primary key default gen_random_uuid()::text,
  "firstName"     text,
  "lastName"      text,
  email           text,
  phone           text,
  "linkedinUrl"   text,
  organization    text,
  "jobTitle"      text,
  country         text,
  city            text,
  bio             text,
  tags            text,
  notes           text,
  -- Triage state
  status          text not null default 'pending',  -- 'pending' | 'assigned' | 'skipped'
  "assignedAs"    text,                             -- 'delegate' | 'speaker' | 'sponsor'
  "assignedId"    text,                             -- id of the created record
  -- Import metadata
  "importBatch"   text,                             -- batch label (filename / timestamp)
  "rawData"       text,                             -- original CSV row as JSON string
  "createdAt"     timestamptz not null default now()
);

create index if not exists idx_staged_status  on staged_contacts(status);
create index if not exists idx_staged_batch   on staged_contacts("importBatch");
create index if not exists idx_staged_created on staged_contacts("createdAt" desc);

drop trigger if exists staged_contacts_updated_at on staged_contacts;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (service role has full access via API)
-- ─────────────────────────────────────────────────────────────────────────────

alter table delegates       enable row level security;
alter table speakers        enable row level security;
alter table sponsors        enable row level security;
alter table activities      enable row level security;
alter table staged_contacts enable row level security;

create policy "service full access delegates"        on delegates        using (true) with check (true);
create policy "service full access speakers"         on speakers         using (true) with check (true);
create policy "service full access sponsors"         on sponsors         using (true) with check (true);
create policy "service full access activities"       on activities       using (true) with check (true);
create policy "service full access staged_contacts"  on staged_contacts  using (true) with check (true);
