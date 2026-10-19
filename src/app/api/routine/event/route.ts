// The Production Manager agent's view of an edition, read-only. Reached with
// the agent's own key (Authorization: Bearer AGENT_READ_TOKEN, which opens
// only this route, GET only) or, like every /api route, a CRM session or the
// shared webhook secret (proxy.ts).
//   GET                      → { editions: [...] } (the editions with an agenda)
//   GET ?edition=<label>     → the agenda in running order with each session's
//                              seats, who is named (confirmed or TBC) and what is
//                              still open; the line-up and sponsors for that
//                              edition by status. No emails, phones or fees.
import { NextRequest, NextResponse } from 'next/server'
import { setupHint, supabase } from '@/lib/supabase'
import { agendaStats, normaliseAgenda, sessionNeeds, sessionSeats, type Agenda } from '@/lib/agenda/model'

export const dynamic = 'force-dynamic'

type Row = Record<string, unknown>

function failed(table: 'agendas' | 'speakers' | 'sponsors', error: Parameters<typeof setupHint>[1]) {
  const hint = setupHint(table, error)
  if (hint) return NextResponse.json({ error: hint, migration: true }, { status: 400 })
  return NextResponse.json({ error: error?.message ?? `Couldn't read ${table}` }, { status: 500 })
}

const countBy = (rows: Row[], key: string) =>
  rows.reduce<Record<string, number>>((acc, r) => {
    const k = String(r[key] ?? 'Not set')
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

export async function GET(req: NextRequest) {
  const edition = (req.nextUrl.searchParams.get('edition') || '').trim()

  if (!edition) {
    const { data, error } = await supabase.from('agendas').select('edition, "updatedAt"').order('edition')
    if (error) return failed('agendas', error)
    return NextResponse.json({ editions: (data ?? []).map((r: Row) => ({ edition: r.edition, updatedAt: r.updatedAt })) })
  }

  const [agendaRes, speakersRes, sponsorsRes] = await Promise.all([
    supabase.from('agendas').select('data, "updatedAt"').eq('edition', edition).maybeSingle(),
    supabase
      .from('speakers')
      .select('firstName, lastName, organization, jobTitle, status, sessionTitle, sessionType, contractStatus')
      .eq('event', edition),
    supabase.from('sponsors').select('companyName, tier, status, contractStatus').eq('event', edition),
  ])
  if (agendaRes.error) return failed('agendas', agendaRes.error)
  if (speakersRes.error) return failed('speakers', speakersRes.error)
  if (sponsorsRes.error) return failed('sponsors', sponsorsRes.error)

  const agenda = agendaRes.data ? normaliseAgenda(agendaRes.data.data as Agenda) : null
  const speakers = (speakersRes.data ?? []) as Row[]
  const sponsors = (sponsorsRes.data ?? []) as Row[]

  return NextResponse.json({
    edition,
    agenda: agenda && {
      title: agenda.title,
      date: agenda.dateLabel,
      venue: agenda.venue,
      updatedAt: agendaRes.data?.updatedAt,
      totals: agendaStats(agenda),
      sessions: agenda.sessions.map((s) => {
        const open = sessionNeeds(s)
        return {
          time: `${s.start}–${s.end}`,
          title: s.title,
          type: s.type,
          talkTitle: s.talkTitle || undefined,
          points: s.points,
          seats: sessionSeats(s),
          people: s.speakers
            .filter((x) => x.name.trim())
            .map((x) => ({ name: x.name, role: x.role, org: x.org, moderator: x.moderator, status: x.status, backup: x.backup || undefined })),
          open,
        }
      }),
    },
    lineup: {
      total: speakers.length,
      byStatus: countBy(speakers, 'status'),
      people: speakers.map((s) => ({
        name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
        org: s.organization ?? null,
        title: s.jobTitle ?? null,
        status: s.status,
        session: s.sessionTitle ?? null,
        contract: s.contractStatus ?? null,
      })),
    },
    sponsors: {
      total: sponsors.length,
      byStatus: countBy(sponsors, 'status'),
      companies: sponsors.map((s) => ({ name: s.companyName, tier: s.tier ?? null, status: s.status, contract: s.contractStatus ?? null })),
    },
  })
}
