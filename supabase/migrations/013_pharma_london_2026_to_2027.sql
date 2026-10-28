-- World Pharma AI London 2026 is not running: everything filed under it
-- moves to World Pharma AI London 2027, and the 2026 edition leaves the
-- CRM's event lists (they are built from the labels in the data).
--
-- Most of these companies are in 2027 already, as the untouched copy the
-- CRM makes when a company is ticked into another event ("Not Contacted",
-- its contacts copied). The 2026 record is the one that was worked, so it
-- stays and takes the 2027 slot: the copy's activity, any contact it has
-- that the 2026 record hasn't, and anything it holds that the 2026 record
-- leaves blank move onto it (the furthest-along stage wins), then the copy
-- goes. A company only in 2026 is simply relabelled. Delegates and speakers
-- move too; one already in 2027 keeps that row and gains the 2026 row's
-- activity. Safe to re-run: once nothing is filed under 2026 it does nothing.

create or replace function pg_temp.move_company_edition(t text, act text, f text, dest text) returns void
language plpgsql as $fn$
declare
  p record;
  c record;
  -- A person is their email, else their name (as lib/companyMerge.ts).
  person constant text := $k$coalesce(nullif(lower(trim(%1$s."contactEmail")), ''),
    nullif(lower(trim(coalesce(%1$s."contactFirstName", '') || ' ' || coalesce(%1$s."contactLastName", ''))), ''))$k$;
  ranked constant text := $r$coalesce(array_position(array['Not Contacted', 'Prospecting', 'Rejected', 'Emailed', 'In Discussion', 'Confirmed'], %s), 0)$r$;
  family text[];
  k text;
  n int;
begin
  for p in execute format($q$
    select distinct on (o.id) o.id as old_id, n.id as new_id
    from %1$I o
    join %1$I n on n."companyId" is null and n.event = %3$L
               and lower(trim(n."companyName")) = lower(trim(o."companyName"))
    where o."companyId" is null and o.event = %2$L
    order by o.id, n."createdAt"$q$, t, f, dest)
  loop
    -- Two 2026 records for one company: the second finds the copy gone.
    execute format('select count(*) from %I where id = $1', t) using p.new_id into n;
    if n = 0 then continue; end if;

    -- Blanks on the 2026 record filled from the copy; the further stage wins.
    execute format($q$
      update %1$I o set
        status = case when %2$s > %3$s then n.status else o.status end,
        tier = coalesce(nullif(o.tier, ''), n.tier),
        "valueAmount" = coalesce(o."valueAmount", n."valueAmount"),
        "packageDetails" = coalesce(nullif(o."packageDetails", ''), n."packageDetails"),
        "contractStatus" = case when coalesce(o."contractStatus", 'Not Started') = 'Not Started'
                                then coalesce(n."contractStatus", o."contractStatus") else o."contractStatus" end,
        notes = case when coalesce(n.notes, '') = '' or n.notes = o.notes then o.notes
                     when coalesce(o.notes, '') = '' then n.notes
                     else o.notes || E'\n\n' || n.notes end
      from %1$I n where o.id = $1 and n.id = $2$q$,
      t, format(ranked, 'n.status'), format(ranked, 'o.status')) using p.old_id, p.new_id;
    if t = 'sponsors' then
      update sponsors o set
        "onboardedAt" = coalesce(o."onboardedAt", n."onboardedAt"),
        "logoUrl" = coalesce(nullif(o."logoUrl", ''), n."logoUrl"),
        "linkedinPostsDue" = coalesce(o."linkedinPostsDue", n."linkedinPostsDue"),
        "linkedinPostsDone" = greatest(o."linkedinPostsDone", n."linkedinPostsDone")
      from sponsors n where o.id = p.old_id and n.id = p.new_id;
    end if;

    -- The copy's own activity moves to the 2026 record.
    execute format('update activities set %I = $1 where %I = $2', act, act) using p.old_id, p.new_id;

    -- The people the 2026 record already has.
    execute format($q$select coalesce(array_agg(k), '{}') from (select %s as k from %I x where x.id = $1 or x."companyId" = $1) s where k is not null$q$,
                   format(person, 'x'), t) using p.old_id into family;

    -- The copy's contacts: one the 2026 record has goes (its activity moves
    -- first); anyone else joins the 2026 record.
    for c in execute format('select id, %s as k from %I x where x."companyId" = $1', format(person, 'x'), t) using p.new_id loop
      if c.k is not null and c.k = any(family) then
        execute format('update activities set %I = $1 where %I = $2', act, act) using p.old_id, c.id;
        execute format('delete from %I where id = $1', t) using c.id;
      else
        execute format('update %I set "companyId" = $1 where id = $2', t) using p.old_id, c.id;
        family := family || c.k;
      end if;
    end loop;

    -- The copy itself: its main contact stays on as a contact if new.
    execute format('select %s from %I x where x.id = $1', format(person, 'x'), t) using p.new_id into k;
    if k is not null and not (k = any(family)) then
      execute format('update %I set "companyId" = $1 where id = $2', t) using p.old_id, p.new_id;
    else
      execute format('delete from %I where id = $1', t) using p.new_id;
    end if;
  end loop;

  execute format('update %I set event = $2 where event = $1', t) using f, dest;
end
$fn$;

create or replace function pg_temp.move_person_edition(t text, act text, f text, dest text) returns void
language plpgsql as $fn$
begin
  -- Already in 2027 under the same email: that row stays, gains the activity.
  execute format($q$
    with twin as (
      select o.id as old_id, n.id as new_id from %1$I o
      join %1$I n on n.event = $2 and lower(n.email) = lower(o.email)
      where o.event = $1 and coalesce(o.email, '') <> ''
    )
    update activities a set %2$I = twin.new_id from twin where a.%2$I = twin.old_id$q$, t, act) using f, dest;
  execute format($q$
    delete from %1$I o using %1$I n
    where o.event = $1 and coalesce(o.email, '') <> '' and n.event = $2 and lower(n.email) = lower(o.email)$q$, t) using f, dest;
  execute format('update %I set event = $2 where event = $1', t) using f, dest;
end
$fn$;

begin;
select pg_temp.move_company_edition('sponsors', 'sponsorId', 'World Pharma AI London 2026', 'World Pharma AI London 2027');
select pg_temp.move_company_edition('partners', 'partnerId', 'World Pharma AI London 2026', 'World Pharma AI London 2027');
select pg_temp.move_person_edition('delegates', 'delegateId', 'World Pharma AI London 2026', 'World Pharma AI London 2027');
select pg_temp.move_person_edition('speakers', 'speakerId', 'World Pharma AI London 2026', 'World Pharma AI London 2027');
update marketing_content set edition = 'World Pharma AI London 2027' where edition = 'World Pharma AI London 2026';
update marketing_tracking o set edition = 'World Pharma AI London 2027'
where edition = 'World Pharma AI London 2026'
  and not exists (select 1 from marketing_tracking n where n.kind = o.kind and n.ref = o.ref and n.edition = 'World Pharma AI London 2027');
update agendas set edition = 'World Pharma AI London 2027'
where edition = 'World Pharma AI London 2026'
  and not exists (select 1 from agendas where edition = 'World Pharma AI London 2027');
commit;
