-- The Companies tab's category list (10 November 2026). Companies carry a
-- category's id ("drug-discovery"), but the view matched on its name
-- ("Drug Discovery"), so every category came out twice: the name with no
-- companies behind it, and the id as a stray entry of its own. Now one row
-- per category a company actually carries, under its proper name, with its
-- id and how many companies carry it (by id or by name). A category nobody
-- carries is not listed.
create or replace view crm.v_intel_categories with (security_invoker = true) as
  select max(x.name) as name, max(x.vertical) as vertical, count(distinct x.company_id) as companies, x.id
  from (
    select c.id as company_id, coalesce(k.id, u.c) as id, coalesce(k.name, u.c) as name, k.vertical
    from intel.companies c
    cross join lateral unnest(c.categories) as u(c)
    left join intel.categories k on k.id = u.c or k.name = u.c
  ) x
  group by x.id;
grant select on crm.v_intel_categories to service_role;
