'use client'

// The agenda at a glance on the portal overview: sessions, seats filled,
// who is still to confirm, and exactly what is still needed
// ("2 moderators and 3 speakers"). Same card in Production and Sales.

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { type Agenda, agendaStats, needsLabel, normaliseAgenda, sessionNeeds } from '@/lib/agenda/model'
import { useEdition } from '@/components/marketing/shared'

export function AgendaSummary() {
  const { href, year } = useWorkspace()
  const ed = useEdition()
  const edition = ed?.label ?? null
  const q = useQuery<{ agenda: Agenda | null; error?: string }>({
    queryKey: ['agenda', edition ?? ''],
    queryFn: async () => {
      const r = await fetch(`/api/agenda?edition=${encodeURIComponent(edition!)}`, { cache: 'no-store' })
      return r.json().catch(() => ({ agenda: null }))
    },
    enabled: Boolean(edition),
  })
  const agenda = q.data?.agenda ? normaliseAgenda(q.data.agenda) : null
  const st = agenda ? agendaStats(agenda) : null
  const due = st ? needsLabel({ moderators: st.needModerators, speakers: st.needSpeakers }) : ''
  const short = agenda ? agenda.sessions.filter((s) => s.type !== 'break').map((s) => ({ s, n: sessionNeeds(s) })).filter((x) => x.n.moderators + x.n.speakers > 0) : []

  return (
    <div className="ws-card">
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="text-[15px] font-semibold inline-flex items-center gap-2" style={{ color: 'var(--fg)' }}><CalendarDays className="w-4 h-4" style={{ color: 'var(--fg-3)' }} /> Agenda</p>
        <Link href={href('agenda')} className="inline-flex items-center gap-1 text-[13px] font-medium hover:underline underline-offset-4" style={{ color: 'var(--accent-ink)' }}>Open agenda <ArrowRight className="w-3.5 h-3.5" /></Link>
      </div>
      {!agenda || !st ? (
        <p className="px-5 py-6 text-[13px]" style={{ color: 'var(--fg-3)' }}>{q.isLoading ? 'Loading…' : `No ${year} agenda yet. Open Agenda to upload the Word agenda or start one from scratch.`}</p>
      ) : (
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div><p className="text-[22px] font-semibold tabular leading-none" style={{ color: 'var(--fg)' }}>{st.sessions}</p><p className="text-[12px] mt-1" style={{ color: 'var(--fg-3)' }}>sessions</p></div>
            <div><p className="text-[22px] font-semibold tabular leading-none" style={{ color: 'var(--ok)' }}>{st.confirmed}<span className="text-[13px] font-medium" style={{ color: 'var(--fg-4)' }}> / {st.seats}</span></p><p className="text-[12px] mt-1" style={{ color: 'var(--fg-3)' }}>seats confirmed</p></div>
            <div><p className="text-[22px] font-semibold tabular leading-none" style={{ color: st.tbc ? 'var(--warn)' : 'var(--fg)' }}>{st.tbc}</p><p className="text-[12px] mt-1" style={{ color: 'var(--fg-3)' }}>to confirm</p></div>
          </div>
          <p className="text-[13.5px] mt-4 font-medium" style={{ color: due ? 'var(--warn)' : 'var(--ok)' }}>
            {due ? `You still need ${due}.` : 'Every seat is filled.'}
          </p>
          {short.length > 0 && (
            <ul className="mt-2 space-y-1">
              {short.slice(0, 5).map(({ s, n }) => (
                <li key={s.id} className="text-[12.5px] flex gap-2" style={{ color: 'var(--fg-3)' }}>
                  <span className="tabular shrink-0" style={{ color: 'var(--fg-4)' }}>{s.start}</span>
                  <span className="truncate" style={{ color: 'var(--fg-2)' }}>{s.title}</span>
                  <span className="ml-auto shrink-0" style={{ color: 'var(--warn)' }}>{needsLabel(n)}</span>
                </li>
              ))}
              {short.length > 5 && <li className="text-[12px]" style={{ color: 'var(--fg-4)' }}>and {short.length - 5} more sessions</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
