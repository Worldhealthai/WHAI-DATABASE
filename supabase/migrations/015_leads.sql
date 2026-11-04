-- Leads lists (November 2026): people from a leads file (the World Pharma AI
-- master leads: UK/US/international end users and vendors, RAISE and
-- BioTechX sponsors, FT and Reuters speakers). They are not on any pipeline:
-- they show in Companies, Contacts and the Directory only, labelled by the
-- list (Solution Provider or End User), with a note of where they came from
-- ("RAISE Summit 2026 sponsor · US company · …") that the search reads.
-- Applied to the live database on 4 November 2026 with the import.
create table if not exists crm.leads (
  id uuid primary key default gen_random_uuid(),
  "companyName" text, "firstName" text, "lastName" text, "jobTitle" text,
  email text, email2 text, phone text, "linkedinUrl" text,
  segment text not null check (segment in ('Solution Provider', 'End User')),
  region text, country text, city text, website text, industry text, "subIndustry" text,
  source text, "sourceTab" text, notes text, tags text,
  event text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table crm.leads enable row level security;
create index if not exists leads_event_idx on crm.leads (event);
create index if not exists leads_email_idx on crm.leads (lower(email));
drop trigger if exists plain_event_label on crm.leads;
create trigger plain_event_label before insert or update of event on crm.leads for each row execute function crm.plain_event_label();
grant all on crm.leads to service_role;
