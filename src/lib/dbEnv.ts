// Where the CRM's data lives, read from the environment.
//
//   NEXT_PUBLIC_SUPABASE_URL       the Supabase project
//   SUPABASE_SERVICE_ROLE_KEY      that project's service_role (secret) key
//   CRM_DB_SCHEMA                  where the CRM's tables are in that project:
//                                    unset or "public"  the CRM's own project (as it has always been)
//                                    "crm"              the Nexus project, after the move
//                                                       (Nexus migration 0060_crm_schema.sql)
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  only ever used on "public" when there is no
//                                  service key, as before. Never on "crm": the
//                                  Nexus project must only be reached with the
//                                  service role.
//
// Nothing is imported here so that next.config.ts can use the same rules and
// stop a build whose settings could never work, and ask the project itself
// whether it takes the key (remoteProblem).

export type DbSchema = 'public' | 'crm'
export type KeyKind = 'service' | 'public' | 'unknown'

export interface DbEnv {
  url: string
  key: string
  schema: DbSchema
  /** Which environment variable the key came from. */
  keySource: 'SUPABASE_SERVICE_ROLE_KEY' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
}

export class DbEnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DbEnvError'
  }
}

type Env = Record<string, string | undefined>

const clean = (v: string | undefined) => (v ?? '').trim()

/**
 * The project URL as set now. Read through `env` rather than as
 * process.env.NEXT_PUBLIC_SUPABASE_URL, which Next.js would freeze at build
 * time, so every part of the CRM sees the same value.
 */
export function supabaseUrlSetting(env: Env = process.env): string {
  return clean(env.NEXT_PUBLIC_SUPABASE_URL)
}

/** The schema setting as written, for reports. */
export function rawSchema(env: Env = process.env): string {
  return clean(env.CRM_DB_SCHEMA) || 'public'
}

export function schemaFromEnv(env: Env = process.env): DbSchema {
  const raw = clean(env.CRM_DB_SCHEMA).toLowerCase()
  if (!raw || raw === 'public') return 'public'
  if (raw === 'crm') return 'crm'
  throw new DbEnvError(
    `CRM_DB_SCHEMA is set to "${clean(env.CRM_DB_SCHEMA)}". Leave it unset to use the CRM's own Supabase project, ` +
      'or set it to crm once the data has moved into the Nexus project.'
  )
}

function jwtClaims(key: string): Record<string, unknown> | null {
  const parts = key.split('.')
  if (parts.length !== 3) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const claims = JSON.parse(json)
    return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Whether a Supabase key is a server (service role / secret) key or a public one. */
export function keyKind(key: string): KeyKind {
  if (key.startsWith('sb_secret_')) return 'service'
  if (key.startsWith('sb_publishable_')) return 'public'
  const role = jwtClaims(key)?.role
  if (role === 'service_role') return 'service'
  if (role === 'anon' || role === 'authenticated') return 'public'
  return 'unknown'
}

// The project a legacy (JWT) key belongs to, and the project a
// https://<ref>.supabase.co address points at, when both can be told.
function keyProject(key: string): string | null {
  const ref = jwtClaims(key)?.ref
  return typeof ref === 'string' && ref ? ref : null
}
function urlProject(url: string): string | null {
  try {
    const host = new URL(url).hostname
    const m = host.match(/^([a-z0-9]+)\.supabase\.(co|in)$/i)
    return m ? m[1].toLowerCase() : null
  } catch {
    return null
  }
}

/** Reads and checks the settings. Throws DbEnvError with what to fix. */
export function readDbEnv(env: Env = process.env): DbEnv {
  const schema = schemaFromEnv(env)
  const url = supabaseUrlSetting(env)
  const serviceKey = clean(env.SUPABASE_SERVICE_ROLE_KEY)

  if (schema === 'public') {
    // Exactly as before the move: the service key, else the anon key.
    const key = serviceKey || clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    if (!url || !key) {
      throw new DbEnvError('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars')
    }
    return { url, key, schema, keySource: serviceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY' }
  }

  // schema "crm": the Nexus project, service role only.
  if (!url) {
    throw new DbEnvError('CRM_DB_SCHEMA is crm but NEXT_PUBLIC_SUPABASE_URL is not set. Set it to the Nexus Supabase project URL.')
  }
  if (!serviceKey) {
    throw new DbEnvError(
      'CRM_DB_SCHEMA is crm but SUPABASE_SERVICE_ROLE_KEY is not set. Set it to the Nexus project\'s service_role (secret) key. ' +
        'The CRM never uses the public anon key on the Nexus project.'
    )
  }
  if (keyKind(serviceKey) === 'public') {
    throw new DbEnvError(
      'SUPABASE_SERVICE_ROLE_KEY holds a public (anon or publishable) key. With CRM_DB_SCHEMA=crm it must be the Nexus ' +
        'project\'s service_role (secret) key, from Supabase → Project Settings → API keys.'
    )
  }
  const fromKey = keyProject(serviceKey)
  const fromUrl = urlProject(url)
  if (fromKey && fromUrl && fromKey !== fromUrl) {
    throw new DbEnvError(
      `SUPABASE_SERVICE_ROLE_KEY belongs to Supabase project ${fromKey}, but NEXT_PUBLIC_SUPABASE_URL points at project ${fromUrl}. ` +
        'Both must be the Nexus project\'s.'
    )
  }
  return { url, key: serviceKey, schema, keySource: 'SUPABASE_SERVICE_ROLE_KEY' }
}

/**
 * Settings that must stop the CRM from building or starting: an unknown
 * CRM_DB_SCHEMA, or CRM_DB_SCHEMA=crm without everything it needs. With
 * CRM_DB_SCHEMA unset (or "public") nothing is checked here, so the CRM
 * builds and starts exactly as it did before the move.
 */
export function startupProblem(env: Env = process.env): string | null {
  try {
    if (schemaFromEnv(env) === 'public') return null
    readDbEnv(env)
    return null
  } catch (e) {
    return e instanceof DbEnvError ? e.message : String(e)
  }
}

// ── What the database's answers mean ───────────────────────────────────────

const MIGRATION_0060 = 'supabase/migrations/0060_crm_schema.sql'

/** What to tell a person when the database is not set up for the CRM. */
export const DB_MESSAGES = {
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
}

export type DbError = { code?: string | null; message?: string | null } | null | undefined

/**
 * A plain explanation for a database answer that means it is not set up for
 * the CRM (schema not exposed, tables missing in Nexus, wrong key), or null
 * for any other answer.
 */
export function explainDbError(err: DbError, schema: DbSchema): string | null {
  if (!err) return null
  const code = String(err.code ?? '')
  const message = String(err.message ?? '')
  if (code === 'PGRST106') {
    return schema === 'crm' ? DB_MESSAGES.notExposed : `The Supabase project does not expose the ${schema} schema to its API.`
  }
  if (code === 'PGRST301' || code === 'PGRST302' || /invalid api key/i.test(message)) return DB_MESSAGES.badKey
  if (schema === 'crm') {
    if (code === '42501') return DB_MESSAGES.noAccess
    if (code === '42P01' || code === 'PGRST205') return DB_MESSAGES.run0060
  }
  return null
}

/**
 * For the build, with CRM_DB_SCHEMA=crm: reads one row of crm.speakers the
 * way the CRM will, to learn whether the project takes the key and has the
 * crm schema ready. The settings alone cannot always tell: a new sb_secret_
 * key, or a legacy key without a ref, does not say which project it
 * belongs to. Returns what to fix when the project clearly says no. Returns
 * null when it answers, and also when it cannot be reached or gives any other
 * answer, so that a network problem never stops a deployment.
 */
export async function remoteProblem(env: Env = process.env, timeoutMs = 10000): Promise<string | null> {
  let db: DbEnv
  try {
    db = readDbEnv(env)
  } catch {
    return null // startupProblem reports these
  }
  if (db.schema !== 'crm') return null
  let res: Response
  try {
    res = await fetch(new URL('rest/v1/speakers?select=id&limit=1', db.url.endsWith('/') ? db.url : `${db.url}/`), {
      headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, Accept: 'application/json', 'Accept-Profile': 'crm' },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    console.warn(`CRM database settings: could not reach ${db.url} to check the key (${e instanceof Error ? e.message : e}). Building anyway.`)
    return null
  }
  if (res.ok) return null
  const body = (await res.json().catch(() => null)) as DbError
  const problem = explainDbError(body, 'crm') ?? (res.status === 401 || res.status === 403 ? DB_MESSAGES.badKey : null)
  if (!problem) console.warn(`CRM database settings: ${db.url} answered ${res.status} when checking the key. Building anyway.`)
  return problem
}
