// The digital agenda for one edition.
//   GET /api/agenda?edition=World%20Health%20AI%20London%202026  → { agenda } (or agenda: null)
//   PUT /api/agenda  { edition, agenda }                          → saves it
//   DELETE /api/agenda?edition=…                                  → removes it
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normaliseAgenda, type Agenda } from '@/lib/agenda/model'

export const dynamic = 'force-dynamic'

const AGENDA_HINT = 'The agendas table is missing — run supabase/migrations/008_agendas.sql in the Supabase SQL editor.'
const missing = (err: { message?: string } | null | undefined) => Boolean(err?.message && /agendas/.test(err.message))

export async function GET(req: NextRequest) {
  const edition = (req.nextUrl.searchParams.get('edition') || '').trim()
  if (!edition) return NextResponse.json({ error: 'edition is required' }, { status: 400 })
  const { data, error } = await supabase.from('agendas').select('*').eq('edition', edition).maybeSingle()
  if (error) {
    if (missing(error)) return NextResponse.json({ error: AGENDA_HINT, migration: true }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ agenda: null })
  return NextResponse.json({ agenda: { ...normaliseAgenda(data.data as Agenda), sourceFile: data.sourceFile, updatedAt: data.updatedAt } })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const edition = String(body?.edition || '').trim()
  const agenda = body?.agenda as Agenda | undefined
  if (!edition || !agenda || !Array.isArray(agenda.sessions)) return NextResponse.json({ error: 'edition and agenda are required' }, { status: 400 })
  const clean: Agenda = {
    title: String(agenda.title || ''),
    dateLabel: String(agenda.dateLabel || ''),
    venue: String(agenda.venue || ''),
    sessions: agenda.sessions,
  }
  const { error } = await supabase
    .from('agendas')
    .upsert({ edition, data: clean, sourceFile: agenda.sourceFile ?? null, updatedAt: new Date().toISOString() }, { onConflict: 'edition' })
  if (error) {
    if (missing(error)) return NextResponse.json({ error: AGENDA_HINT, migration: true }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const edition = (req.nextUrl.searchParams.get('edition') || '').trim()
  if (!edition) return NextResponse.json({ error: 'edition is required' }, { status: 400 })
  const { error } = await supabase.from('agendas').delete().eq('edition', edition)
  if (error) {
    if (missing(error)) return NextResponse.json({ error: AGENDA_HINT, migration: true }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
