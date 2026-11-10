-- Companies are on a side, not assigned to an event (11 November 2026). A
-- leads-list record carries a side (Health or Pharma) as a tag, like every
-- other contact (lib/contactFocus), and no event: an event only comes into
-- it when the company goes into an edition's Sales pipeline or one of its
-- people registers or speaks. Each lead with no side yet takes the side of
-- the event it was loaded under. The event column is left as it was; the
-- CRM no longer reads it (lib/segmentData).
-- Applied to the live database on 11 November 2026.
update crm.leads
   set tags = case when tags is null or btrim(tags) = '' then 'Pharma' else tags || ', Pharma' end
 where event ilike 'World Pharma AI%'
   and coalesce(tags, '') !~* '(^|,)\s*(health|pharma)\s*(,|$)';
update crm.leads
   set tags = case when tags is null or btrim(tags) = '' then 'Health' else tags || ', Health' end
 where event ilike 'World Health AI%'
   and coalesce(tags, '') !~* '(^|,)\s*(health|pharma)\s*(,|$)';
create index if not exists leads_tags_idx on crm.leads (tags);
