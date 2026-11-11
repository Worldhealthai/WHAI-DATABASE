-- The Companies list shows each company's logo beside its name, so the
-- light row carries the logo file and the domain (for the site's own icon
-- when there is no file). New columns go last: a view keeps its order.
create or replace view crm.v_intel_cards with (security_invoker = true) as
  with card as (
    select v.id, v.slug, v.name, v.key, v.roles, v.firmographic, v.one_liner, v.hq_city, v.hq_country,
      v.employees_exact, v.employees_range, v.employees_as_of, v.categories, v.similar,
      (select count(*) from intel.deployments d where d.vendor_company_id = v.id and d.review_status <> 'rejected'
        and exists (select 1 from intel.deployment_evidence e where e.deployment_id = d.id)) as hospitals,
      (select count(*) from intel.deployments d where d.provider_company_id = v.id and d.review_status <> 'rejected'
        and exists (select 1 from intel.deployment_evidence e where e.deployment_id = d.id)) as vendors,
      c.provider_type, c.description_kind, c.logo_url, c.domain
    from intel.v_company_card v
    join intel.companies c on c.id = v.id
  )
  select l.external_id as crm_key, card.id, card.slug, card.name, card.key, card.roles, card.firmographic,
    card.one_liner, card.hq_city, card.hq_country, card.employees_exact, card.employees_range,
    card.employees_as_of, card.categories, card.similar, card.hospitals, card.vendors,
    card.provider_type, card.description_kind, card.logo_url, card.domain
  from card
  join intel.company_links l on l.company_id = card.id and l.system = 'crm_company_key'
  union all
  select card.key as crm_key, card.id, card.slug, card.name, card.key, card.roles, card.firmographic,
    card.one_liner, card.hq_city, card.hq_country, card.employees_exact, card.employees_range,
    card.employees_as_of, card.categories, card.similar, card.hospitals, card.vendors,
    card.provider_type, card.description_kind, card.logo_url, card.domain
  from card
  where not exists (select 1 from intel.company_links l
    where l.company_id = card.id and l.system = 'crm_company_key' and l.external_id = card.key);

grant select on crm.v_intel_cards to service_role;
