# Nexus CRM (whai-database)

The World Nexus Group CRM: sales pipeline, sponsors, partners, speakers and delegates for every event, the marketing portal and the digital agenda. Next.js on Vercel, data in Supabase. The Nexus admin embeds it and talks to it over HTTP (registration, sponsor and inbox-note webhooks, staged contacts, duplicate checks, the agenda API).

## Marketing portal: Content

A LinkedIn post a day for an edition, drafted on the Content tab from what the group already holds: the published Insights briefings on worldnexusgroup.com, the edition's digital agenda (sessions and their questions), the line-up's speakers who agreed to a post, its sponsors, and the countdown to the date. Claude writes the card's words, the caption and the hashtags in the voice the event sites use; the CRM draws the card itself (1080 by 1080, World Health AI in its blue, World Pharma AI in its teal) so it always looks like the brand. Nothing is posted from here: the team copies the caption, saves the image, and marks the post as posted with its link.

Needs `ANTHROPIC_API_KEY` and the `marketing_content` table (`supabase/migrations/010_marketing_content.sql`, or `0063_crm_marketing_content.sql` from the Nexus repository once the CRM has moved there).

## Settings

Copy `.env.example` to `.env.local` for local work; on Vercel set the same names under Project → Settings → Environment Variables.

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project the CRM's data is in |
| `SUPABASE_SERVICE_ROLE_KEY` | That project's `service_role` (secret) key. Server-side only |
| `CRM_DB_SCHEMA` | Where the tables are in that project. Unset (or `public`): the CRM's own project, as it has always been. `crm`: the Nexus project, after the move below |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Only used when `CRM_DB_SCHEMA` is unset and there is no service key (the old behaviour). Never used with `CRM_DB_SCHEMA=crm`; delete it at the switch (step 7 below) |
| `WEBHOOK_SECRET` | Shared secret for the sites and the Nexus admin calling the CRM (same value as `CRM_WEBHOOK_SECRET` there) |
| `CRM_ACCESS_PASSWORD` | The CRM's login password |
| `NEXUS_SITE_URL`, `NEXUS_EVENTS_URL` | Where the Nexus admin is (defaults to worldnexusgroup.com) |
| `ANTHROPIC_API_KEY` | The Pulse assistant |

With `CRM_DB_SCHEMA=crm` the CRM **refuses to build or start** when `SUPABASE_SERVICE_ROLE_KEY` is missing, is an anon or publishable key, or names a different project from `NEXT_PUBLIC_SUPABASE_URL` (legacy keys name their project). The build also asks the project itself, and stops if it does not accept the key or does not have the `crm` schema ready (steps 1 and 2 below). On Vercel a refused build leaves the running deployment as it was. A build that cannot reach the project goes ahead, so always check the CRM after a redeploy (step 7 below).

## Moving the CRM's data into Nexus

The CRM's data moves out of its own Supabase project into the Nexus project, into a separate schema called `crm` (Nexus already has its own `speakers` and `sponsors` tables, which mean something else). The copy runs from the Nexus admin's **Move CRM** page; the CRM itself only has to be pointed at the new place. The steps below have the same numbers and names as the steps on that page. In order:

1. **Create the CRM's tables in Nexus.** In Supabase → the Nexus project → SQL editor, run `supabase/migrations/0060_crm_schema.sql` from the Nexus repository. It creates the `crm` schema with every CRM table, reachable only with the service role.
2. **Let the API see them.** Supabase → the Nexus project → Project Settings → Data API (Settings → API on older dashboards) → Exposed schemas: add `crm`, save. While you are there, check that Max rows is at least what the CRM's own project uses (1000 is the usual; the CRM reads some tables whole).
3. **Connect the CRM's own project.** On the Nexus admin's Vercel project, set `CRM_SUPABASE_URL` (the CRM's own, old, project URL, `https://<ref>.supabase.co` without `/rest/v1`) and `CRM_SUPABASE_SERVICE_ROLE_KEY` (that project's service role key), then redeploy the Nexus admin.
4. **Compare the structure.** If the page gives SQL, run it in the Nexus project's SQL editor, then press **Compare again**. Copy stays off until Compare is clean.
   - The Supabase API does not show JSON defaults (such as `'{}'`), so Compare's SQL cannot include them. After running it, give each column that Compare says may have one the same default as in the old project: `alter table crm.<table> alter column <column> set default …;`.
5. **Copy everything** (**Run**).
6. **Records check** (**Check**). Carry on only when it says "Safe to switch the CRM to Nexus."
7. **Point the CRM at Nexus.** Four parts, in this order:
   1. In this repository's Vercel project → Settings → Environment Variables, first note down the current values (you need them to go back). Then change these for **both Production and Preview** (otherwise preview deployments keep writing to the old project):
      - `NEXT_PUBLIC_SUPABASE_URL` = the **Nexus** project's URL
      - `SUPABASE_SERVICE_ROLE_KEY` = the **Nexus** project's `service_role` (secret) key (the same value as `SUPABASE_SERVICE_ROLE_KEY` on the Nexus admin's Vercel project)
      - `CRM_DB_SCHEMA` = `crm`
      - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: delete it. The CRM never uses it on Nexus, and a rollback uses the old project's service role key instead (see below).
   2. **Redeploy the CRM** (Deployments → the latest → Redeploy). Environment changes only take effect in a new deployment.
   3. **Check the switch.** Log in to the CRM and check the delegates list loads. Then open `/api/webhooks/register`: `database.schema` should be `crm`, `database.project` the Nexus project's address and `database.ok` true. If anything is wrong, a red notice at the top of every CRM screen says what to fix. (`database.unavailable` means the database did not answer just then: reload.)
   4. **Confirm it on the Move CRM page:** under step 7, press **The CRM now runs on Nexus**. Do this before you run anything else on that page. Until it is confirmed, the page still treats Nexus as a copy of the old project, so the records the CRM now adds and changes in Nexus show up there as differences. Never remove or overwrite those: they are the CRM's new work.
8. **Copy again, to catch up** (**Run** under step 8). It brings over anything written to the old project while you were switching.
9. **Records check again** (**Check** under step 9).
10. **Retire the old project.** Only when step 9 is green: pause the CRM's old Supabase project (that project → Project Settings → General → Pause project) and keep it paused for a few weeks. If nothing turns out to be missing, delete it, then remove `CRM_SUPABASE_URL` and `CRM_SUPABASE_SERVICE_ROLE_KEY` from the Nexus admin's Vercel project and redeploy it.

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
3. Redeploy the CRM. `/api/webhooks/register` should then show `database.schema` `public` and the old project's address.
4. In the Nexus admin → Move CRM, press **Undo** under step 7, so the page and Nexus's "Add to CRM" fallback treat the old project as the CRM's again.

The copy only runs from the old project into Nexus, so anything added or changed in the CRM after the switch is not in the old project. Note it down or re-enter it after rolling back.

### After the move

- The CRM's tables are defined by the Nexus migrations now. A change to them (a new column, say) goes into a new Nexus migration against `crm.<table>`.
- Never run this repository's `supabase/schema.sql` or `supabase/migrations/*` in the Nexus project: they create tables in `public`. They describe the old project only.
- Nexus keeps calling the CRM over HTTP exactly as before (webhooks, staged contacts, duplicate checks, agenda); nothing changes on that side. Its "Add to CRM" fallback, used when the CRM cannot be reached, writes to `crm.staged_contacts` once step 7 is confirmed, and keeps working after step 10.

## Development

```bash
npm ci
cp .env.example .env.local   # then fill it in
npm run dev
```

Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
