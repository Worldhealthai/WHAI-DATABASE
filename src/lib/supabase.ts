import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  DB_MESSAGES,
  explainDbError,
  keyKind,
  readDbEnv,
  rawSchema,
  schemaFromEnv,
  supabaseUrlSetting,
  DbEnvError,
  type DbEnv,
  type DbError,
  type DbSchema,
} from './dbEnv'

const serviceKeySetting = () => (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

// The CRM's one database client. Every read and write in the app goes
// through it, so the schema set here (CRM_DB_SCHEMA, see dbEnv.ts) applies
// to all of them: "public" in the CRM's own Supabase project, as before, or
// "crm" in the Nexus project after the move.

/** Every table the CRM uses. */
export const CRM_TABLES = [
  'delegates', 'speakers', 'sponsors', 'partners', 'activities', 'staged_contacts', 'marketing_tracking', 'agendas',
] as const

/**
 * Tables that later migrations of the CRM's own project added for one
 * feature each (007 marketing tracking, 008 agendas). An older project may
 * never have run them; the feature then explains the step on its own screen,
 * and the rest of the CRM works as usual.
 */
const OPTIONAL_TABLES: ReadonlySet<string> = new Set(['marketing_tracking', 'agendas'])

/** Error code of the answers made up here when the database is not set up for the CRM. */
export const SETUP_ERROR_CODE = 'CRM_DB_SETUP'

/** Error code of a change refused because the database could not be checked just then. */
export const UNCHECKED_ERROR_CODE = 'CRM_DB_UNCHECKED'

// ── What to tell a person ──────────────────────────────────────────────────

const MESSAGES = {
  ...DB_MESSAGES,
  wrongDatabase:
    "NEXT_PUBLIC_SUPABASE_URL points at a project whose public schema does not hold the CRM's tables. If it is the " +
    'Nexus project, set CRM_DB_SCHEMA=crm and redeploy. Nothing has been changed there.',
  unchecked: 'The CRM could not reach its database to check it just now, so nothing was changed. Try again in a moment.',
}

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
  if (err && String(err.code ?? '') === SETUP_ERROR_CODE) return String(err.message ?? '')
  return explainDbError(err, schema)
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

// ── Checking the database before changing anything ──────────────────────────
//
// The CRM asks a project whether it holds the CRM's tables in the schema in
// use (speakers with a firstName column). The Nexus project has its own
// public.speakers, so a CRM pointed at Nexus without CRM_DB_SCHEMA=crm would
// otherwise change and even delete Nexus's speakers.
//
// A change (anything but GET or HEAD) is sent only once the project has been
// recognised. It waits for the check's answer however slow the database is.
// If there is no answer (the database unreachable, or silent for
// PROBE_TIMEOUT_MS), the change is refused with a "try again" error rather
// than sent to a database nobody has recognised.
//
// A read goes out at the same time as the check, so it costs no extra time.
// PostgREST runs GET and HEAD in a read-only transaction, so a read cannot
// change anything. If the check then says the project is the wrong one, the
// read's answer is dropped and the setup error is returned instead. A read
// waits for the check for READ_WAIT_MS at most, so a slow check never holds
// a read up for long; a read that itself takes longer waits for nothing more.
//
// A recognised project is not checked again for the life of the server
// instance. Any other answer is not remembered: the next request checks again.

type Probe =
  | { verdict: 'ok' }
  | { verdict: 'bad'; problem: string }
  // quick: the database answered or dropped the connection at once (a 5xx, a
  // reset) rather than timing out, so asking once more is cheap.
  | { verdict: 'unsure'; quick: boolean }

// The check gives up after this; a database that says nothing for so long
// is taken as unreachable.
const PROBE_TIMEOUT_MS = 30000
const READ_WAIT_MS = 5000

/** The check's answer, or "unsure" once `ms` have passed without one. */
function within(check: Promise<Probe>, ms: number): Promise<Probe> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<Probe>((resolve) => {
    timer = setTimeout(() => resolve({ verdict: 'unsure', quick: false }), ms)
  })
  return Promise.race([check, late]).finally(() => clearTimeout(timer))
}

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
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
  } catch (e) {
    return { verdict: 'unsure', quick: (e as { name?: string } | null)?.name !== 'TimeoutError' }
  }
  if (res.ok) {
    await res.arrayBuffer().catch(() => null) // one short row; reading it frees the connection
    return { verdict: 'ok' }
  }
  const body = (await res.json().catch(() => null)) as DbError
  const code = String(body?.code ?? '')
  // public: no speakers table, or one without the CRM's columns (Nexus's own).
  if (schema === 'public' && (code === '42703' || code === 'PGRST204' || code === '42P01' || code === 'PGRST205')) {
    return { verdict: 'bad', problem: MESSAGES.wrongDatabase }
  }
  const problem = describeDbError(body, schema)
  return problem ? { verdict: 'bad', problem } : { verdict: 'unsure', quick: true }
}

function errorResponse(code: string, message: string): Response {
  return new Response(JSON.stringify({ code, message, details: null, hint: null }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

function refuse(p: Probe): Response {
  const [code, message] = p.verdict === 'bad' ? [SETUP_ERROR_CODE, p.problem] : [UNCHECKED_ERROR_CODE, MESSAGES.unchecked]
  console.error(`CRM database: ${message}`)
  return errorResponse(code, message)
}

function checkedFetch(env: DbEnv): typeof fetch {
  const restUrl = new URL('rest/v1/', env.url.endsWith('/') ? env.url : `${env.url}/`).href
  let verified = false
  let pending: Promise<Probe> | null = null
  // One check at a time, shared by every request that arrives meanwhile.
  const check = (headers: Headers): Promise<Probe> => {
    if (!pending) {
      pending = probe(restUrl, env.schema, headers)
        .catch((): Probe => ({ verdict: 'unsure', quick: false }))
        .then((p) => {
          if (p.verdict === 'ok') verified = true
          pending = null
          return p
        })
    }
    return pending
  }
  return async (input, init) => {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (verified || !target.startsWith(restUrl)) return fetch(input, init)
    const headers = new Headers(init?.headers)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

    if (method === 'GET' || method === 'HEAD') {
      const [p, sent] = await Promise.all([
        within(check(headers), READ_WAIT_MS),
        fetch(input, init).then(
          (res) => ({ res }),
          (error: unknown) => ({ error })
        ),
      ])
      if (p.verdict === 'bad') {
        // Not awaited: Next.js may hand back one branch of a split body, whose
        // cancel only settles once the other branch is done with.
        if ('res' in sent) sent.res.body?.cancel().catch(() => {})
        return refuse(p)
      }
      if ('error' in sent) throw sent.error
      return sent.res
    }

    let p = await check(headers)
    if (p.verdict === 'unsure' && p.quick) p = await check(headers)
    return p.verdict === 'ok' ? fetch(input, init) : refuse(p)
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
  /** Every table the CRM needs answered. */
  ok: boolean
  /** The settings are complete (for "crm": URL and service role key); false when the client cannot even be made. */
  configured: boolean
  /** The schema the CRM's tables are read from: "public" or "crm". */
  schema: string
  /** The Supabase project's address (host only), so a reader can tell the old project from Nexus. */
  project: string | null
  /** Which key the CRM uses: the service role key, the anon key (public only), or none. */
  key: 'service' | 'anon' | 'missing'
  /** Something in the set-up to put right. The app shows it at the top of every screen. */
  problem: string | null
  /** An optional feature's table is missing (the CRM's own project only). That feature says so on its own screen. */
  warnings: string[]
  /**
   * The database did not answer properly just now (a dropped connection, a
   * timeout, a server error). This says nothing about the set-up, and the
   * next check asks again.
   */
  unavailable: string | null
}

function hostOf(url: string): string | null {
  try {
    return url ? new URL(url).host : null
  } catch {
    return null
  }
}

/** Reads one row from every CRM table and reports what is wrong, if anything. */
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
      warnings: [],
      unavailable: null,
    }
  }
  const status = {
    configured: true,
    schema: env.schema,
    project,
    key: env.keySource === 'SUPABASE_SERVICE_ROLE_KEY' ? ('service' as const) : ('anon' as const),
  }
  const client = getSupabase()
  const results = await Promise.all(
    CRM_TABLES.map(async (table) => ({ table, error: (await client.from(table).select('*').limit(1)).error }))
  )
  const warnings: string[] = []
  let unavailable: string | null = null
  for (const { table, error } of results) {
    if (!error) continue
    // On crm a missing table is a setup problem already (0060 not run).
    const problem = describeDbError(error, env.schema)
    if (problem) return { ...status, ok: false, problem, warnings, unavailable: null }
    if (error.code === '42P01' || error.code === 'PGRST205') {
      if (OPTIONAL_TABLES.has(table)) {
        warnings.push(missingTableHint(table))
        continue
      }
      return { ...status, ok: false, problem: missingTableHint(table), warnings, unavailable: null }
    }
    unavailable ??= `${table}: ${error.message}`
  }
  return { ...status, ok: !unavailable, problem: null, warnings, unavailable }
}
