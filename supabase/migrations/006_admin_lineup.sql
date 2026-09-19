-- Marketing CRM: which speakers are on the admin panel's line-up.
--
-- The speakers table also holds everyone still being invited. The admin
-- panel's approved speakers are the real line-up; they arrive here flagged
-- (on approval, and from "Sync from admin panel" in the Marketing portal).
alter table speakers add column if not exists "adminLineup" boolean not null default false;
create index if not exists idx_speakers_admin_lineup on speakers("adminLineup");
