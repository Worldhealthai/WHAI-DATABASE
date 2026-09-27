# Nexus CRM (whai-database)

The World Nexus Group CRM: sales pipeline, sponsors, partners, speakers and delegates for every event, the marketing portal and the digital agenda. Next.js on Vercel, data in Supabase. The Nexus admin embeds it and talks to it over HTTP (registration, sponsor and inbox-note webhooks, staged contacts, duplicate checks, the agenda API).

## Settings

Copy `.env.example` to `.env.local` for local work; on Vercel set the same names under Project → Settings → Environment Variables.

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project the CRM's data is in |
| `SUPABASE_SERVICE_ROLE_KEY` | That project's `service_role` (secret) key. Server-side only |
| `CRM_DB_SCHEMA` | Where the tables are in that project. Unset (or `public`): the CRM's own project, as it has always been. `crm`: the Nexus project, after the move below |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Only used when `CRM_DB_SCHEMA` is unset and there is no service key (the old behaviour). Never used with `CRM_DB_SCHEMA=crm`; delete it at the switch (step 5 below) |
| `WEBHOOK_SECRET` | Shared secret for the sites and the Nexus admin calling the CRM (same value as `CRM_WEBHOOK_SECRET` there) |
| `CRM_ACCESS_PASSWORD` | The CRM's login password |
| `NEXUS_SITE_URL`, `NEXUS_EVENTS_URL` | Where the Nexus admin is (defaults to worldnexusgroup.com) |
| `ANTHROPIC_API_KEY` | The Pulse assistant |

With `CRM_DB_SCHEMA=crm` the CRM **refuses to build or start** when `SUPABASE_SERVICE_ROLE_KEY` is missing, is an anon or publishable key, or names a different project from `NEXT_PUBLIC_SUPABASE_URL` (legacy keys name their project). The build also asks the project itself, and stops if it does not accept the key or does not have the `crm` schema ready (steps 1 and 2 below). On Vercel a refused build leaves the running deployment as it was. A build that cannot reach the project goes ahead, so always check the CRM after a redeploy (step 7 below).

## Moving the CRM's data into Nexus

The CRM's data moves out of its own Supabase project into the Nexus project, into a separate schema called `crm` (Nexus already has its own `speakers` and `sponsors` tables, which mean something else). The copy runs from the Nexus admin's **Move CRM** page; the CRM itself only has to be pointed at the new place. In order:

1. **Nexus: run migration `supabase/migrations/0060_crm_schema.sql`** in the Nexus project's SQL editor. It creates the `crm` schema with every CRM table, reachable only with the service role.
2. **Nexus: expose the schema.** Supabase → the Nexus project → Project Settings → Data API (Settings → API on older dashboards) → Exposed schemas: add `crm`, save. While you are there, check that Max rows is at least what the CRM's own project uses (the CRM reads some tables whole).
3. **Nexus: set `CRM_SUPABASE_URL` and `CRM_SUPABASE_SERVICE_ROLE_KEY`** on the Nexus admin's Vercel project to the CRM's own (old) project, and redeploy the Nexus admin.
4. **Move CRM page: Compare** (its step 4). If it gives SQL, run it in the Nexus project's SQL editor and compare again. Then **Copy** (step 5), then **Records check** (step 6). Carry on only when the records check says it is safe to switch.
5. **Switch the CRM** (this repository's Vercel project), under Settings → Environment Variables. First note down the current values (you need them to go back). Then change these for **both Production and Preview** (otherwise preview deployments keep writing to the old project):
   - `NEXT_PUBLIC_SUPABASE_URL` = the **Nexus** project's URL
   - `SUPABASE_SERVICE_ROLE_KEY` = the **Nexus** project's `service_role` (secret) key
   - `CRM_DB_SCHEMA` = `crm`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: delete it. The CRM never uses it on Nexus, and a rollback uses the old project's service role key instead (see below).
6. **Redeploy the CRM** (Deployments → the latest → Redeploy). Environment changes only take effect in a new deployment.
7. **Check the switch.** Log in to the CRM and open `/api/webhooks/register`: `database.schema` should be `crm`, `database.project` the Nexus project's address and `database.ok` true. If anything is wrong, a red notice at the top of every CRM screen says what to fix. (`database.unavailable` means the database did not answer just then: reload.)
8. **Move CRM page: confirm the switch.** Under the page's step 7, press **The CRM now runs on Nexus**. Do this before you run anything else on that page. Until it is confirmed, the page still treats Nexus as a copy of the old project, so the records the CRM now adds and changes in Nexus show up there as differences. Never remove or overwrite those: they are the CRM's new work.
9. **Move CRM page: Copy again** (its step 8; catches anything written to the old project while you were switching), then **Records check again** (step 9).
10. **When step 9 is green, pause the old CRM project** and keep it paused for a few weeks, then delete it, and remove `CRM_SUPABASE_URL` and `CRM_SUPABASE_SERVICE_ROLE_KEY` from the Nexus admin (the page's step 10).

What the CRM tells you when something is missing:

| Notice | Meaning |
|---|---|
| "not letting its API see the crm schema" | Step 2 not done: add `crm` to Exposed schemas |
| "The CRM's tables are not in the Nexus database yet" | Step 1 not done: run 0060 |
| "refused the CRM access to the crm schema" / "did not accept the CRM's Supabase key" | `SUPABASE_SERVICE_ROLE_KEY` is not the Nexus project's service role key |
| "points at a project whose public schema does not hold the CRM's tables" | The URL is the Nexus project's but `CRM_DB_SCHEMA=crm` is missing. The CRM changes nothing in a project until it has recognised its own tables there, so Nexus's own tables are safe |
| "could not reach its database to check it just now" (on a save, or in a webhook's reply) | The database did not answer in time. Nothing was changed; try again. If it keeps happening, check the Supabase project's status |

### Rolling back

Until the old project is deleted you can go back:

1. Restore the old CRM project in Supabase if it is paused.
2. In the CRM's Vercel settings, for both Production and Preview:
   - `NEXT_PUBLIC_SUPABASE_URL` = the old project's URL (the value of `CRM_SUPABASE_URL` on the Nexus admin's Vercel project)
   - `SUPABASE_SERVICE_ROLE_KEY` = the old project's service role key (the value of `CRM_SUPABASE_SERVICE_ROLE_KEY` there)
   - **delete** `CRM_DB_SCHEMA`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` stays deleted: with the service role key set, the CRM does not use it.
3. Redeploy the CRM.
4. In the Nexus admin → Move CRM, press **Undo** under step 7, so the page and Nexus's "Add to CRM" fallback treat the old project as the CRM's again.

The copy only runs from the old project into Nexus, so anything added or changed in the CRM after the switch is not in the old project. Note it down or re-enter it after rolling back.

### After the move

- The CRM's tables are defined by the Nexus migrations now. A change to them (a new column, say) goes into a new Nexus migration against `crm.<table>`.
- Never run this repository's `supabase/schema.sql` or `supabase/migrations/*` in the Nexus project: they create tables in `public`. They describe the old project only.
- Nexus keeps calling the CRM over HTTP exactly as before (webhooks, staged contacts, duplicate checks, agenda); nothing changes on that side.

## Development

```bash
npm ci
cp .env.example .env.local   # then fill it in
npm run dev
```

Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
