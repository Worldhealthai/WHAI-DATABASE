-- The CRM reads company intelligence (schema intel, migration 016) through
-- its own schema, crm, because its database client is fixed to crm and
-- PostgREST does not expose intel. Three doors, 4 November 2026:
--
--   crm.intel_company(key)      one JSON document for a company's panel
--   crm.v_intel_cards           the light row per CRM company key, for the
--                               Companies tab's columns
--   crm.intel_review(action, p) a person's verdicts: a description read and
--                               verified, a competitor confirmed or rejected,
--                               a deployment verified or rejected, and the
--                               AI-written description the CRM saves
--
-- Everything is security invoker: the CRM's service role already holds
-- the grants on intel.*, and nothing here widens them.

-- A CRM companyKey to the intel company: the link table first (system
-- 'crm_company_key'), then the company's own key, then an alias.
create or replace function crm.intel_company_id(p_key text) returns uuid
language sql stable
set search_path = ''
as $$
  select coalesce(
    (select l.company_id from intel.company_links l
      where l.system = 'crm_company_key' and l.external_id = p_key
      order by case l.confidence when 'high' then 0 when 'medium' then 1 else 2 end, l.created_at
      limit 1),
    (select c.id from intel.companies c
      where c.key = p_key
      order by (c.status = 'ACTIVE') desc, cardinality(c.roles) desc, c.updated_at desc
      limit 1),
    (select a.company_id from intel.company_aliases a where a.alias_key = p_key limit 1)
  )
$$;

-- A source, as the panel shows one: where it came from, the page, the date.
create or replace function crm.intel_source(p_kind text, p_label text, p_url text, p_date text) returns jsonb
language sql immutable
as $$
  select jsonb_build_object(
    'kind', coalesce(p_kind, 'manual'),
    'label', coalesce(p_label, case when p_url is not null then regexp_replace(regexp_replace(lower(p_url), '^(https?://)?(www\.)?', ''), '[/?#].*$', '') else initcap(coalesce(p_kind, 'record')) end),
    'url', p_url,
    'date', p_date)
$$;

-- A deployment row as the panel reads it from either side, with its first
-- piece of evidence and the rest alongside. Status words are the panel's:
-- ANNOUNCED -> Announced, UNKNOWN -> Not known.
create or replace function crm.intel_deployment_json(d intel.deployments) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id,
    'vendor', (select jsonb_build_object('key', v.key, 'name', v.name, 'slug', v.slug) from intel.companies v where v.id = d.vendor_company_id),
    'provider', (select jsonb_build_object('key', p.key, 'name', p.name, 'slug', p.slug) from intel.companies p where p.id = d.provider_company_id),
    'useCase', d.use_case,
    'status', case upper(d.status) when 'UNKNOWN' then 'Not known' else initcap(lower(d.status)) end,
    'confidence', case when d.review_status = 'unsourced' then null else lower(d.confidence) end,
    'review', d.review_status,
    'reviewedBy', d.reviewed_by,
    'reviewedAt', d.reviewed_at,
    'evidence', (select crm.intel_source(e.source_kind, e.source_label, e.source_url, e.source_date::text)
                   from intel.deployment_evidence e where e.deployment_id = d.id
                   order by e.source_date desc nulls last, e.source_url limit 1),
    'evidenceAll', coalesce((select jsonb_agg(crm.intel_source(e.source_kind, e.source_label, e.source_url, e.source_date::text) || jsonb_build_object('quote', e.quote) order by e.source_date desc nulls last)
                   from intel.deployment_evidence e where e.deployment_id = d.id), '[]'::jsonb),
    'origin', case when d.review_status = 'unsourced' then
                 case when d.seed_id is not null then 'Intelligence dataset (seed), ' else 'Added ' end || to_char(d.created_at, 'DD Mon YYYY') end)
$$;

-- The one document a company's panel needs.
create or replace function crm.intel_company(p_key text) returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  cid uuid;
  c intel.companies;
  employees_fact intel.facts;
  funding_fact intel.facts;
  doc jsonb;
begin
  cid := crm.intel_company_id(p_key);
  if cid is null then return null; end if;
  select * into c from intel.companies where id = cid;

  select * into employees_fact from intel.facts f
    where f.company_id = cid and f.is_current and f.field in ('employees', 'employees_exact', 'employeesInLinkedin', 'headcount')
    order by case f.confidence when 'high' then 0 when 'medium' then 1 else 2 end, f.observed_at desc nulls last limit 1;
  select * into funding_fact from intel.facts f
    where f.company_id = cid and f.is_current and f.field in ('funding', 'total_funding_usd', 'last_round', 'last_round_usd')
    order by case f.confidence when 'high' then 0 when 'medium' then 1 else 2 end, f.observed_at desc nulls last limit 1;

  doc := jsonb_build_object(
    'id', c.id,
    'key', c.key,
    'slug', c.slug,
    'name', c.name,
    'roles', to_jsonb(c.roles),
    'providerType', c.provider_type,
    'firmographic', c.firmographic,
    'aliases', coalesce((select jsonb_agg(a.alias order by a.alias) from intel.company_aliases a where a.company_id = cid), '[]'::jsonb),
    'website', c.website,
    'domain', c.domain,
    'logoUrl', c.logo_url,
    'linkedinUrl', c.linkedin_url,
    'oneLiner', c.one_liner,
    'description', jsonb_build_object(
      'value', c.description,
      'kind', c.description_kind,
      'sources', coalesce(c.description_sources, '[]'::jsonb),
      'writtenAt', c.description_written_at,
      'verifiedBy', c.description_verified_by,
      'verifiedAt', c.description_verified_at),
    'categories', to_jsonb(c.categories),
    'category', c.categories[1],
    'specialities', to_jsonb(c.specialities),
    'mainIndustry', c.main_industry,
    'subIndustry', c.sub_industry,
    'hqCity', c.hq_city,
    'hqCountry', c.hq_country,
    'hq', nullif(concat_ws(', ', c.hq_city, c.hq_country), ''),
    'region', c.region,
    'founded', c.founded,
    'team', c.employees_exact,
    'teamRange', c.employees_range,
    'teamAsOf', c.employees_as_of,
    'teamFact', case when c.employees_exact is not null then jsonb_build_object(
        'value', c.employees_exact,
        'confidence', coalesce(employees_fact.confidence, 'medium'),
        'source', crm.intel_source(coalesce(employees_fact.source_kind, c.employees_source, 'lusha'),
                                   case coalesce(employees_fact.source_kind, c.employees_source, 'lusha') when 'lusha' then 'LinkedIn via Lusha' else coalesce(employees_fact.source_label, c.employees_source) end,
                                   employees_fact.source_url, coalesce(employees_fact.observed_at, c.employees_as_of)::text)) end,
    'funding', case when c.total_funding_usd is not null or c.last_round_usd is not null then jsonb_build_object(
        'totalUsd', c.total_funding_usd,
        'lastRoundType', c.last_round_type,
        'lastRoundUsd', c.last_round_usd,
        'lastRoundDate', c.last_round_date,
        'confidence', coalesce(funding_fact.confidence, 'medium'),
        'source', crm.intel_source(coalesce(funding_fact.source_kind, 'lusha'),
                                   coalesce(funding_fact.source_label, 'Lusha funding record'),
                                   coalesce(funding_fact.source_url, c.crunchbase_url),
                                   coalesce(funding_fact.observed_at::text, c.lusha_enriched_at::date::text))) end,
    'revenueBand', case when c.revenue_min_usd is not null or c.revenue_max_usd is not null then jsonb_build_object(
        'minUsd', c.revenue_min_usd, 'maxUsd', c.revenue_max_usd,
        'confidence', 'medium',
        'source', crm.intel_source('lusha', 'Lusha revenue band', null, c.lusha_enriched_at::date::text)) end,
    'status', initcap(lower(c.status)),
    'acquiredBy', c.acquired_by,
    'odsCode', c.ods_code,
    'beds', c.beds,
    'lushaEnrichedAt', c.lusha_enriched_at,
    'sourceKind', c.source_kind,
    'updatedAt', c.updated_at,
    -- Where this company is the vendor: the hospitals named, with evidence.
    'vendorDeployments', coalesce((select jsonb_agg(crm.intel_deployment_json(d) order by (d.review_status = 'verified') desc, (d.review_status = 'unsourced'), d.created_at desc)
        from intel.deployments d where d.vendor_company_id = cid and d.review_status <> 'rejected'), '[]'::jsonb),
    -- Where this company is the provider: the vendors it works with.
    'providerDeployments', coalesce((select jsonb_agg(crm.intel_deployment_json(d) order by (d.review_status = 'verified') desc, (d.review_status = 'unsourced'), d.created_at desc)
        from intel.deployments d where d.provider_company_id = cid and d.review_status <> 'rejected'), '[]'::jsonb),
    -- Companies like it, with the reasons the score was given.
    'similarCompanies', coalesce((select jsonb_agg(jsonb_build_object(
          'key', o.key, 'name', o.name, 'slug', o.slug, 'oneLiner', o.one_liner,
          'team', o.employees_exact, 'teamAsOf', o.employees_as_of, 'country', o.hq_country, 'hq', nullif(concat_ws(', ', o.hq_city, o.hq_country), ''),
          'reasons', coalesce(r.reasons, '[]'::jsonb), 'score', r.score, 'review', r.review_status)
          order by r.score desc nulls last, o.name)
        from intel.relations r join intel.companies o on o.id = r.to_company_id
        where r.from_company_id = cid and r.kind = 'similar' and r.review_status <> 'rejected'), '[]'::jsonb),
    -- Named competitors, from either side of the relation, until rejected.
    'competitors', coalesce((select jsonb_agg(jsonb_build_object(
          'key', o.key, 'name', o.name, 'slug', o.slug, 'oneLiner', o.one_liner,
          'review', x.review_status, 'reviewedBy', x.reviewed_by, 'reviewedAt', x.reviewed_at, 'confidence', x.confidence,
          'source', crm.intel_source(x.source_kind, case x.source_kind when 'llm' then 'Suggested by AI' when 'manual' then 'Named by the team' else null end, x.source_url, x.created_at::date::text))
          order by (x.review_status = 'confirmed') desc, o.name)
        from (
          select r.to_company_id as other_id, r.review_status, r.reviewed_by, r.reviewed_at, r.confidence, r.source_kind, r.source_url, r.created_at
            from intel.relations r where r.from_company_id = cid and r.kind = 'competitor' and r.review_status <> 'rejected'
          union all
          select r.from_company_id, r.review_status, r.reviewed_by, r.reviewed_at, r.confidence, r.source_kind, r.source_url, r.created_at
            from intel.relations r where r.to_company_id = cid and r.kind = 'competitor' and r.review_status <> 'rejected'
            and not exists (select 1 from intel.relations q where q.from_company_id = cid and q.to_company_id = r.from_company_id and q.kind = 'competitor')
        ) x join intel.companies o on o.id = x.other_id), '[]'::jsonb),
    -- The latest eight signals.
    'signals', coalesce((select jsonb_agg(s order by s->>'date' desc nulls last) from (
        select jsonb_build_object(
          'id', g.id, 'type', g.signal_type, 'headline', g.detail, 'date', g.date, 'meta', g.meta,
          'source', crm.intel_source(coalesce(g.meta->>'source_kind', 'lusha'), coalesce(g.meta->>'source', g.meta->>'publisher', case when g.source_url is not null then intel.domain_of(g.source_url) || ', via Lusha' else 'Lusha signal' end), g.source_url, g.date::text)) as s
        from intel.signals g where g.company_id = cid order by g.date desc nulls last, g.created_at desc limit 8) t), '[]'::jsonb),
    -- Names and titles only; never an email.
    'people', coalesce((select jsonb_agg(jsonb_build_object(
          'name', p.name, 'jobTitle', p.job_title, 'seniority', p.seniority, 'department', p.department, 'linkedinUrl', p.linkedin_url, 'country', p.country,
          'source', crm.intel_source(coalesce(p.source_kind, 'lusha'), case coalesce(p.source_kind, 'lusha') when 'lusha' then 'Lusha company record' when 'seed' then 'Intelligence dataset' else p.source_kind end, null, p.created_at::date::text))
          order by case lower(coalesce(p.seniority, '')) when 'c-suite' then 0 when 'c_suite' then 0 when 'owner' then 0 when 'founder' then 0 when 'vp' then 1 when 'vice president' then 1 when 'director' then 2 else 3 end, p.name)
        from (select * from intel.people where company_id = cid limit 12) p), '[]'::jsonb),
    -- Every current fact about size, funding and revenue, with its source.
    'facts', coalesce((select jsonb_agg(jsonb_build_object(
          'field', f.field, 'value', f.value, 'confidence', f.confidence,
          'source', crm.intel_source(f.source_kind, f.source_label, f.source_url, f.observed_at::text))
          order by f.field, f.observed_at desc nulls last)
        from intel.facts f where f.company_id = cid and f.is_current
          and (f.field like 'employees%' or f.field like 'headcount%' or f.field like '%funding%' or f.field like 'last_round%' or f.field like 'revenue%' or f.field = 'founded')), '[]'::jsonb),
    -- Providers only: vendors named in sourced announcements at other
    -- providers of the same type, with none here. At most six.
    'whitespace', case when c.provider_type is not null or 'provider' = any(c.roles) then coalesce((select jsonb_agg(q.w) from (
        select * from (select distinct on (d.vendor_company_id) jsonb_build_object(
            'key', v.key, 'name', v.name, 'slug', v.slug, 'oneLiner', v.one_liner,
            'at', pr.name, 'atKey', pr.key, 'useCase', d.use_case,
            'confidence', lower(d.confidence), 'review', d.review_status, 'reviewedBy', d.reviewed_by,
            'evidence', (select crm.intel_source(e.source_kind, e.source_label, e.source_url, e.source_date::text) from intel.deployment_evidence e where e.deployment_id = d.id order by e.source_date desc nulls last limit 1)) as w,
          (d.review_status = 'verified') as verified, d.created_at
          from intel.deployments d
          join intel.companies v on v.id = d.vendor_company_id
          join intel.companies pr on pr.id = d.provider_company_id
          where d.provider_company_id <> cid
            and d.review_status in ('proposed', 'verified')
            and (pr.provider_type = c.provider_type or (c.provider_type is null and 'provider' = any(pr.roles)))
            and exists (select 1 from intel.deployment_evidence e where e.deployment_id = d.id)
            and not exists (select 1 from intel.deployments h where h.provider_company_id = cid and h.vendor_company_id = d.vendor_company_id and h.review_status <> 'rejected')
          order by d.vendor_company_id, (d.review_status = 'verified') desc, d.created_at desc
        ) x order by x.verified desc, x.created_at desc limit 6
        ) q), '[]'::jsonb) else '[]'::jsonb end
  );
  -- Two counts the strip and the Companies tab share with v_intel_cards.
  doc := doc || jsonb_build_object(
    'hospitals', (select count(*) from intel.deployments d where d.vendor_company_id = cid and d.review_status <> 'rejected' and exists (select 1 from intel.deployment_evidence e where e.deployment_id = d.id)),
    'vendors', (select count(*) from intel.deployments d where d.provider_company_id = cid and d.review_status <> 'rejected' and exists (select 1 from intel.deployment_evidence e where e.deployment_id = d.id)),
    'similar', (select count(*) from intel.relations r where r.from_company_id = cid and r.kind = 'similar' and r.review_status <> 'rejected'));
  return doc;
end
$$;

-- The light row per CRM company key: a company linked under a CRM key, and
-- any company under its own key. hospitals = sourced hospitals (vendor
-- side), vendors = sourced vendors (provider side).
create or replace view crm.v_intel_cards with (security_invoker = true) as
  with card as (
    select v.id, v.slug, v.name, v.key, v.roles, v.firmographic, v.one_liner, v.hq_city, v.hq_country,
      v.employees_exact, v.employees_range, v.employees_as_of, v.categories, v.similar,
      (select count(*) from intel.deployments d where d.vendor_company_id = v.id and d.review_status <> 'rejected'
         and exists (select 1 from intel.deployment_evidence e where e.deployment_id = d.id)) as hospitals,
      (select count(*) from intel.deployments d where d.provider_company_id = v.id and d.review_status <> 'rejected'
         and exists (select 1 from intel.deployment_evidence e where e.deployment_id = d.id)) as vendors,
      c.provider_type, c.description_kind
    from intel.v_company_card v join intel.companies c on c.id = v.id
  )
  select l.external_id as crm_key, card.* from card
    join intel.company_links l on l.company_id = card.id and l.system = 'crm_company_key'
  union all
  select card.key as crm_key, card.* from card
    where not exists (select 1 from intel.company_links l where l.company_id = card.id and l.system = 'crm_company_key' and l.external_id = card.key);

-- The categories a company can carry, for the Companies tab's dropdown.
create or replace view crm.v_intel_categories with (security_invoker = true) as
  select k.name, k.vertical, (select count(*) from intel.companies c where k.name = any(c.categories)) as companies
  from intel.categories k
  union
  select u.name, null, count(*) from intel.companies c, unnest(c.categories) as u(name)
  where not exists (select 1 from intel.categories k where k.name = u.name)
  group by u.name;

-- A person's verdicts, and the AI-written description the CRM saves.
--   verify_description  {key, by}
--   competitor          {key, other_key, verdict: confirmed|rejected, by}
--   deployment          {id, verdict: verified|rejected, by}
--   set_description     {key, description, sources: [{label,url,date}], kind, by}
create or replace function crm.intel_review(p_action text, p_payload jsonb) returns jsonb
language plpgsql volatile
set search_path = ''
as $$
declare
  cid uuid;
  oid uuid;
  by_who text := coalesce(nullif(btrim(p_payload->>'by'), ''), 'CRM user');
  verdict text := p_payload->>'verdict';
  n int := 0;
begin
  if p_action = 'verify_description' then
    cid := crm.intel_company_id(p_payload->>'key');
    if cid is null then return jsonb_build_object('ok', false, 'error', 'No intel company for that key'); end if;
    update intel.companies set description_verified_by = by_who, description_verified_at = now(), updated_at = now() where id = cid and description is not null;
    get diagnostics n = row_count;
    if n = 0 then return jsonb_build_object('ok', false, 'error', 'There is no description to verify'); end if;
    return jsonb_build_object('ok', true, 'verifiedBy', by_who, 'verifiedAt', now());

  elsif p_action = 'competitor' then
    if verdict not in ('confirmed', 'rejected') then return jsonb_build_object('ok', false, 'error', 'verdict must be confirmed or rejected'); end if;
    cid := crm.intel_company_id(p_payload->>'key');
    oid := crm.intel_company_id(p_payload->>'other_key');
    if cid is null or oid is null then return jsonb_build_object('ok', false, 'error', 'No intel company for that key'); end if;
    update intel.relations set review_status = verdict, reviewed_by = by_who, reviewed_at = now()
      where kind = 'competitor' and ((from_company_id = cid and to_company_id = oid) or (from_company_id = oid and to_company_id = cid));
    get diagnostics n = row_count;
    if n = 0 then return jsonb_build_object('ok', false, 'error', 'No competitor relation between those companies'); end if;
    return jsonb_build_object('ok', true, 'updated', n, 'review', verdict, 'reviewedBy', by_who, 'reviewedAt', now());

  elsif p_action = 'deployment' then
    if verdict not in ('verified', 'rejected') then return jsonb_build_object('ok', false, 'error', 'verdict must be verified or rejected'); end if;
    update intel.deployments set review_status = verdict, reviewed_by = by_who, reviewed_at = now() where id = (p_payload->>'id')::uuid;
    get diagnostics n = row_count;
    if n = 0 then return jsonb_build_object('ok', false, 'error', 'No deployment with that id'); end if;
    return jsonb_build_object('ok', true, 'updated', n, 'review', verdict, 'reviewedBy', by_who, 'reviewedAt', now());

  elsif p_action = 'set_description' then
    cid := crm.intel_company_id(p_payload->>'key');
    if cid is null then return jsonb_build_object('ok', false, 'error', 'No intel company for that key'); end if;
    if nullif(btrim(p_payload->>'description'), '') is null then return jsonb_build_object('ok', false, 'error', 'description is empty'); end if;
    update intel.companies set
        description = btrim(p_payload->>'description'),
        description_kind = coalesce(nullif(p_payload->>'kind', ''), 'ai'),
        description_sources = coalesce(p_payload->'sources', '[]'::jsonb),
        description_written_at = now(),
        description_verified_by = null,
        description_verified_at = null,
        updated_at = now()
      where id = cid;
    insert into intel.facts (company_id, field, value, source_kind, source_url, source_label, observed_at, confidence)
      values (cid, 'description', jsonb_build_object('text', btrim(p_payload->>'description'), 'sources', coalesce(p_payload->'sources', '[]'::jsonb), 'by', by_who),
              case coalesce(nullif(p_payload->>'kind', ''), 'ai') when 'ai' then 'llm' else 'manual' end, null,
              case coalesce(nullif(p_payload->>'kind', ''), 'ai') when 'ai' then 'AI-written description from the CRM' else 'Written in the CRM' end, current_date, 'low');
    return jsonb_build_object('ok', true, 'writtenAt', now(), 'kind', coalesce(nullif(p_payload->>'kind', ''), 'ai'));
  end if;
  return jsonb_build_object('ok', false, 'error', 'Unknown action ' || coalesce(p_action, ''));
end
$$;

grant usage on schema crm to service_role;
grant execute on function crm.intel_company_id(text) to service_role;
grant execute on function crm.intel_source(text, text, text, text) to service_role;
grant execute on function crm.intel_deployment_json(intel.deployments) to service_role;
grant execute on function crm.intel_company(text) to service_role;
grant execute on function crm.intel_review(text, jsonb) to service_role;
grant select on crm.v_intel_cards to service_role;
grant select on crm.v_intel_categories to service_role;
