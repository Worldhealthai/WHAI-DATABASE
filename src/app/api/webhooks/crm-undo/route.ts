// Undo "Move to CRM" from the Nexus admin's inboxes (enquiries and agenda
// requests), for a contact moved there by mistake.
//
// POST /api/webhooks/crm-undo
// Headers: x-webhook-secret: <WEBHOOK_SECRET>
// Body: { "sourceId": "<the enquiry's or agenda request's id>" }
//
// Finds the triage entries made from that item (staged_contacts, whose
// rawData is the item itself, id included) and removes what each one led
// to: the record it was assigned as (assignedAs / assignedId; a company's
// contacts with it; logged activity goes with them), then the triage entry.
// Only records made by the move are touched: assigning always creates a new
// record (lib/stagedAssign), so nothing that was in the CRM before goes.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TABLE: Record<string, string> = { delegate: 'delegates', speaker: 'speakers', sponsor: 'sponsors', partner: 'partners' }

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.WEBHOOK_SECRET?.trim()
    if (secret && req.headers.get('x-webhook-secret')?.trim() !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    const sourceId = String(body?.sourceId || '').trim()
    // Ids are uuids: nothing in one can act as a wildcard in the match below.
    if (!/^[0-9a-f-]{36}$/i.test(sourceId)) return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })

    const { data: staged, error } = await supabase
      .from('staged_contacts')
      .select('id, assignedAs, assignedId')
      .ilike('rawData', `%"id":"${sourceId}"%`)
    if (error) throw error

    const removed: { as: string; id: string }[] = []
    for (const s of staged ?? []) {
      const table = s.assignedAs ? TABLE[s.assignedAs] : null
      if (table && s.assignedId) {
        if (table === 'sponsors' || table === 'partners') {
          const { error: kidsErr } = await supabase.from(table).delete().eq('companyId', s.assignedId)
          if (kidsErr) throw kidsErr
        }
        const { data: gone, error: delErr } = await supabase.from(table).delete().eq('id', s.assignedId).select('id')
        if (delErr) throw delErr
        if (gone?.length) removed.push({ as: s.assignedAs, id: s.assignedId })
      }
      const { error: stErr } = await supabase.from('staged_contacts').delete().eq('id', s.id)
      if (stErr) throw stErr
    }
    return NextResponse.json({ ok: true, found: staged?.length ?? 0, removed })
  } catch (error: any) {
    console.error('crm-undo error:', error)
    return NextResponse.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 })
  }
}
