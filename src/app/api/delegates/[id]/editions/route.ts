// GET: every event this delegate is in. POST { events: string[], status? }:
// add them to more events. DELETE { events: string[] }: take them out of
// those events (lib/personEditions).
import { NextRequest, NextResponse } from 'next/server'
import { addPersonToEvents, personEditions, removePersonFromEvents, type PersonTable } from '@/lib/personEditions'

export const dynamic = 'force-dynamic'

const TABLE: PersonTable = 'delegates'

const eventsOf = (body: any): string[] => (Array.isArray(body?.events) ? body.events.filter((e: unknown) => typeof e === 'string') : [])

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const found = await personEditions(TABLE, id)
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(found)
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const body = await req.json().catch(() => null)
  const events = eventsOf(body)
  if (!events.length) return NextResponse.json({ error: 'Pick at least one event.' }, { status: 400 })
  const result = await addPersonToEvents(TABLE, id, events, typeof body?.status === 'string' ? body.status : null)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 })
  return NextResponse.json(result, { status: 201 })
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const events = eventsOf(await req.json().catch(() => null))
  if (!events.length) return NextResponse.json({ error: 'Pick at least one event.' }, { status: 400 })
  const result = await removePersonFromEvents(TABLE, id, events)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 })
  return NextResponse.json(result)
}
