// POST /api/records/move — "Move to…" on a profile: a record filed in the
// wrong section re-made in another (lib/moveRecord).
// Body: { from: 'sponsor' | 'partner' | 'speaker' | 'delegate', id, to, status? }
import { NextRequest, NextResponse } from 'next/server'
import { moveRecord } from '@/lib/moveRecord'
import { isAssignAs } from '@/lib/stagedAssign'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { from, id, to, status } = await req.json().catch(() => ({}))
    if (!isAssignAs(from) || !isAssignAs(to) || typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'from, id and to are required' }, { status: 400 })
    }
    const result = await moveRecord(from, id, to, status)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    console.error('move error:', error)
    return NextResponse.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 })
  }
}
