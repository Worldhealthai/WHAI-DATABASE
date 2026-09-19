import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { canonicalEventLabel } from '@/types'
import { companySimilarity } from '@/lib/companyMatch'

export const dynamic = 'force-dynamic'

// Sponsor onboarding webhook.
// The Nexus admin posts here when a sponsor's onboarding form is approved
// and published to an event. The company lands in this edition's sponsors
// (the row the Marketing portal reads), with the LinkedIn posts its package
// includes. An existing row for the same company and edition is updated,
// otherwise one is created as Confirmed.
//
// POST /api/webhooks/sponsor
// Headers: x-webhook-secret: <WEBHOOK_SECRET env var>
// Body: {
//   "companyName": "Acme Health", "tier": "Gold Sponsor",
//   "event": "World Health AI · London · 2026", "year": 2026,
//   "contactFirstName": "…", "contactLastName": "…", "contactEmail": "…",
//   "logoUrl": "…", "bio": "…",
//   "linkedinPostsDue": 2, "onboardedAt": "2026-09-19T…",
//   "source": "worldnexusgroup.com sponsor onboarding"
// }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const MATCH_THRESHOLD = 0.9

type Row = { id: string; companyName: string | null; contactEmail: string | null; event: string | null; notes: string | null; linkedinPostsDue?: number | null }

// Nexus writes editions as "World Health AI · London · 2026"; the CRM stores
// "World Health AI London 2026".
function editionLabel(raw: string, year: number | null): string | null {
  const flat = raw.replace(/\s*[·•—-]\s*/g, ' ').replace(/\s+/g, ' ').trim()
  return canonicalEventLabel(flat, year)
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.WEBHOOK_SECRET?.trim()
    if (secret && req.headers.get('x-webhook-secret')?.trim() !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const body = await req.json().catch(() => ({}))
    const companyName = String(body?.companyName || '').trim()
    if (!companyName) return NextResponse.json({ error: 'companyName is required' }, { status: 400, headers: CORS_HEADERS })

    const year = Number.isInteger(body?.year) ? body.year : null
    const event = body?.event ? editionLabel(String(body.event), year) : null
    if (!event) return NextResponse.json({ error: 'event is required' }, { status: 400, headers: CORS_HEADERS })

    const email = String(body?.contactEmail || '').trim().toLowerCase() || null
    const due = Number.isInteger(body?.linkedinPostsDue) ? Math.max(0, body.linkedinPostsDue) : null
    const source = String(body?.source || 'sponsor onboarding').slice(0, 120)

    // The company's row for this edition, matched on the name (fuzzy) or the
    // contact email. Company rows only — contact rows carry a companyId.
    const { data: rows, error: readErr } = await supabase
      .from('sponsors')
      .select('id, companyName, contactEmail, event, notes')
      .is('companyId', null)
      .eq('event', event)
    if (readErr) throw readErr
    let best: { row: Row; score: number } | null = null
    for (const row of (rows || []) as Row[]) {
      let score = row.companyName ? companySimilarity(companyName, row.companyName) : 0
      if (email && (row.contactEmail || '').trim().toLowerCase() === email) score = Math.max(score, 1)
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { row, score }
    }

    const marketing: Record<string, unknown> = {
      linkedinPostsDue: due,
      onboardedAt: body?.onboardedAt || new Date().toISOString(),
      logoUrl: body?.logoUrl || null,
    }
    const contact: Record<string, unknown> = {}
    if (body?.contactFirstName) contact.contactFirstName = String(body.contactFirstName)
    if (body?.contactLastName) contact.contactLastName = String(body.contactLastName)
    if (email) contact.contactEmail = email
    const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const onboardingNote = `[Onboarded · ${source} · ${stamp}]${body?.bio ? `\n${String(body.bio).trim()}` : ''}`

    // Before migration 005 the marketing columns do not exist: keep the
    // sponsor itself, drop only those fields.
    const missingColumn = (err: { message?: string } | null) => Boolean(err?.message && /linkedinPostsDue|onboardedAt|logoUrl/.test(err.message))

    if (best) {
      const notes = (best.row.notes || '').includes('[Onboarded ·') ? best.row.notes : [best.row.notes, onboardingNote].filter(Boolean).join('\n\n')
      const update = { ...contact, tier: body?.tier || undefined, status: 'Confirmed', notes, updatedAt: new Date().toISOString() }
      let { error } = await supabase.from('sponsors').update({ ...update, ...marketing }).eq('id', best.row.id)
      if (error && missingColumn(error)) ({ error } = await supabase.from('sponsors').update(update).eq('id', best.row.id))
      if (error) throw error
      return NextResponse.json({ ok: true, created: false, id: best.row.id, event }, { headers: CORS_HEADERS })
    }

    const record = {
      companyName,
      tier: body?.tier || null,
      status: 'Confirmed',
      event,
      contractStatus: 'Signed',
      tags: 'Sponsor onboarding',
      notes: onboardingNote,
      ...contact,
    }
    let { data, error } = await supabase.from('sponsors').insert({ ...record, ...marketing }).select('id').single()
    if (error && missingColumn(error)) ({ data, error } = await supabase.from('sponsors').insert(record).select('id').single())
    if (error) throw error
    return NextResponse.json({ ok: true, created: true, id: data?.id, event }, { status: 201, headers: CORS_HEADERS })
  } catch (error: any) {
    console.error('sponsor webhook error:', error)
    return NextResponse.json({ error: 'Internal server error', detail: String(error?.message || error).slice(0, 300) }, { status: 500, headers: CORS_HEADERS })
  }
}
