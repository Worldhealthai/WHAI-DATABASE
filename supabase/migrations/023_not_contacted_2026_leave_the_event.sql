-- A company is on a side and only joins an edition through its Sales
-- pipeline (11 November 2026). 349 companies sat in World Health AI London
-- 2026 at Not Contacted from the old bulk load, never worked (no activity
-- on any). They and their contact rows (1,019 rows) lose the event and
-- take the Health tag unless they already had a Health or Pharma tag.
-- Applied to the live database on 11 November 2026; the rows as they were
-- are in crm.sponsors_event_backup_20261111 (id, event, tags, updatedAt).
create table if not exists crm.sponsors_event_backup_20261111 as
  select id, event, tags, "updatedAt" from crm.sponsors s
  where ("companyId" is null and event = 'World Health AI London 2026' and status = 'Not Contacted')
     or ("companyId" in (select id from crm.sponsors where "companyId" is null and event = 'World Health AI London 2026' and status = 'Not Contacted')
         and event = 'World Health AI London 2026');
alter table crm.sponsors_event_backup_20261111 enable row level security;
update crm.sponsors s set event = null,
  tags = case when coalesce(tags, '') ~* '(^|,)\s*(health|pharma)\s*(,|$)' then tags
              when tags is null or btrim(tags) = '' then 'Health' else tags || ', Health' end
  where id in (select id from crm.sponsors_event_backup_20261111) and event = 'World Health AI London 2026';
-- To undo: update crm.sponsors s set event = b.event, tags = b.tags
--   from crm.sponsors_event_backup_20261111 b where b.id = s.id;
