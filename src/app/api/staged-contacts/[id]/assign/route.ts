// POST { assignAs: 'delegate' | 'speaker' | 'sponsor' | 'partner', status? }: turn a
// triage contact into a record, filed under its enquiry's event
// (lib/stagedAssign).
import { NextRequest, NextResponse } from 'next/server'
import { assignStagedContact, isAssignAs } from '@/lib/stagedAssign'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const { assignAs, status } = await req.json()
    if (!isAssignAs(assignAs)) return NextResponse.json({ error: 'Invalid assignAs value' }, { status: 400 })
    const result = await assignStagedContact(params.id, assignAs, status)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Assign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
