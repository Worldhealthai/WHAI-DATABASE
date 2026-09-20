// The Marketing portal's data: the admin panel's line-up for one edition,
// read live from worldnexusgroup.com, with this CRM's post tracking laid
// over it. Server-side only.

import { supabase } from '@/lib/supabase'

export const NEXUS_URL = (process.env.NEXUS_SITE_URL || 'https://www.worldnexusgroup.com').replace(/\/+$/, '')

export interface Edition {
  series: string
  city: string
  year: string
  /** The label this CRM files records under, e.g. "World Health AI London 2026" */
  label: string
}

export interface Tracking {
  id: string
  kind: 'speaker' | 'sponsor'
  ref: string
  edition: string
  postStatus: 'To do' | 'Posted' | 'Not needed' | null
  postUrl: string | null
  postedAt: string | null
  postsDue: number | null
  postsDone: number
  log: { url?: string | null; note?: string | null; at: string }[]
  notes: string | null
  updatedAt: string
}

export interface LineupSpeaker {
  id: string
  name: string
  role: string | null
  org: string | null
  image: string | null
  bio: string | null
  email: string | null
  gender: string | null
  linkedin_consent: boolean | null
  registered: boolean
}

export interface LineupSponsor {
  id: string
  name: string
  logo: string | null
  website: string | null
  tier: string | null
  category: string | null
  contact_name: string
  contact_email: string | null
  onboarding_status: string | null
  onboarded_at: string | null
  linkedin_posts_included: number | null
  source: 'onboarding' | 'manual'
}

export interface Lineup {
  event: { id: string; slug: string; series: string; city: string | null; year: string; date: string | null; status: string } | null
  speakers: LineupSpeaker[]
  sponsors: LineupSponsor[]
}

export class LineupError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

// Absolute image URLs: the admin may still hold site-relative paths.
export function absoluteUrl(u: string | null | undefined): string | null {
  if (!u) return null
  return u.startsWith('/') ? `${NEXUS_URL}${u}` : u
}

export async function fetchLineup(ed: Edition): Promise<Lineup> {
  const secret = process.env.WEBHOOK_SECRET?.trim()
  if (!secret) throw new LineupError('WEBHOOK_SECRET is not set on the CRM, so it cannot read the admin panel.', 500)
  const q = new URLSearchParams({ series: ed.series, city: ed.city, year: ed.year })
  let res: Response
  try {
    res = await fetch(`${NEXUS_URL}/api/marketing/lineup?${q}`, {
      headers: { 'x-webhook-secret': secret },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new LineupError('The admin panel did not answer. Try again in a moment.')
  }
  if (res.status === 404 || res.status === 405) throw new LineupError('The admin panel does not have the marketing line-up endpoint yet — redeploy worldnexusgroup.com from the latest code.')
  if (res.status === 401) throw new LineupError('The admin panel refused the shared secret. Check that CRM_WEBHOOK_SECRET there matches WEBHOOK_SECRET here.')
  if (!res.ok) throw new LineupError(`The admin panel answered ${res.status}.`)
  const j = (await res.json()) as Lineup
  return {
    event: j.event ?? null,
    speakers: (j.speakers ?? []).map((s) => ({ ...s, image: absoluteUrl(s.image) })),
    sponsors: (j.sponsors ?? []).map((s) => ({ ...s, logo: absoluteUrl(s.logo) })),
  }
}

export const isMissingTrackingTable = (err: { message?: string } | null | undefined) =>
  Boolean(err?.message && /marketing_tracking/.test(err.message))

export const TRACKING_HINT = 'The tracking table is missing — run supabase/migrations/007_marketing_tracking.sql in the Supabase SQL editor.'

export async function readTracking(kind: 'speaker' | 'sponsor', edition: string): Promise<Map<string, Tracking>> {
  const { data, error } = await supabase.from('marketing_tracking').select('*').eq('kind', kind).eq('edition', edition)
  if (error) throw error
  return new Map((data ?? []).map((t: Tracking) => [t.ref, t]))
}

export async function upsertTracking(
  kind: 'speaker' | 'sponsor',
  ref: string,
  edition: string,
  fields: Record<string, unknown>
): Promise<Tracking> {
  const { data, error } = await supabase
    .from('marketing_tracking')
    .upsert({ kind, ref, edition, ...fields, updatedAt: new Date().toISOString() }, { onConflict: 'kind,ref,edition' })
    .select()
    .single()
  if (error) throw error
  return data as Tracking
}
