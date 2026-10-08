// Posting the Content tab's posts to the company pages on LinkedIn, through
// LinkedIn's own API (the Community Management API, free once LinkedIn has
// approved the app). Server side only.
//
// Setup, once:
//   1. A LinkedIn app (developer.linkedin.com) with the Community Management
//      API product approved, and this CRM's callback as an authorised
//      redirect URL: https://<crm>/api/linkedin/callback
//   2. LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in the CRM's Vercel
//      environment, and migration 012 run.
//   3. "Connect LinkedIn" on the Content tab, signed in as an admin of the
//      pages, then a page chosen for each brand.
// Then "Approve and post" on a draft puts it up: a single post as an image,
// a carousel as a document (a PDF, which LinkedIn shows as swipeable pages).
//
// LinkedIn's access token lasts about two months. When it lapses (and no
// refresh token came with it), the tab says so and "Connect LinkedIn" again
// renews it.

import { supabase } from '@/lib/supabase'
import type { BrandKey } from '@/lib/contentBrand'

const AUTH = 'https://www.linkedin.com/oauth/v2'
const API = 'https://api.linkedin.com/rest'

export class LinkedInError extends Error {
  status: number
  reconnect: boolean
  constructor(message: string, status = 400, reconnect = false) {
    super(message)
    this.status = status
    this.reconnect = reconnect
  }
}

const clientId = () => (process.env.LINKEDIN_CLIENT_ID || '').trim()
const clientSecret = () => (process.env.LINKEDIN_CLIENT_SECRET || '').trim()
export const linkedinConfigured = () => Boolean(clientId() && clientSecret())

// Posting as a company page, reading its posts, and listing the pages the
// signed-in member administers.
export const scopes = () => (process.env.LINKEDIN_SCOPES || 'w_organization_social r_organization_social rw_organization_admin').trim()

// LinkedIn's API is versioned by month (YYYYMM) and each version lives about
// a year. Two months back is always a live one; LINKEDIN_VERSION pins it.
export function apiVersion(now = new Date()): string {
  const pinned = (process.env.LINKEDIN_VERSION || '').trim()
  if (/^\d{6}$/.test(pinned)) return pinned
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1))
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export const redirectUri = (origin: string) => (process.env.LINKEDIN_REDIRECT_URI || '').trim() || `${origin.replace(/\/+$/, '')}/api/linkedin/callback`

export function authUrl(state: string, origin: string): string {
  const q = new URLSearchParams({ response_type: 'code', client_id: clientId(), redirect_uri: redirectUri(origin), state, scope: scopes() })
  return `${AUTH}/authorization?${q}`
}

// ── The stored connection ──────────────────────────────────────────────────

export interface LinkedInPage { urn: string; name: string }
export interface Connection {
  access_token: string
  refresh_token: string | null
  expires_at: string
  refresh_expires_at: string | null
  scope: string | null
  pages: LinkedInPage[]
  page_for: Partial<Record<BrandKey, string>>
  pages_error: string | null
  connectedAt: string
}

export async function getConnection(): Promise<Connection | null> {
  const { data, error } = await supabase.from('linkedin_connection').select('*').eq('id', 'default').maybeSingle()
  if (error) throw error
  return (data as Connection | null) ?? null
}

interface TokenAnswer { access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number; scope?: string }

async function token(params: Record<string, string>): Promise<TokenAnswer> {
  const r = await fetch(`${AUTH}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: clientId(), client_secret: clientSecret() }),
    cache: 'no-store',
  })
  const j = (await r.json().catch(() => ({}))) as TokenAnswer & { error_description?: string; error?: string }
  if (!r.ok || !j.access_token) throw new LinkedInError(`LinkedIn did not give a token: ${j.error_description || j.error || r.status}`, 502, true)
  return j
}

const stamp = (secs?: number) => (secs ? new Date(Date.now() + secs * 1000).toISOString() : null)

// After "Connect LinkedIn": the code for a token, the pages it may post to,
// and a first guess at which page is which brand's (by name).
export async function connect(code: string, origin: string): Promise<Connection> {
  const t = await token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(origin) })
  let pages: LinkedInPage[] = []
  let pagesError: string | null = null
  try {
    pages = await adminPages(t.access_token)
  } catch (e) {
    pagesError = e instanceof Error ? e.message : String(e)
  }
  const prev = await getConnection().catch(() => null)
  const row = {
    id: 'default',
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? null,
    expires_at: stamp(t.expires_in) ?? new Date(Date.now() + 50 * 86400000).toISOString(),
    refresh_expires_at: stamp(t.refresh_token_expires_in),
    scope: t.scope ?? null,
    pages,
    page_for: guessPages(pages, prev?.page_for ?? {}),
    pages_error: pagesError,
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('linkedin_connection').upsert(row).select('*').single()
  if (error) throw error
  return data as Connection
}

function guessPages(pages: LinkedInPage[], kept: Partial<Record<BrandKey, string>>): Partial<Record<BrandKey, string>> {
  const out: Partial<Record<BrandKey, string>> = {}
  const find = (word: string) => pages.find((p) => p.name.toLowerCase().includes(word))?.urn
  for (const [brand, word] of [['health', 'health'], ['pharma', 'pharma'], ['nexus', 'nexus']] as [BrandKey, string][]) {
    const keep = kept[brand] && pages.some((p) => p.urn === kept[brand]) ? kept[brand] : undefined
    const urn = keep ?? find(word)
    if (urn) out[brand] = urn
  }
  return out
}

export async function setPageFor(pageFor: Partial<Record<BrandKey, string>>): Promise<Connection> {
  const cur = await getConnection()
  if (!cur) throw new LinkedInError('Connect LinkedIn first.', 409, true)
  const clean: Partial<Record<BrandKey, string>> = {}
  for (const b of ['health', 'pharma', 'nexus'] as BrandKey[]) {
    const urn = pageFor[b]
    if (urn && cur.pages.some((p) => p.urn === urn)) clean[b] = urn
  }
  const { data, error } = await supabase.from('linkedin_connection').update({ page_for: clean, updatedAt: new Date().toISOString() }).eq('id', 'default').select('*').single()
  if (error) throw error
  return data as Connection
}

export async function disconnect(): Promise<void> {
  const { error } = await supabase.from('linkedin_connection').delete().eq('id', 'default')
  if (error) throw error
}

// A token good for the next few minutes: the stored one, or a refreshed
// one when LinkedIn gave a refresh token; otherwise "connect again".
async function liveToken(): Promise<{ token: string; conn: Connection }> {
  const conn = await getConnection()
  if (!conn) throw new LinkedInError('LinkedIn is not connected. Use "Connect LinkedIn" at the top of the Content tab.', 409, true)
  if (Date.parse(conn.expires_at) - Date.now() > 10 * 60 * 1000) return { token: conn.access_token, conn }
  if (conn.refresh_token && (!conn.refresh_expires_at || Date.parse(conn.refresh_expires_at) > Date.now())) {
    const t = await token({ grant_type: 'refresh_token', refresh_token: conn.refresh_token })
    const patch = {
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? conn.refresh_token,
      expires_at: stamp(t.expires_in) ?? conn.expires_at,
      refresh_expires_at: stamp(t.refresh_token_expires_in) ?? conn.refresh_expires_at,
      updatedAt: new Date().toISOString(),
    }
    await supabase.from('linkedin_connection').update(patch).eq('id', 'default')
    return { token: t.access_token, conn: { ...conn, ...patch } }
  }
  throw new LinkedInError('The LinkedIn sign-in has run out (it lasts about two months). Use "Connect LinkedIn" again.', 401, true)
}

// ── The API ────────────────────────────────────────────────────────────────

async function api<T>(accessToken: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<{ data: T; headers: Headers }> {
  const r = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': apiVersion(),
      'X-Restli-Protocol-Version': '2.0.0',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  })
  const text = await r.text()
  if (!r.ok) {
    let msg = text.slice(0, 300)
    try {
      msg = (JSON.parse(text) as { message?: string }).message || msg
    } catch { /* plain text */ }
    if (r.status === 401) throw new LinkedInError(`LinkedIn refused the sign-in (${msg}). Use "Connect LinkedIn" again.`, 401, true)
    if (r.status === 403) throw new LinkedInError(`LinkedIn refused this (${msg}). The app needs the Community Management API approved, and the signed-in person must be an admin of the page.`, 403)
    throw new LinkedInError(`LinkedIn answered ${r.status}: ${msg}`, 502)
  }
  return { data: (text ? JSON.parse(text) : {}) as T, headers: r.headers }
}

// The pages the signed-in member administers, with their names.
async function adminPages(accessToken: string): Promise<LinkedInPage[]> {
  const { data } = await api<{ elements?: { organization?: string; organizationTarget?: string }[] }>(
    accessToken,
    '/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=50',
  )
  const urns = [...new Set((data.elements ?? []).map((e) => e.organization || e.organizationTarget || '').filter((u) => u.startsWith('urn:li:organization:')))]
  const pages: LinkedInPage[] = []
  for (const urn of urns) {
    const id = urn.split(':').pop()!
    let name = `Page ${id}`
    try {
      const { data: org } = await api<{ localizedName?: string }>(accessToken, `/organizations/${id}`)
      if (org.localizedName) name = org.localizedName
    } catch { /* keep the id */ }
    pages.push({ urn, name })
  }
  return pages
}

export async function refreshPages(): Promise<Connection> {
  const { token: t, conn } = await liveToken()
  const pages = await adminPages(t)
  const { data, error } = await supabase
    .from('linkedin_connection')
    .update({ pages, page_for: guessPages(pages, conn.page_for), pages_error: null, updatedAt: new Date().toISOString() })
    .eq('id', 'default')
    .select('*')
    .single()
  if (error) throw error
  return data as Connection
}

// Upload an image or a document for a page, and wait until LinkedIn has
// processed it (a post made before that can fail).
async function upload(accessToken: string, kind: 'images' | 'documents', owner: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const { data } = await api<{ value: { uploadUrl: string; image?: string; document?: string } }>(accessToken, `/${kind}?action=initializeUpload`, {
    method: 'POST',
    body: { initializeUploadRequest: { owner } },
  })
  const urn = data.value.image || data.value.document
  if (!data.value.uploadUrl || !urn) throw new LinkedInError('LinkedIn did not give an upload address.', 502)
  const put = await fetch(data.value.uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(60000),
  })
  if (!put.ok) throw new LinkedInError(`The upload to LinkedIn failed (${put.status}).`, 502)
  for (let i = 0; i < 20; i++) {
    const { data: st } = await api<{ status?: string }>(accessToken, `/${kind}/${encodeURIComponent(urn)}`).catch(() => ({ data: {} as { status?: string } }))
    if (st.status === 'AVAILABLE') return urn
    if (st.status === 'PROCESSING_FAILED') throw new LinkedInError('LinkedIn could not process the file.', 502)
    await new Promise((r) => setTimeout(r, 1500))
  }
  return urn
}

// LinkedIn's "little text": these characters are markup and must be
// escaped to show as themselves; a hashtag is written as a template.
const RESERVED = /[\\|{}@[\]()<>#*_~]/g
export function littleText(caption: string, hashtags: string[]): string {
  const inCaption = new Set((caption.match(/#[A-Za-z][A-Za-z0-9_]*/g) ?? []).map((h) => h.toLowerCase()))
  const extra = hashtags.filter((h) => !inCaption.has(h.toLowerCase()))
  const body = caption.trim()
  // The tags go on the caption's own hashtag line when it ends with one.
  const endsWithTags = /(^|\n)\s*#[A-Za-z][^\n]*$/.test(body)
  const text = !extra.length ? body : endsWithTags ? `${body} ${extra.join(' ')}` : `${body}\n\n${extra.join(' ')}`
  return text
    .split(/(#[A-Za-z][A-Za-z0-9_]*)/g)
    .map((part, i) => (i % 2 === 1 ? `{hashtag|\\#|${part.slice(1)}}` : part.replace(RESERVED, (c) => `\\${c}`)))
    .join('')
}

export interface Published { urn: string; url: string; page: LinkedInPage }

// One post on the brand's page: the file, then the post itself.
export async function publish(o: {
  brand: BrandKey
  commentary: string
  file: { kind: 'image' | 'document'; bytes: Uint8Array; title: string; altText?: string }
}): Promise<Published> {
  const { token: t, conn } = await liveToken()
  const author = conn.page_for[o.brand]
  const page = conn.pages.find((p) => p.urn === author)
  if (!author || !page) throw new LinkedInError(`Choose which LinkedIn page the ${o.brand === 'nexus' ? 'World Nexus Group' : o.brand === 'pharma' ? 'World Pharma AI' : 'World Health AI'} posts go to, at the top of the Content tab.`, 409)
  const media = o.file.kind === 'image'
    ? { id: await upload(t, 'images', author, o.file.bytes, 'image/png'), altText: (o.file.altText || o.file.title).slice(0, 4000) }
    : { id: await upload(t, 'documents', author, o.file.bytes, 'application/pdf'), title: o.file.title.slice(0, 200) }
  const { headers } = await api(t, '/posts', {
    method: 'POST',
    body: {
      author,
      commentary: o.commentary,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    },
  })
  const urn = headers.get('x-restli-id') || headers.get('x-linkedin-id') || ''
  return { urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : 'https://www.linkedin.com/', page }
}

// What the tab shows about the connection (never the tokens).
export async function status(origin: string) {
  const configured = linkedinConfigured()
  let conn: Connection | null = null
  let tableMissing = false
  try {
    conn = await getConnection()
  } catch {
    tableMissing = true
  }
  return {
    configured,
    tableMissing,
    redirectUri: redirectUri(origin),
    connected: Boolean(conn),
    expiresAt: conn?.expires_at ?? null,
    renews: Boolean(conn?.refresh_token),
    pages: conn?.pages ?? [],
    pageFor: conn?.page_for ?? {},
    pagesError: conn?.pages_error ?? null,
  }
}
