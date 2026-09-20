// POST /api/marketing/log-post  { kind: 'speaker' | 'sponsor', ref, edition, url?, note? }
//
// Records a LinkedIn post that has been made for a line-up entry: a
// speaker is marked Posted (with the link); a sponsor's posts-made count
// goes up. Every post is kept in the entry's log.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { TRACKING_HINT, isMissingTrackingTable, upsertTracking, type Tracking } from '@/lib/marketingSource'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const kind = body?.kind === 'speaker' ? 'speaker' : body?.kind === 'sponsor' ? 'sponsor' : null
    const ref = String(body?.ref || '').trim()
    const edition = String(body?.edition || '').trim()
    if (!kind || !ref || !edition) return NextResponse.json({ error: 'kind, ref and edition are required' }, { status: 400 })

    const url = String(body?.url || '').trim() || null
    const note = String(body?.note || '').trim() || null
    const now = new Date().toISOString()

    const { data: prior, error: readErr } = await supabase
      .from('marketing_tracking')
      .select('*')
      .eq('kind', kind).eq('ref', ref).eq('edition', edition)
      .maybeSingle()
    if (readErr) throw readErr
    const current = (prior ?? null) as Tracking | null
    const log = [...(current?.log ?? []), { url, note, at: now }]

    const fields: Record<string, unknown> =
      kind === 'speaker'
        ? { postStatus: 'Posted', postUrl: url ?? current?.postUrl ?? null, postedAt: now, log }
        : { postsDone: Math.max(0, Number(current?.postsDone ?? 0)) + 1, postUrl: url ?? current?.postUrl ?? null, postedAt: now, log }

    const saved = await upsertTracking(kind, ref, edition, fields)
    return NextResponse.json({ ok: true, tracking: saved })
  } catch (error: any) {
    if (isMissingTrackingTable(error)) return NextResponse.json({ error: TRACKING_HINT, migration: true }, { status: 400 })
    console.error('log-post error:', error)
    return NextResponse.json({ error: 'Internal server error', detail: String(error?.message || error).slice(0, 200) }, { status: 500 })
  }
}
