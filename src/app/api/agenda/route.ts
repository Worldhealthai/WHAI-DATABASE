// The digital agenda for one edition.
//   GET /api/agenda?edition=World%20Health%20AI%20London%202026  → { agenda } (or agenda: null)
//   PUT /api/agenda  { edition, agenda }                          → saves it
//   DELETE /api/agenda?edition=…                                  → removes it
import { NextRequest, NextResponse } from 'next/server'
import { setupHint, supabase } from '@/lib/supabase'
import { normaliseAgenda, type Agenda } from '@/lib/agenda/model'

export const dynamic = 'force-dynamic'

// Whether two updatedAt stamps are the same moment. A save hands back the
// stamp in JavaScript's form (…T10:00:00.123Z) while the database reads it
// back as …T10:00:00.123+00:00, so the strings alone would call a save made
// on the returned stamp a conflict. Compared down to the microsecond, as
// Postgres stores them.
function sameInstant(a: string | null, b: string | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const t = Date.parse(a)
  const fraction = (s: string) => (s.match(/:\d{2}\.(\d+)/)?.[1] ?? '').padEnd(6, '0').slice(0, 6)
  return Number.isFinite(t) && t === Date.parse(b) && fraction(a) === fraction(b)
}

export async function GET(req: NextRequest) {
  const edition = (req.nextUrl.searchParams.get('edition') || '').trim()
  if (!edition) return NextResponse.json({ error: 'edition is required' }, { status: 400 })
  const { data, error } = await supabase.from('agendas').select('*').eq('edition', edition).maybeSingle()
  if (error) {
    const hint = setupHint('agendas', error)
    if (hint) return NextResponse.json({ error: hint, migration: true }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ agenda: null })
  return NextResponse.json({ agenda: { ...normaliseAgenda(data.data as Agenda), sourceFile: data.sourceFile, updatedAt: data.updatedAt } })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const edition = String(body?.edition || '').trim()
  const agenda = body?.agenda as Agenda | undefined
  // The updatedAt the editor loaded this agenda with — null when the agenda
  // was started here and has never been saved. Both portals edit the same
  // row, so a save that is not built on the current version is refused
  // rather than quietly overwriting whoever saved first.
  const base = body?.baseUpdatedAt ? String(body.baseUpdatedAt) : null
  if (!edition || !agenda || !Array.isArray(agenda.sessions)) return NextResponse.json({ error: 'edition and agenda are required' }, { status: 400 })
  const clean: Agenda = {
    title: String(agenda.title || ''),
    dateLabel: String(agenda.dateLabel || ''),
    venue: String(agenda.venue || ''),
    sessions: agenda.sessions,
  }
  const updatedAt = new Date().toISOString()
  const row = { edition, data: clean, sourceFile: agenda.sourceFile ?? null, updatedAt }
  const conflict = () =>
    NextResponse.json(
      { error: 'Someone else saved this agenda while you had it open. Load their version, then make your change again.', conflict: true },
      { status: 409 }
    )

  const { data: current, error: readError } = await supabase.from('agendas').select('updatedAt').eq('edition', edition).maybeSingle()
  if (readError) {
    const hint = setupHint('agendas', readError)
    if (hint) return NextResponse.json({ error: hint, migration: true }, { status: 400 })
    return NextResponse.json({ error: readError.message }, { status: 500 })
  }

  if (!current) {
    const { error } = await supabase.from('agendas').insert(row)
    if (error) {
      const hint = setupHint('agendas', error)
      if (hint) return NextResponse.json({ error: hint, migration: true }, { status: 400 })
      // Someone created this edition's agenda between the read and the write.
      if (/duplicate key|already exists|conflict/i.test(error.message || '')) return conflict()
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, updatedAt })
  }

  if (!sameInstant(base, current.updatedAt)) return conflict()
  const { data: saved, error } = await supabase
    .from('agendas')
    .update(row)
    .eq('edition', edition)
    .eq('updatedAt', current.updatedAt)
    .select('edition')
  if (error) {
    const hint = setupHint('agendas', error)
    if (hint) return NextResponse.json({ error: hint, migration: true }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // Nothing matched: the row moved on between the check and the write.
  if (!saved || saved.length === 0) return conflict()
  return NextResponse.json({ ok: true, updatedAt })
}

export async function DELETE(req: NextRequest) {
  const edition = (req.nextUrl.searchParams.get('edition') || '').trim()
  if (!edition) return NextResponse.json({ error: 'edition is required' }, { status: 400 })
  const { error } = await supabase.from('agendas').delete().eq('edition', edition)
  if (error) {
    const hint = setupHint('agendas', error)
    if (hint) return NextResponse.json({ error: hint, migration: true }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
