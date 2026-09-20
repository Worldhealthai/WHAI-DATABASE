// GET /api/agenda/export?edition=…&style=classic|designed  → a .docx download
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { agendaToDocx } from '@/lib/agenda/exportDocx'
import type { Agenda } from '@/lib/agenda/model'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const edition = (req.nextUrl.searchParams.get('edition') || '').trim()
  const style = req.nextUrl.searchParams.get('style') === 'designed' ? 'designed' : 'classic'
  if (!edition) return NextResponse.json({ error: 'edition is required' }, { status: 400 })
  const { data, error } = await supabase.from('agendas').select('data').eq('edition', edition).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No agenda for this edition yet.' }, { status: 404 })
  const agenda = data.data as Agenda
  const buf = await agendaToDocx(agenda, style)
  const safe = edition.replace(/[^A-Za-z0-9]+/g, '_')
  const name = `${safe}_Agenda${style === 'designed' ? '_Designed' : ''}.docx`
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}
