import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { keyKind, readDbEnv, rawSchema, schemaFromEnv, supabaseUrlSetting, DbEnvError, type DbEnv, type DbSchema } from './dbEnv'

const serviceKeySetting = () => (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

// The CRM's one database client. Every read and write in the app goes
// through it, so the schema set here (CRM_DB_SCHEMA, see dbEnv.ts) applies
// to all of them: "public" in the CRM's own Supabase project, as before, or
// "crm" in the Nexus project after the move.

/** Every table the CRM uses. */
export const CRM_TABLES = [
  'delegates', 'speakers', 'sponsors', 'partners', 'activities', 'staged_contacts', 'marketing_tracking', 'agendas',
] as const

/** Error code of the answers made up here when the database is not set up for the CRM. */
export const SETUP_ERROR_CODE = 'CRM_DB_SETUP'

// ── What to tell a person when the database is not set up ──────────────────

const MIGRATION_0060 = 'supabase/migrations/0060_crm_schema.sql'

const MESSAGES = {
  notExposed:
    'The Nexus database is not letting its API see the crm schema yet. In the Nexus Supabase project open ' +
    'Project Settings → Data API (Settings → API on older dashboards), add crm to Exposed schemas, save, then reload the CRM.',
  noAccess:
    'The Nexus database refused the CRM access to the crm schema. SUPABASE_SERVICE_ROLE_KEY must be the Nexus ' +
    `project's service_role (secret) key, and Nexus migration ${MIGRATION_0060} must have been run.`,
  run0060:
    `The CRM's tables are not in the Nexus database yet. Run ${MIGRATION_0060} (from the Nexus repository) ` +
    "in the Nexus project's SQL editor.",
  badKey:
    'The database did not accept the CRM\'s Supabase key. Check that SUPABASE_SERVICE_ROLE_KEY is the service_role ' +
    'key of the same project as NEXT_PUBLIC_SUPABASE_URL.',
  wrongDatabase:
    "NEXT_PUBLIC_SUPABASE_URL points at a project whose public schema does not hold the CRM's tables. If it is the " +
    'Nexus project, set CRM_DB_SCHEMA=crm and redeploy. Nothing has been read or changed there.',
}

type DbError = { code?: string | null; message?: string | null } | null | undefined

function currentSchema(): DbSchema {
  try {
    return schemaFromEnv()
  } catch {
    return 'public'
  }
}

/**
 * A plain explanation for an error that means the database is not set up
 * for the CRM (schema not exposed, tables missing in Nexus, wrong key), or
 * null for any other error, which callers handle as they always have.
 */
export function describeDbError(err: DbError, schema: DbSchema = currentSchema()): string | null {
  if (!err) return null
  const code = String(err.code ?? '')
  const message = String(err.message ?? '')
  if (code === SETUP_ERROR_CODE) return message
  if (code === 'PGRST106') {
    return schema === 'crm' ? MESSAGES.notExposed : `The Supabase project does not expose the ${schema} schema to its API.`
  }
  if (code === 'PGRST301' || code === 'PGRST302' || /invalid api key/i.test(message)) return MESSAGES.badKey
  if (schema === 'crm') {
    if (code === '42501') return MESSAGES.noAccess
    if (code === '42P01' || code === 'PGRST205') return MESSAGES.run0060
  }
  return null
}

const PUBLIC_MIGRATION_HINTS: Partial<Record<(typeof CRM_TABLES)[number], string>> = {
  agendas: 'The agendas table is missing — run supabase/migrations/008_agendas.sql in the Supabase SQL editor.',
  marketing_tracking: 'The tracking table is missing — run supabase/migrations/007_marketing_tracking.sql in the Supabase SQL editor.',
}

/** What to run when one of the CRM's tables is missing, for the database in use. */
export function missingTableHint(table: (typeof CRM_TABLES)[number]): string {
  if (currentSchema() === 'crm') return MESSAGES.run0060
  return PUBLIC_MIGRATION_HINTS[table] ?? `The ${table} table is missing — see supabase/schema.sql.`
}

/**
 * For the features that tell the admin about a one-time set-up step (the
 * agenda, marketing tracking): the step an error calls for — the database
 * not set up for the CRM, or an error naming the feature's table, taken as
 * that table missing — or null for any other error.
 */
export function setupHint(table: (typeof CRM_TABLES)[number], err: DbError): string | null {
  const setup = describeDbError(err)
  if (setup) return setup
  // A duplicate key names the table's constraint (agendas_pkey) but proves
  // the table is there: leave it to the caller's conflict handling.
  if (err?.code === '23505') return null
  return err?.message && err.message.includes(table) ? missingTableHint(table) : null
}

// ── Checking the database before the first request ──────────────────────────
//
// Before the CRM sends anything to a project it asks it once whether it
// holds the CRM's tables in the schema in use (speakers with a firstName
// column). The Nexus project has its own public.speakers, so a CRM pointed at
// Nexus without CRM_DB_SCHEMA=crm would otherwise read and even delete
// Nexus's speakers. A clear "not set up" answer stops every request with an
// explanation instead; any other trouble (the database slow or unreachable)
// lets requests through as before, and the check runs again next time.

type Probe = { verdict: 'ok' } | { verdict: 'unsure' } | { verdict: 'bad'; problem: string }

async function probe(restUrl: string, schema: DbSchema, requestHeaders: Headers): Promise<Probe> {
  const headers = new Headers({ Accept: 'application/json', 'Accept-Profile': schema })
  for (const name of ['apikey', 'authorization', 'x-client-info']) {
    const v = requestHeaders.get(name)
    if (v) headers.set(name, v)
  }
  let res: Response
  try {
    res = await fetch(`${restUrl}speakers?select=id,firstName&limit=1`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    return { verdict: 'unsure' }
  }
  if (res.ok) return { verdict: 'ok' }
  const body = (await res.json().catch(() => null)) as DbError
  const code = String(body?.code ?? '')
  // public: no speakers table, or one without the CRM's columns (Nexus's own).
  if (schema === 'public' && (code === '42703' || code === 'PGRST204' || code === '42P01' || code === 'PGRST205')) {
    return { verdict: 'bad', problem: MESSAGES.wrongDatabase }
  }
  const problem = describeDbError(body, schema)
  return problem ? { verdict: 'bad', problem } : { verdict: 'unsure' }
}

function setupErrorResponse(problem: string): Response {
  return new Response(JSON.stringify({ code: SETUP_ERROR_CODE, message: problem, details: null, hint: null }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

function checkedFetch(env: DbEnv): typeof fetch {
  const restUrl = new URL('rest/v1/', env.url.endsWith('/') ? env.url : `${env.url}/`).href
  let verified = false
  let pending: Promise<Probe> | null = null
  return async (input, init) => {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!verified && target.startsWith(restUrl)) {
      if (!pending) {
        pending = probe(restUrl, env.schema, new Headers(init?.headers))
          .catch((): Probe => ({ verdict: 'unsure' }))
          .then((p) => {
            if (p.verdict === 'ok') verified = true
            pending = null
            return p
          })
      }
      const p = await pending
      if (p.verdict === 'bad') {
        console.error(`CRM database: ${p.problem}`)
        return setupErrorResponse(p.problem)
      }
    }
    return fetch(input, init)
  }
}

// ── The client ──────────────────────────────────────────────────────────────

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    // Throws with what to set when the settings are incomplete — and, with
    // CRM_DB_SCHEMA=crm, whenever the service role key is missing: the CRM
    // never falls back to the public anon key on the Nexus project.
    const env = readDbEnv()
    _supabase = createClient(env.url, env.key, {
      db: { schema: env.schema },
      global: { fetch: checkedFetch(env) },
    }) as unknown as SupabaseClient
  }
  return _supabase
}

// Convenience getter for backward compat
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  },
})

// ── Status, for the health check and the notice in the app ─────────────────

export interface DbStatus {
  ok: boolean
  /** The settings are complete (for "crm": URL and service role key); false when the client cannot even be made. */
  configured: boolean
  /** The schema the CRM's tables are read from: "public" or "crm". */
  schema: string
  /** The Supabase project's address (host only), so a reader can tell the old project from Nexus. */
  project: string | null
  /** Which key the CRM uses: the service role key, the anon key (public only), or none. */
  key: 'service' | 'anon' | 'missing'
  problem: string | null
}

function hostOf(url: string): string | null {
  try {
    return url ? new URL(url).host : null
  } catch {
    return null
  }
}

/** Reads one row from every CRM table and reports the first thing wrong. */
export async function checkDatabase(): Promise<DbStatus> {
  const project = hostOf(supabaseUrlSetting())
  let env: DbEnv
  try {
    env = readDbEnv()
  } catch (e) {
    return {
      ok: false,
      configured: false,
      schema: rawSchema(),
      project,
      key: !serviceKeySetting() ? 'missing' : keyKind(serviceKeySetting()) === 'public' ? 'anon' : 'service',
      problem: e instanceof DbEnvError ? e.message : String(e),
    }
  }
  const status: Omit<DbStatus, 'ok' | 'problem'> = {
    configured: true,
    schema: env.schema,
    project,
    key: env.keySource === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service' : 'anon',
  }
  const client = getSupabase()
  const results = await Promise.all(
    CRM_TABLES.map(async (table) => ({ table, error: (await client.from(table).select('*').limit(1)).error }))
  )
  for (const { table, error } of results) {
    if (!error) continue
    const problem =
      describeDbError(error, env.schema) ??
      (error.code === '42P01' || error.code === 'PGRST205' ? missingTableHint(table) : `${table}: ${error.message}`)
    return { ...status, ok: false, problem }
  }
  return { ...status, ok: true, problem: null }
}
