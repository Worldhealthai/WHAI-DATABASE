-- A company's signals for its profile (11 November 2026), in the two kinds
-- the page shows apart: news (a signal with an article behind it, each
-- article once, the latest 20) and figures (Lusha's own numbers, with no
-- article: the latest of each of hiring, headcount, web traffic and IT
-- spend; for hiring the company-wide figure before a department's or a
-- country's, for headcount the longest window of the latest month).
-- crm.intel_company still carries the latest eight of every kind.
-- Applied to the live database on 11 November 2026.
create or replace function crm.intel_signals(p_key text) returns jsonb
language sql stable
set search_path = ''
as $$
  with co as (select crm.intel_company_id(p_key) as cid),
  sig as (
    select g.*, jsonb_build_object(
        'id', g.id, 'type', g.signal_type, 'headline', g.detail, 'date', g.date, 'meta', g.meta,
        'source', crm.intel_source(coalesce(g.meta->>'source_kind', 'lusha'),
          coalesce(g.meta->>'source', g.meta->>'publisher', case when g.source_url is not null then intel.domain_of(g.source_url) || ', via Lusha' else 'Lusha signal' end),
          g.source_url, g.date::text)) as doc
    from intel.signals g, co where g.company_id = co.cid
  ),
  news as (
    select doc, date, created_at from (
      select distinct on (source_url) doc, date, created_at from sig
      where source_url ~* '^https?://'
      order by source_url, date desc nulls last, created_at desc
    ) n order by date desc nulls last, created_at desc limit 20
  ),
  fig as (
    select distinct on (family) family, doc, date from (
      select s.*,
        case when s.signal_type ilike 'surgeInHiring%' then 'hiring'
             when s.signal_type ilike 'headcount%' then 'headcount'
             when s.signal_type ilike 'websiteTraffic%' then 'traffic'
             when s.signal_type ilike 'itSpend%' then 'itspend' end as family,
        case when s.signal_type = 'surgeInHiring' then 0
             when s.signal_type ilike '%12m' then 0 when s.signal_type ilike '%6m' then 1
             when s.signal_type ilike '%3m' then 2 when s.signal_type ilike '%1m' then 3 else 1 end as pref
      from sig s where s.source_url is null
    ) f where family is not null
    order by family, (case when family = 'hiring' then pref else 0 end), date desc nulls last, pref, created_at desc
  )
  select case when (select cid from co) is null then null else jsonb_build_object(
    'news', coalesce((select jsonb_agg(doc order by date desc nulls last, created_at desc) from news), '[]'::jsonb),
    'figures', coalesce((select jsonb_agg(doc order by family) from fig), '[]'::jsonb),
    'total', (select count(*) from sig)) end
$$;
grant execute on function crm.intel_signals(text) to service_role;
