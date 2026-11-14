-- Which Control Room agent found a sponsor or speaker lead (November 2026).
-- Control Room's "Add to CRM" posts to /api/agent/intake with the agent's
-- name; the record keeps it, so Tools → Agents' work and the filters can
-- say where each lead came from. agent is Control Room's own name for it
-- ("bumble"), agentName the name people see ("Bumble - WHAI Sales").
-- Applied to the live database on 14 November 2026.
alter table crm.sponsors add column if not exists agent text, add column if not exists "agentName" text, add column if not exists "agentAddedAt" timestamptz;
alter table crm.speakers add column if not exists agent text, add column if not exists "agentName" text, add column if not exists "agentAddedAt" timestamptz;
create index if not exists sponsors_agent_idx on crm.sponsors (agent) where agent is not null;
create index if not exists speakers_agent_idx on crm.speakers (agent) where agent is not null;
