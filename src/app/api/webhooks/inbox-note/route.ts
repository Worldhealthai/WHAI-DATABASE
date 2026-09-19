import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { companySimilarity } from '@/lib/companyMatch'
import { upsertInboxNoteActivity, type NoteEntity } from '@/lib/inboxNoteActivity'

export const dynamic = 'force-dynamic'

// Inbox-note webhook.
// The worldhealth.ai and worldnexusgroup.com admin panels post here when a
// team note is saved on a contact enquiry. If the enquirer is already in the
// CRM, the note is written onto that record's timeline as a note activity,
// next to its status changes: their company (sponsor or partner, fuzzy on
// the company name or exact on the contact email) and the person themselves
// (delegate or speaker, exact on email). Re-saving an edited note replaces
// the earlier entry instead of stacking a new one.
//
// If the enquiry is still waiting in the triage inbox, the note is kept on
// the staged contact so it follows them when they are assigned. This never
// creates CRM records.
//
// POST /api/webhooks/inbox-note
// Headers: x-webhook-secret: <WEBHOOK_SECRET env var>
// Body: {
//   "company": "Acme Health",         // enquiry's company (fuzzy-matched)
//   "email": "jane@acmehealth.com",   // enquiry's email
//   "note": "Spoke on the phone…",    // the team note as saved in the inbox
//   "source": "worldhealth.ai contact inbox"
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

type CompanyRow = { id: string; companyName: string | null; contactEmail: string | null }
type PersonRow = { id: string; email: string | null }

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.WEBHOOK_SECRET?.trim()
    if (secret && req.headers.get('x-webhook-secret')?.trim() !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const body = await req.json().catch(() => ({}))
    const company = String(body?.company || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const note = String(body?.note || '').trim()
    const source = String(body?.source || 'contact inbox').trim().slice(0, 120)

    if (!note) {
      return NextResponse.json({ error: 'note is required' }, { status: 400, headers: CORS_HEADERS })
    }
    if (!company && !email) {
      return NextResponse.json({ error: 'company or email is required' }, { status: 400, headers: CORS_HEADERS })
    }

    const targets: { entityType: NoteEntity; id: string }[] = []

    // The company: best match across sponsors and partners.
    let best: { entityType: 'sponsor' | 'partner'; row: CompanyRow; score: number } | null = null
    for (const [table, entityType] of [['sponsors', 'sponsor'], ['partners', 'partner']] as const) {
      const { data, error } = await supabase.from(table).select('id, companyName, contactEmail')
      if (error) {
        console.warn(`inbox-note: could not read ${table}:`, error.message)
        continue
      }
      for (const row of (data || []) as CompanyRow[]) {
        let score = 0
        if (company && row.companyName) score = companySimilarity(company, row.companyName)
        if (email && (row.contactEmail || '').trim().toLowerCase() === email) score = Math.max(score, 1)
        if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { entityType, row, score }
      }
    }
    if (best) targets.push({ entityType: best.entityType, id: best.row.id })

    // The person: exact email among delegates and speakers.
    if (email) {
      for (const [table, entityType] of [['delegates', 'delegate'], ['speakers', 'speaker']] as const) {
        const { data, error } = await supabase.from(table).select('id, email').ilike('email', email)
        if (error) {
          console.warn(`inbox-note: could not read ${table}:`, error.message)
          continue
        }
        for (const row of (data || []) as PersonRow[]) targets.push({ entityType, id: row.id })
      }
    }

    const written: { entityType: NoteEntity; id: string; result: string }[] = []
    for (const t of targets) {
      const result = await upsertInboxNoteActivity({ entityType: t.entityType, entityId: t.id, note, source, email })
      written.push({ ...t, result })
    }

    // Still in triage: keep the latest note with the staged contact so the
    // assign step carries it onto the new record.
    let staged = 0
    if (email) {
      const { data } = await supabase
        .from('staged_contacts')
        .select('id, rawData')
        .eq('status', 'pending')
        .ilike('email', email)
      for (const row of data || []) {
        let raw: Record<string, unknown> = {}
        try { raw = JSON.parse(row.rawData ?? '{}') || {} } catch { raw = {} }
        raw.team_note = note
        raw.team_note_source = source
        const { error } = await supabase.from('staged_contacts').update({ rawData: JSON.stringify(raw) }).eq('id', row.id)
        if (!error) staged++
      }
    }

    return NextResponse.json(
      { matched: written.length > 0, written, staged, table: best ? `${best.entityType}s` : null, id: best?.row.id ?? null },
      { headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error('inbox-note webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}
