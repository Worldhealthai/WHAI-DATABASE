// PATCH /api/marketing/track
//   { kind: 'speaker' | 'sponsor', ref, edition, postStatus?, postUrl?, postsDue?, postsDone?, notes? }
//
// Records the marketing team's state against one line-up entry from the
// admin panel (identified by its Nexus id and the edition label).
import { NextRequest, NextResponse } from 'next/server'
import { TRACKING_HINT, isMissingTrackingTable, upsertTracking } from '@/lib/marketingSource'

export const dynamic = 'force-dynamic'

const STATUSES = new Set(['To do', 'Posted', 'Not needed'])

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const kind = body?.kind === 'speaker' ? 'speaker' : body?.kind === 'sponsor' ? 'sponsor' : null
    const ref = String(body?.ref || '').trim()
    const edition = String(body?.edition || '').trim()
    if (!kind || !ref || !edition) return NextResponse.json({ error: 'kind, ref and edition are required' }, { status: 400 })

    const fields: Record<string, unknown> = {}
    if ('postStatus' in body) {
      if (body.postStatus !== null && !STATUSES.has(body.postStatus)) return NextResponse.json({ error: 'bad postStatus' }, { status: 400 })
      fields.postStatus = body.postStatus
      if (body.postStatus === 'Posted' && !body.postedAt) fields.postedAt = new Date().toISOString()
    }
    if ('postedAt' in body) fields.postedAt = body.postedAt || null
    if ('postUrl' in body) fields.postUrl = String(body.postUrl || '').trim() || null
    if ('postsDue' in body) fields.postsDue = body.postsDue === null || body.postsDue === '' ? null : Math.max(0, Number(body.postsDue) || 0)
    if ('postsDone' in body) fields.postsDone = Math.max(0, Number(body.postsDone) || 0)
    if ('notes' in body) fields.notes = String(body.notes || '').trim() || null
    if (!Object.keys(fields).length) return NextResponse.json({ error: 'nothing to change' }, { status: 400 })

    const saved = await upsertTracking(kind, ref, edition, fields)
    return NextResponse.json({ ok: true, tracking: saved })
  } catch (error: any) {
    if (isMissingTrackingTable(error)) return NextResponse.json({ error: TRACKING_HINT, migration: true }, { status: 400 })
    console.error('track error:', error)
    return NextResponse.json({ error: 'Internal server error', detail: String(error?.message || error).slice(0, 200) }, { status: 500 })
  }
}
