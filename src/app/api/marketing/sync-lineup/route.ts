// POST /api/marketing/sync-lineup  { events: ["World Health AI London 2026", …] }
//
// Pulls the approved speakers from the Nexus admin panel (the line-up as
// the team sees it there) and makes this edition's speaker records match:
// each one is found here by email, else by name, and marked as on the
// line-up and Speaking Confirmed, with the headshot, bio and LinkedIn
// consent the admin holds; anyone missing is created; anyone flagged here
// but no longer on the admin's list is unflagged.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { canonicalEventLabel } from '@/types'

export const dynamic = 'force-dynamic'

const NEXUS_URL = (process.env.NEXUS_SITE_URL || 'https://www.worldnexusgroup.com').replace(/\/+$/, '')

type AdminSpeaker = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company: string | null
  job_position: string | null
  speaker_headshot: string | null
  speaker_bio: string | null
  linkedin_consent: boolean | null
  event_label: string | null
  event_date: string | null
}

// Nexus writes editions as "World Health AI · London · 2026".
function edition(label: string | null, date: string | null): string | null {
  if (!label) return null
  const year = Number((date || label).match(/\b(20\d{2})\b/)?.[1]) || null
  const flat = label.replace(/\s*[·•—-]\s*/g, ' ').replace(/\s+/g, ' ').trim()
  return canonicalEventLabel(flat, year)
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const events: string[] = Array.isArray(body?.events) ? body.events.filter(Boolean) : []
    if (!events.length) return NextResponse.json({ error: 'events is required' }, { status: 400 })

    const secret = process.env.WEBHOOK_SECRET?.trim()
    if (!secret) return NextResponse.json({ error: 'WEBHOOK_SECRET is not set on the CRM, so it cannot read the admin panel.' }, { status: 500 })

    const res = await fetch(`${NEXUS_URL}/api/registrations/lineup`, {
      headers: { 'x-webhook-secret': secret },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const why =
        res.status === 404 || res.status === 405
          ? 'The admin panel does not have the line-up endpoint yet — redeploy worldnexusgroup.com from the latest code, then try again.'
          : res.status === 401
            ? 'The admin panel refused the shared secret. Check that CRM_WEBHOOK_SECRET there matches WEBHOOK_SECRET here.'
            : `The admin panel answered ${res.status}.`
      return NextResponse.json({ error: why }, { status: 502 })
    }
    const j = await res.json()
    const all = (j?.speakers ?? []) as AdminSpeaker[]
    const wanted = new Set(events)
    const lineup = all.filter((r) => {
      const e = edition(r.event_label, r.event_date)
      return e !== null && wanted.has(e)
    })

    // This edition's speakers here.
    const { data: existingRows, error: readErr } = await supabase
      .from('speakers')
      .select('id, firstName, lastName, email, adminLineup, headshotUrl, bio, linkedinConsent, status')
      .in('event', events)
    if (readErr) throw readErr
    const existing = existingRows ?? []

    const matched = new Set<string>()
    let created = 0
    let updated = 0
    let unchanged = 0
    for (const r of lineup) {
      const email = (r.email || '').trim().toLowerCase()
      const first = (r.first_name || '').trim()
      const last = (r.last_name || '').trim()
      let hit = email ? existing.find((x) => (x.email || '').trim().toLowerCase() === email) : undefined
      if (!hit && first) hit = existing.find((x) => (x.firstName || '').trim().toLowerCase() === first.toLowerCase() && (x.lastName || '').trim().toLowerCase() === last.toLowerCase())
      // Not in this edition here: maybe in another (same person, a new
      // year). Find them anywhere by email and bring the record forward.
      if (!hit && email) {
        const { data: elsewhere } = await supabase.from('speakers').select('id, firstName, lastName, email, adminLineup, headshotUrl, bio, linkedinConsent, status').ilike('email', escapeLike(email)).limit(1)
        if (elsewhere?.length) hit = elsewhere[0]
      }

      const label = edition(r.event_label, r.event_date)!
      const year = Number(label.match(/\b(20\d{2})\b/)?.[1]) || null
      const fields: Record<string, unknown> = {
        adminLineup: true,
        status: 'Speaking Confirmed',
        event: label,
        year,
        organization: r.company || undefined,
        jobTitle: r.job_position || undefined,
        phone: r.phone || undefined,
        headshotUrl: r.speaker_headshot || undefined,
        bio: r.speaker_bio || undefined,
        linkedinConsent: typeof r.linkedin_consent === 'boolean' ? r.linkedin_consent : undefined,
      }
      for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k]

      if (hit) {
        matched.add(hit.id)
        // Ask for the row back so a write that changed nothing is not
        // counted as a success.
        const { data: rows, error } = await supabase.from('speakers').update(fields).eq('id', hit.id).select('id')
        if (error) throw error
        if (rows?.length) updated++
        else unchanged++
      } else {
        const { error } = await supabase.from('speakers').insert({
          firstName: first || (email || 'Speaker'),
          lastName: last,
          email: email || null,
          tags: 'Admin panel',
          ...fields,
        })
        if (error) throw error
        created++
      }
    }

    // Flagged here but no longer on the admin's list: off the line-up.
    const stale = existing.filter((x) => x.adminLineup && !matched.has(x.id)).map((x) => x.id)
    if (stale.length) {
      const { error } = await supabase.from('speakers').update({ adminLineup: false }).in('id', stale)
      if (error) throw error
    }

    // What the Marketing page will now see for this edition.
    const { count: flaggedNow } = await supabase
      .from('speakers')
      .select('id', { count: 'exact', head: true })
      .in('event', events)
      .eq('adminLineup', true)

    return NextResponse.json({
      ok: true,
      lineup: lineup.length,
      created,
      updated,
      unchanged,
      unflagged: stale.length,
      adminTotal: all.length,
      flaggedNow: flaggedNow ?? 0,
      events,
      sample: lineup.slice(0, 3).map((r) => ({ name: `${r.first_name} ${r.last_name}`.trim(), event: edition(r.event_label, r.event_date) })),
    })
  } catch (error: any) {
    const msg = String(error?.message || error)
    if (/adminLineup|linkedinConsent/.test(msg)) {
      return NextResponse.json({ error: 'Run supabase/migrations/005_marketing.sql and 006_admin_lineup.sql first.' }, { status: 400 })
    }
    console.error('sync-lineup error:', error)
    return NextResponse.json({ error: 'Sync failed', detail: msg.slice(0, 200) }, { status: 500 })
  }
}
