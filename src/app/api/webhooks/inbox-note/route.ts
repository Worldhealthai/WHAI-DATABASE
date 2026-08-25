import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { companySimilarity } from '@/lib/companyMatch'

export const dynamic = 'force-dynamic'

// Inbox-note webhook.
// The worldhealth.ai and worldnexusgroup.com admin panels post here when a
// team note is saved on a contact enquiry. If the enquiry's business already
// exists in the CRM (a sponsor or partner record), the note is copied onto
// that record's notes; if not, nothing happens — this never creates records.
//
// POST /api/webhooks/inbox-note
// Headers: x-webhook-secret: <WEBHOOK_SECRET env var>
// Body: {
//   "company": "Acme Health",         // enquiry's company (fuzzy-matched)
//   "email": "jane@acmehealth.com",   // enquiry's email (fallback exact match)
//   "note": "Spoke on the phone…",    // the team note as saved in the inbox
//   "source": "worldhealth.ai contact inbox"
// }
//
// Re-saving an edited note replaces the previously copied block (matched by
// its source + email marker) instead of stacking duplicates.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const MATCH_THRESHOLD = 0.9

type CompanyRow = {
  id: string
  companyName: string | null
  contactEmail: string | null
  notes: string | null
}

// Replace the block introduced by `marker` if present, else append it.
function upsertNoteBlock(existing: string | null, marker: string, content: string): string {
  const block = `${marker}\n${content.trim()}`
  const base = (existing || '').trim()
  if (!base) return block
  const esc = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|\\n\\n)${esc}\\n[\\s\\S]*?(?=\\n\\n\\[|$)`)
  if (re.test(base)) return base.replace(re, `$1${block}`)
  return `${base}\n\n${block}`
}

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

    // Search both company pipelines for the best match: fuzzy on the company
    // name first, exact contact-email as the fallback.
    let best: { table: 'sponsors' | 'partners'; row: CompanyRow; score: number } | null = null
    for (const table of ['sponsors', 'partners'] as const) {
      const { data, error } = await supabase
        .from(table)
        .select('id, companyName, contactEmail, notes')
      if (error) {
        // A missing partners table shouldn't stop the sponsors match.
        console.warn(`inbox-note: could not read ${table}:`, error.message)
        continue
      }
      for (const row of (data || []) as CompanyRow[]) {
        let score = 0
        if (company && row.companyName) score = companySimilarity(company, row.companyName)
        if (email && (row.contactEmail || '').trim().toLowerCase() === email) score = Math.max(score, 1)
        if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
          best = { table, row, score }
        }
      }
    }

    if (!best) {
      return NextResponse.json({ matched: false }, { headers: CORS_HEADERS })
    }

    const marker = `[Inbox note · ${source} · ${email || company}]`
    const saved = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const notes = upsertNoteBlock(best.row.notes, marker, `${note}\n(saved ${saved})`)

    if (notes !== (best.row.notes || '').trim()) {
      const { error } = await supabase
        .from(best.table)
        .update({ notes, updatedAt: new Date().toISOString() })
        .eq('id', best.row.id)
      if (error) {
        console.error('inbox-note: update failed:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS })
      }
    }

    return NextResponse.json(
      { matched: true, table: best.table, company: best.row.companyName },
      { headers: CORS_HEADERS },
    )
  } catch (error) {
    console.error('inbox-note webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}
