// GET: every event this company is in. POST { events: string[] }: add it to
// more events (lib/companyEditions).
import { NextRequest, NextResponse } from 'next/server'
import { addCompanyToEvents, companyEditions } from '@/lib/companyEditions'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const found = await companyEditions('sponsors', id)
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(found)
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const body = await req.json().catch(() => null)
  const events = Array.isArray(body?.events) ? body.events.filter((e: unknown) => typeof e === 'string') : []
  if (!events.length) return NextResponse.json({ error: 'Pick at least one event.' }, { status: 400 })
  const result = await addCompanyToEvents('sponsors', id, events)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 })
  return NextResponse.json(result, { status: 201 })
}
