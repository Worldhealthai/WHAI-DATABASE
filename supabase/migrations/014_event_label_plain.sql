-- One spelling for an event in the CRM (November 2026): "World Pharma AI
-- London 2027". The Nexus admin writes editions as "World Pharma AI · London
-- · 2027", and records saved that way became a second, look-alike event: the
-- same company twice on a board, two "London 2027" tabs on its record. Every
-- insert or change of an event is written in the plain form.
create or replace function crm.plain_event_label() returns trigger
language plpgsql as $$
begin
  if new.event is not null then
    new.event := btrim(regexp_replace(new.event, '\s*·\s*', ' ', 'g'));
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['sponsors', 'speakers', 'delegates', 'partners'] loop
    execute format('drop trigger if exists plain_event_label on crm.%I', t);
    execute format('create trigger plain_event_label before insert or update of event on crm.%I for each row execute function crm.plain_event_label()', t);
    execute format($q$update crm.%I set event = btrim(regexp_replace(event, '\s*·\s*', ' ', 'g')) where event like '%%·%%'$q$, t);
  end loop;
end $$;
