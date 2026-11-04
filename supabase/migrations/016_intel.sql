-- Company intelligence (4 November 2026): what a company does, how big it
-- is, who is like it, which hospitals it is in and with what evidence, who
-- works there, and what has happened to it lately. One schema, intel, read
-- by the CRM (company and contact profiles, the Companies tab). Every fact
-- carries where it came from, when, and how sure we are; AI-written text is
-- marked as such. Nothing here is a customer list: deployments are only
-- those with a sourced announcement.
create schema if not exists intel;
grant usage on schema intel to service_role;

create table if not exists intel.categories (
  id text primary key, name text not null, vertical text not null
);

create table if not exists intel.companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  key text not null,                       -- the CRM's companyKey of the name
  roles text[] not null default '{}',      -- vendor, provider, pharma, payor, biotech, consultancy, other
  provider_type text,                      -- NHS_TRUST, US_HEALTH_SYSTEM, ACADEMIC_MEDICAL_CENTER, PHARMA, PAYOR, BIOTECH
  firmographic text,                       -- Solution Provider | End User (from the Intelligence data or Lusha)
  one_liner text,
  description text,
  description_kind text,                   -- human | ai | lusha
  description_sources jsonb,               -- [{label,url,date}]
  description_written_at timestamptz,
  description_verified_by text,
  description_verified_at timestamptz,
  website text, domain text, logo_url text, linkedin_url text, crunchbase_url text,
  hq_city text, hq_country text, founded int,
  employees_exact int, employees_range text, employees_as_of date, employees_source text,
  total_funding_usd bigint, last_round_type text, last_round_usd bigint, last_round_date text,
  revenue_min_usd bigint, revenue_max_usd bigint,
  categories text[] not null default '{}', specialities text[] not null default '{}',
  main_industry text, sub_industry text, company_type text,
  status text not null default 'ACTIVE',   -- ACTIVE | ACQUIRED | DEFUNCT | STUB
  acquired_by text,
  ods_code text unique, region text, beds int,
  lusha_id text, lusha_enriched_at timestamptz, enrichment_status text,
  visibility text not null default 'internal',
  source_kind text,                        -- seed | lusha | crm | manual
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists companies_key_idx on intel.companies (key);
create index if not exists companies_domain_idx on intel.companies (domain);
create index if not exists companies_roles_idx on intel.companies using gin (roles);
create index if not exists companies_categories_idx on intel.companies using gin (categories);

create table if not exists intel.company_domains (
  domain text primary key, company_id uuid not null references intel.companies(id) on delete cascade,
  is_primary boolean not null default false, source text
);
create table if not exists intel.company_aliases (
  alias text not null, alias_key text primary key, company_id uuid not null references intel.companies(id) on delete cascade, source text
);
-- The CRM's companies (by companyKey) to intel companies.
create table if not exists intel.company_links (
  system text not null, external_id text not null, company_id uuid not null references intel.companies(id) on delete cascade,
  match_method text not null, confidence text not null default 'medium',
  created_at timestamptz not null default now(),
  primary key (system, external_id)
);
create index if not exists company_links_company_idx on intel.company_links (company_id);

create table if not exists intel.facts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references intel.companies(id) on delete cascade,
  field text not null, value jsonb, source_kind text not null, source_url text, source_label text,
  observed_at date, confidence text not null default 'medium', is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists facts_company_idx on intel.facts (company_id, field);

create table if not exists intel.deployments (
  id uuid primary key default gen_random_uuid(),
  vendor_company_id uuid not null references intel.companies(id) on delete cascade,
  provider_company_id uuid not null references intel.companies(id) on delete cascade,
  use_case text not null, status text not null default 'ANNOUNCED',   -- ANNOUNCED | PILOT | PRODUCTION | EXPANDED | DISCONTINUED | UNKNOWN
  confidence text not null default 'low', review_status text not null default 'unsourced',  -- unsourced | proposed | verified | rejected
  reviewed_by text, reviewed_at timestamptz, seed_id text unique,
  created_at timestamptz not null default now(),
  unique (vendor_company_id, provider_company_id, use_case)
);
create index if not exists deployments_provider_idx on intel.deployments (provider_company_id);
create table if not exists intel.deployment_evidence (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references intel.deployments(id) on delete cascade,
  source_kind text not null, source_url text, source_label text, source_date date, quote text,
  unique (deployment_id, source_url)
);

create table if not exists intel.relations (
  from_company_id uuid not null references intel.companies(id) on delete cascade,
  to_company_id uuid not null references intel.companies(id) on delete cascade,
  kind text not null,                      -- similar | competitor | partner | parent
  score numeric, reasons jsonb, source_kind text, source_url text,
  confidence text not null default 'low', review_status text not null default 'proposed',  -- proposed | confirmed | rejected | computed
  reviewed_by text, reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (from_company_id, to_company_id, kind)
);
create index if not exists relations_to_idx on intel.relations (to_company_id, kind);

create table if not exists intel.signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references intel.companies(id) on delete cascade,
  signal_type text not null, detail text not null, date date, meta jsonb, source_url text,
  dedupe_key text unique, created_at timestamptz not null default now()
);
create index if not exists signals_company_idx on intel.signals (company_id, date desc);

create table if not exists intel.people (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references intel.companies(id) on delete cascade,
  seed_id text unique, name text not null, job_title text, seniority text, department text,
  linkedin_url text, country text, work_email text, lusha_id text, source_kind text,
  created_at timestamptz not null default now()
);
create index if not exists people_company_idx on intel.people (company_id);

create table if not exists intel.sources (
  url text primary key, label text, fetched_at timestamptz, excerpt text
);
create table if not exists intel.enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references intel.companies(id) on delete set null,
  step text not null, lusha_credits int not null default 0, notes text, created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['categories','companies','company_domains','company_aliases','company_links','facts','deployments','deployment_evidence','relations','signals','people','sources','enrichment_runs'] loop
    execute format('alter table intel.%I enable row level security', t);
    execute format('grant all on intel.%I to service_role', t);
  end loop;
end $$;

-- companyKey, as src/lib/segments.ts makes it, so the CRM and SQL agree.
create or replace function intel.company_key(name text) returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(lower(coalesce(name,'')), '&', ' and ', 'g'), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'),
    '(\s+(ltd|limited|llc|llp|inc|plc|corp|corporation|gmbh|ag|sa|bv|group|holdings|co|company|international|uk))+\s*$', '')), '')
$$;
-- The registrable domain of a URL or email: "https://www.emea.canon.com/x" -> "canon.com"
create or replace function intel.domain_of(s text) returns text language sql immutable as $$
  select nullif(regexp_replace(regexp_replace(lower(coalesce(s,'')), '^(https?://)?(www\.)?', ''), '[/?#].*$', ''), '')
$$;

create or replace view intel.v_company_card with (security_invoker = true) as
  select c.id, c.slug, c.name, c.key, c.roles, c.firmographic, c.one_liner, c.hq_city, c.hq_country,
    c.employees_exact, c.employees_range, c.employees_as_of, c.categories,
    (select count(*) from intel.deployments d where d.vendor_company_id = c.id and d.review_status <> 'rejected') as hospitals,
    (select count(*) from intel.relations r where r.from_company_id = c.id and r.kind = 'similar') as similar
  from intel.companies c;
grant select on intel.v_company_card to service_role;
