'use client'

// Agenda → Confirmed speakers: everyone confirmed to speak at the edition
// (Speaking Confirmed in the CRM, or on the website's line-up), and where
// each sits on the agenda: the panels they are on, with the option they
// gave each (1, 2 or 3), and whether that seat is confirmed or TBC. Those on
// no session yet are listed first, so the gap is plain. People are matched
// to the agenda by name.

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Agenda } from '@/lib/agenda/model'
import { Segmented } from '@/components/workspace/ui'
import type { SpeakerRow } from '@/components/marketing/shared'

type CrmSpeaker = { id: string; firstName: string | null; lastName: string | null; organization: string | null; jobTitle: string | null }
type Seat = { title: string; option: number | null; moderator: boolean; confirmed: boolean; backup: boolean }
type Person = { key: string; name: string; org: string | null; role: string | null; crmId: string | null; seats: Seat[] }

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/^(dr|prof|professor|mr|mrs|ms)\.?\s+/, '').replace(/[^a-z]+/g, ' ').trim()

export function ConfirmedSpeakers({ agenda, edition, lineup }: { agenda: Agenda; edition: string; lineup: SpeakerRow[] }) {
  const [show, setShow] = useState<'all' | 'none' | 'placed'>('all')
  const crmQ = useQuery<{ data: CrmSpeaker[] }>({
    queryKey: ['agenda-confirmed', edition],
    queryFn: async () => {
      const p = new URLSearchParams({ pageSize: '100', sortBy: 'lastName', sortDir: 'asc' })
      p.append('events', edition)
      p.append('statuses', 'Speaking Confirmed')
      const r = await fetch(`/api/speakers?${p}`)
      if (!r.ok) throw new Error('speakers')
      return r.json()
    },
    staleTime: 30_000,
  })

  const people = useMemo(() => {
    const byKey = new Map<string, Person>()
    for (const s of crmQ.data?.data ?? []) {
      const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()
      if (!name) continue
      byKey.set(norm(name), { key: norm(name), name, org: s.organization, role: s.jobTitle, crmId: s.id, seats: [] })
    }
    for (const l of lineup) {
      const k = norm(l.name)
      if (k && !byKey.has(k)) byKey.set(k, { key: k, name: l.name, org: l.org, role: l.role, crmId: null, seats: [] })
    }
    for (const s of agenda.sessions) {
      if (s.type === 'break') continue
      for (const x of s.speakers) {
        const p = byKey.get(norm(x.name))
        if (p) p.seats.push({ title: s.title || 'Untitled session', option: x.option ?? null, moderator: !!x.moderator, confirmed: x.status === 'confirmed', backup: !!x.backup })
      }
    }
    for (const p of byKey.values()) p.seats.sort((a, b) => (a.option ?? 9) - (b.option ?? 9))
    return [...byKey.values()].sort((a, b) => (a.seats.length ? 1 : 0) - (b.seats.length ? 1 : 0) || a.name.localeCompare(b.name))
  }, [crmQ.data, lineup, agenda])

  const none = people.filter((p) => !p.seats.length).length
  const rows = people.filter((p) => show === 'all' || (show === 'none' ? !p.seats.length : p.seats.length > 0))
  if (crmQ.isLoading && !lineup.length) return null

  return (
    <div className="ws-card overflow-hidden mb-4">
      <div className="px-5 pt-4 pb-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>Confirmed speakers <span className="font-normal tabular" style={{ color: 'var(--fg-4)' }}>{people.length}</span></h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--fg-3)' }}>Speaking Confirmed in the CRM or on the website&apos;s line-up, and the sessions they are on, with the option they chose. Matched to the agenda by name.</p>
        </div>
        <Segmented size="sm" value={show} onChange={setShow} options={[
          { value: 'all', label: <span className="inline-flex items-center gap-1.5">All<span className="tabular" style={{ color: 'var(--fg-4)' }}>{people.length}</span></span> },
          { value: 'none', label: <span className="inline-flex items-center gap-1.5">No panel yet<span className="tabular" style={{ color: none ? 'var(--warn)' : 'var(--fg-4)' }}>{none}</span></span> },
          { value: 'placed', label: <span className="inline-flex items-center gap-1.5">On a panel<span className="tabular" style={{ color: 'var(--fg-4)' }}>{people.length - none}</span></span> },
        ]} />
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-[13px]" style={{ color: 'var(--fg-4)' }}>{people.length ? (show === 'none' ? 'Every confirmed speaker is on a session.' : 'Nobody on a session yet.') : 'No speakers confirmed yet.'}</p>
      ) : (
        <ul>
          {rows.map((p) => (
            <li key={p.key} className="px-5 py-2.5 grid grid-cols-1 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-x-6 gap-y-1" style={{ borderTop: '1px solid var(--line-soft)' }}>
              <div className="min-w-0">
                {p.crmId
                  ? <Link href={`/speakers/${p.crmId}`} className="text-[13.5px] font-medium hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{p.name}</Link>
                  : <span className="text-[13.5px] font-medium" style={{ color: 'var(--fg)' }}>{p.name}</span>}
                <p className="text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[p.role, p.org].filter(Boolean).join(', ') || '—'}</p>
              </div>
              <div className="min-w-0 flex flex-col gap-1 justify-center">
                {p.seats.length ? p.seats.map((s, i) => (
                  <p key={i} className="text-[13px] leading-snug" style={{ color: 'var(--fg-2)' }}>
                    <span className="tabular text-[11.5px] font-semibold mr-2" style={{ color: s.option && s.option > 1 ? 'var(--fg-4)' : 'var(--accent-ink)' }}>{s.option ? `Option ${s.option}` : 'Session'}</span>
                    {s.title}
                    <span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>{s.moderator ? ' · moderator' : ''}{s.backup ? ' · backup' : ''}</span>
                    <span className="text-[12px] ml-1.5" style={{ color: s.confirmed ? 'var(--ok)' : 'var(--warn)' }}>{s.confirmed ? 'Confirmed' : 'TBC'}</span>
                  </p>
                )) : <p className="text-[13px]" style={{ color: 'var(--warn)' }}>No panel chosen yet</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
