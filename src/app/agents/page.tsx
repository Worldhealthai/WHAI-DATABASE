'use client'

// Tools → Agents' work: every sponsor and speaker lead Control Room's agents
// handed over ("Add to CRM"), newest first, with the agent that found each.
// Filter by agent, by kind (sponsors / speakers) and by event; each row
// opens the record in Sales or Production, at whatever stage it has reached.
// The agent's reasoning, evidence and source are in the record's notes.

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bot, Search } from 'lucide-react'
import { EmptyState, Segmented, Stat, timeAgo } from '@/components/workspace/ui'

type Lead = { kind: 'sponsor' | 'speaker'; id: string; name: string; sub: string | null; event: string | null; status: string; agent: string; agentName: string; at: string | null }
type Kind = 'all' | 'sponsor' | 'speaker'
const WON = /confirmed|active/i
const LOST = /rejected|cancelled/i

export default function AgentsPage() {
  const [kind, setKind] = useState<Kind>('all')
  const [agent, setAgent] = useState<string>('')
  const [event, setEvent] = useState<string>('')
  const [q, setQ] = useState('')
  const { data, isLoading, error } = useQuery<{ leads: Lead[] }>({
    queryKey: ['agents-work'],
    queryFn: async () => {
      const r = await fetch('/api/agents')
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || 'Could not load the agents’ leads.')
      return r.json()
    },
  })
  const all = useMemo(() => data?.leads ?? [], [data])
  const agents = useMemo(() => {
    const m = new Map<string, { name: string; sponsors: number; speakers: number; won: number }>()
    for (const l of all) {
      const a = m.get(l.agent) ?? { name: l.agentName, sponsors: 0, speakers: 0, won: 0 }
      a[l.kind === 'sponsor' ? 'sponsors' : 'speakers']++
      if (WON.test(l.status)) a.won++
      m.set(l.agent, a)
    }
    return [...m.entries()].sort((a, b) => b[1].sponsors + b[1].speakers - (a[1].sponsors + a[1].speakers))
  }, [all])
  const events = useMemo(() => [...new Set(all.map((l) => l.event).filter((e): e is string => !!e))].sort(), [all])
  const rows = all.filter((l) =>
    (kind === 'all' || l.kind === kind) && (!agent || l.agent === agent) && (!event || l.event === event) &&
    (!q.trim() || `${l.name} ${l.sub ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())))
  const sponsors = all.filter((l) => l.kind === 'sponsor').length

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="crm-title">Agents&apos; work</h1>
        <p className="crm-sub">Sponsor and speaker leads your Control Room agents added to the CRM, and where each one has got to. The agent&apos;s reasoning and sources are in the record&apos;s notes.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Leads from agents" value={all.length} loading={isLoading} hint={`${agents.length} agent${agents.length === 1 ? '' : 's'}`} />
        <Stat label="Sponsor leads" value={sponsors} loading={isLoading} hint="In Sales" />
        <Stat label="Speaker leads" value={all.length - sponsors} loading={isLoading} hint="In Production" />
        <Stat label="Won" value={all.filter((l) => WON.test(l.status)).length} loading={isLoading} hint="Confirmed sponsors and speakers" />
      </div>

      {agents.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by agent">
          <button type="button" onClick={() => setAgent('')} className={`ws-btn ws-btn-sm ${!agent ? 'ws-btn-primary' : ''}`}>Every agent</button>
          {agents.map(([key, a]) => (
            <button key={key} type="button" onClick={() => setAgent(agent === key ? '' : key)} className={`ws-btn ws-btn-sm ${agent === key ? 'ws-btn-primary' : ''}`} title={`${a.sponsors} sponsor and ${a.speakers} speaker leads · ${a.won} won`}>
              <Bot className="w-3.5 h-3.5" /> {a.name} <span className="tabular" style={{ opacity: 0.7 }}>{a.sponsors + a.speakers}</span>
            </button>
          ))}
        </div>
      )}

      <div className="ws-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <Segmented size="sm" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'sponsor', label: 'Sponsors' }, { value: 'speaker', label: 'Speakers' }]} />
          {events.length > 1 && (
            <select className="ws-input h-8 text-[13px] py-0 pr-7 w-auto" value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Event">
              <option value="">Every event</option>
              {events.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
          <label className="relative flex-1 min-w-[180px] max-w-[320px] ml-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-4)' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names or companies…" className="ws-input" style={{ paddingLeft: 34 }} />
          </label>
        </div>
        {error ? <EmptyState icon={Bot} title="Couldn’t load the leads" body={(error as Error).message} />
          : isLoading ? <div className="flex flex-col gap-2 p-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div>
          : rows.length === 0 ? <EmptyState icon={Bot} title={all.length ? 'Nobody here' : 'No leads from agents yet'} body={all.length ? 'Try another filter.' : 'Leads appear here when you press “Add to CRM” on a sponsor or speaker in Control Room.'} />
          : (
            <ul>
              {rows.map((l) => (
                <li key={`${l.kind}-${l.id}`} style={{ borderTop: '1px solid var(--line)' }}>
                  <Link href={`/${l.kind}s/${l.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_200px_180px_110px] items-center gap-x-4 gap-y-1 px-4 py-2.5 transition-colors hover:bg-[var(--surface-2)]">
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{l.name}</span>
                      <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{l.kind === 'sponsor' ? 'Sponsor' : 'Speaker'}{l.sub ? ` · ${l.sub}` : ''}</span>
                    </span>
                    <span className="hidden md:block text-[12.5px] truncate" style={{ color: 'var(--fg-2)' }}><Bot className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{l.agentName}</span>
                    <span className="hidden md:block text-[12.5px] truncate" style={{ color: 'var(--fg-3)' }}>{l.event ?? '—'}</span>
                    <span className="text-right">
                      <span className="block text-[12.5px]" style={{ color: WON.test(l.status) ? 'var(--ok)' : LOST.test(l.status) ? 'var(--bad)' : 'var(--fg-2)' }}>{l.status}</span>
                      {l.at && <span className="block text-[11.5px]" style={{ color: 'var(--fg-4)' }}>{timeAgo(l.at)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  )
}
