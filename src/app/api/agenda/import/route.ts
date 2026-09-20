// POST /api/agenda/import  (multipart: file=<.docx>, edition=<label>)
//
// Reads the team's Word agenda into the digital model and saves it for
// the edition, replacing what was there. Returns the parsed agenda.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseAgendaDocx } from '@/lib/agenda/parseDocx'
import { agendaStats } from '@/lib/agenda/model'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    const edition = String(form.get('edition') || '').trim()
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a .docx file.' }, { status: 400 })
    if (!edition) return NextResponse.json({ error: 'edition is required' }, { status: 400 })
    if (!/\.docx$/i.test(file.name)) return NextResponse.json({ error: 'Only Word .docx files can be read. Save the agenda as .docx and try again.' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const agenda = await parseAgendaDocx(buf, file.name)

    const { error } = await supabase
      .from('agendas')
      .upsert({ edition, data: { title: agenda.title, dateLabel: agenda.dateLabel, venue: agenda.venue, sessions: agenda.sessions }, sourceFile: file.name, updatedAt: new Date().toISOString() }, { onConflict: 'edition' })
    if (error) {
      if (/agendas/.test(error.message || '')) return NextResponse.json({ error: 'The agendas table is missing — run supabase/migrations/008_agendas.sql first.', migration: true }, { status: 400 })
      throw error
    }
    return NextResponse.json({ ok: true, agenda, stats: agendaStats(agenda) })
  } catch (error: any) {
    console.error('agenda import error:', error)
    return NextResponse.json({ error: String(error?.message || 'Could not read that document.').slice(0, 300) }, { status: 400 })
  }
}
