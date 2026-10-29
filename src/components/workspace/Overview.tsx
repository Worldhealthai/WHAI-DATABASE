'use client'

// The first screen inside a workspace: how this edition is going, at a glance.

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { KINDS, listParams, recordName, recordSubtitle, type RecordKind } from '@/lib/recordKinds'
import { workspaceHref } from '@/lib/portals'
import { Initials, Segmented, StagePill, formatMoney, timeAgo } from './ui'
import { WaveBand } from './WaveBand'
import { WorkspacePage } from './WorkspacePage'
import type { Account } from '@/lib/segments'
import { AgendaSummary } from '@/components/agenda/AgendaSummary'

interface Stats {
  total: number
  byStatus: Record<string, number>
  value: { total: number; byStatus: Record<string, number>; currency: string }
}

function useKindStats(kind: RecordKind, labels: string[]) {
  return useQuery<Stats>({
    queryKey: ['ws-stats', kind, labels],
    queryFn: async () => {
      const p = new URLSearchParams({ kind })
      labels.forEach((l) => p.append('events', l))
      const r = await fetch(`/api/workspace/stats?${p}`)
      if (!r.ok) throw new Error('stats')
      return r.json()
    },
    enabled: labels.length > 0,
    staleTime: 30_000,
  })
}

function useRecent(kind: RecordKind, labels: string[]) {
  return useQuery<{ data: Record<string, any>[] }>({
    queryKey: ['ws-recent', kind, labels],
    queryFn: async () => {
      const p = listParams(kind, labels, { page: '1', pageSize: '6', sortBy: 'createdAt', sortDir: 'desc' })
      const r = await fetch(`${KINDS[kind].api}?${p}`)
      if (!r.ok) throw new Error('recent')
      return r.json()
    },
    enabled: labels.length > 0,
    staleTime: 30_000,
  })
}

// Conversations gone quiet: the sponsors and speakers in play (emailed or
// in discussion; invited or discussing) whose record has not moved for the
// longest, oldest first, to chase.
const QUIET: { kind: RecordKind; statuses: string[]; title: string; section: string }[] = [
  { kind: 'sponsor', statuses: ['Emailed', 'In Discussion'], title: 'Sponsors', section: 'pipeline' },
  { kind: 'speaker', statuses: ['Invited', 'Discussing'], title: 'Speakers', section: 'production' },
]
const daysSince = (d: string | null | undefined) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 864e5) : null)

function useQuiet(kind: RecordKind, statuses: string[], labels: string[]) {
  return useQuery<{ data: Record<string, any>[]; total: number }>({
    queryKey: ['ws-quiet', kind, labels],
    queryFn: async () => {
      const p = listParams(kind, labels, { page: '1', pageSize: '5', sortBy: 'updatedAt', sortDir: 'asc', statuses })
      const r = await fetch(`${KINDS[kind].api}?${p}`)
      if (!r.ok) throw new Error('quiet')
      return r.json()
    },
    enabled: labels.length > 0,
    staleTime: 30_000,
  })
}

function FollowUps({ labels }: { labels: string[] }) {
  const ws = useWorkspace()
  const lists = [useQuiet('sponsor', QUIET[0].statuses, labels), useQuiet('speaker', QUIET[1].statuses, labels)]
  return (
    <div className="ws-card px-5 py-4">
      <p className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Follow up</p>
      <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--fg-3)' }}>Conversations that have gone quiet longest.</p>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-3">
        {QUIET.map((q, i) => {
          const { data, isLoading } = lists[i]
          const rows = data?.data ?? []
          return (
            <div key={q.kind} className="min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-4)' }}>{q.title}</span>
                {ws.portal && ws.slug && (
                  <Link href={workspaceHref(ws.portal.key, ws.slug, q.section, ws.year ?? undefined)} className="text-[12px] hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
                    {data?.total ?? 0} in play
                  </Link>
                )}
              </div>
              {isLoading ? (
                <div className="flex flex-col gap-1.5">{[0, 1, 2].map((k) => <div key={k} className="h-9 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div>
              ) : rows.length === 0 ? (
                <p className="text-[12.5px] py-2" style={{ color: 'var(--fg-4)' }}>Nothing waiting.</p>
              ) : (
                <ul>
                  {rows.map((r) => {
                    const days = daysSince(r.updatedAt)
                    return (
                      <li key={r.id}>
                        <Link href={`${KINDS[q.kind].detailPath}/${r.id}`} className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-[var(--surface-2)]">
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--fg)' }}>{recordName(q.kind, r) || 'Unnamed'}</span>
                            <span className="block text-[11.5px] truncate" style={{ color: 'var(--fg-4)' }}>{KINDS[q.kind].statusLabel(r.status)}</span>
                          </span>
                          {days !== null && (
                            <span className="text-[12px] tabular shrink-0" style={{ color: days >= 14 ? 'var(--warn)' : 'var(--fg-4)' }}>{days === 0 ? 'today' : `${days}d`}</span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Who is coming: the people attending or speaking, by their company's type,
// and the end-user organisations sending the most (lib/segments, the same
// data as Companies).
function WhosComing({ labels }: { labels: string[] }) {
  const ws = useWorkspace()
  const { data, isLoading } = useQuery<{ accounts: Account[] }>({
    queryKey: ['ws-segments', labels],
    queryFn: async () => {
      const p = new URLSearchParams()
      labels.forEach((l) => p.append('events', l))
      const r = await fetch(`/api/segments?${p}`)
      if (!r.ok) throw new Error('segments')
      return r.json()
    },
    enabled: labels.length > 0,
    staleTime: 60_000,
  })
  let eu = 0, sp = 0
  const orgs: { name: string; n: number; href: string }[] = []
  for (const a of data?.accounts ?? []) {
    const coming = (a.members ?? []).filter((m) => m.records.some((r) => r.relationship === 'Delegate' || r.relationship === 'Speaker')).length
    if (!coming) continue
    if (a.firmographic === 'End User') { eu += coming; orgs.push({ name: a.name, n: coming, href: `/${a.open.table}/${a.open.id}` }) }
    else sp += coming
  }
  orgs.sort((x, y) => y.n - x.n)
  const total = eu + sp
  const pct = total ? Math.round((eu / total) * 100) : 0
  return (
    <div className="ws-card px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Who&rsquo;s coming</p>
        {ws.portal && ws.slug && (
          <Link href={workspaceHref(ws.portal.key, ws.slug, 'companies', ws.year ?? undefined)} className="text-[12px] hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>Companies</Link>
        )}
      </div>
      {isLoading ? (
        <div className="h-24 mt-3 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
      ) : total === 0 ? (
        <p className="text-[12.5px] mt-2" style={{ color: 'var(--fg-4)' }}>No one attending or speaking yet.</p>
      ) : (
        <>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--fg-3)' }}>
            {total} attending or speaking: <span className="font-semibold" style={{ color: 'var(--fg)' }}>{pct}% end users</span>
          </p>
          <div className="flex h-2 rounded-full overflow-hidden gap-px mt-3" style={{ background: 'var(--surface-3)' }}>
            <span style={{ width: `${pct}%`, background: 'var(--accent)' }} title={`End users: ${eu}`} />
            <span style={{ width: `${100 - pct}%`, background: 'var(--line-3)' }} title={`Solution providers: ${sp}`} />
          </div>
          <div className="flex gap-4 mt-2 text-[12px]" style={{ color: 'var(--fg-3)' }}>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />End users <span className="tabular font-medium" style={{ color: 'var(--fg)' }}>{eu}</span></span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--line-3)' }} />Solution providers <span className="tabular font-medium" style={{ color: 'var(--fg)' }}>{sp}</span></span>
          </div>
          {orgs.length > 0 && (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-wider mt-4 mb-1" style={{ color: 'var(--fg-4)' }}>Top end-user organisations</p>
              <ul>
                {orgs.slice(0, 6).map((o) => (
                  <li key={o.name}>
                    <Link href={o.href} className="flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-[var(--surface-2)]">
                      <span className="text-[13px] truncate" style={{ color: 'var(--fg)' }}>{o.name}</span>
                      <span className="text-[12px] tabular shrink-0" style={{ color: 'var(--fg-3)' }}>{o.n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}

// The newest records, one kind at a time.
function Recent({ labels }: { labels: string[] }) {
  const ws = useWorkspace()
  const [kind, setKind] = useState<RecordKind>('sponsor')
  const def = KINDS[kind]
  const { data, isLoading } = useRecent(kind, labels)
  const rows = data?.data ?? []
  const listHref = ws.portal && ws.slug ? workspaceHref(ws.portal.key, ws.slug, kind === 'partner' ? 'partners' : `${kind}s`, ws.year ?? undefined) : '#'
  return (
    <div className="ws-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <p className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Recently added</p>
        <Segmented
          size="sm"
          value={kind}
          onChange={setKind}
          options={(['sponsor', 'partner', 'speaker', 'delegate'] as RecordKind[]).map((k) => ({ value: k, label: k === 'partner' ? 'Partners' : KINDS[k].plural }))}
        />
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2 px-5 pb-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-[13px] px-5 pb-8 pt-4 text-center" style={{ color: 'var(--fg-4)' }}>No {def.plural.toLowerCase()} in this edition yet.</p>
      ) : (
        <ul className="px-3 pb-2">
          {rows.map((r) => {
            const name = recordName(kind, r)
            return (
              <li key={r.id}>
                <Link href={`${def.detailPath}/${r.id}`} className="flex items-center gap-3 py-2 px-2 rounded-lg transition-colors hover:bg-[var(--surface-2)]">
                  <Initials name={name || '?'} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{name || 'Unnamed'}</span>
                    <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{recordSubtitle(kind, r) || '—'}</span>
                  </span>
                  <StagePill kind={kind} status={r.status} className="hidden sm:inline-flex" />
                  <span className="text-[11.5px] tabular w-14 text-right shrink-0" style={{ color: 'var(--fg-4)' }}>{timeAgo(r.createdAt)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <div className="px-5 py-3" style={{ borderTop: '1px solid var(--line)' }}>
        <Link href={listHref} className="text-[12.5px] font-medium inline-flex items-center gap-1 hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
          All {def.plural.toLowerCase()} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}

export function Overview() {
  const ws = useWorkspace()
  const { portal, labels, year } = ws
  const kinds: RecordKind[] = ['sponsor', 'partner', 'speaker', 'delegate']
  const stats: Record<RecordKind, ReturnType<typeof useKindStats>> = {
    sponsor: useKindStats('sponsor', labels),
    partner: useKindStats('partner', labels),
    speaker: useKindStats('speaker', labels),
    delegate: useKindStats('delegate', labels),
  }
  const loading = kinds.some((k) => stats[k].isLoading)
  const s = stats.sponsor.data, p = stats.partner.data, sp = stats.speaker.data, dl = stats.delegate.data

  const tiles: { label: string; value: React.ReactNode; hint?: React.ReactNode }[] = [
    {
      label: 'Confirmed sponsors',
      value: s?.byStatus['Confirmed'] ?? 0,
      hint: s?.value.byStatus['Confirmed']
        ? `${formatMoney(s.value.byStatus['Confirmed'], s.value.currency)} · ${(s?.byStatus['Emailed'] ?? 0) + (s?.byStatus['In Discussion'] ?? 0)} in conversation`
        : `${(s?.byStatus['Emailed'] ?? 0) + (s?.byStatus['In Discussion'] ?? 0)} in conversation · ${s?.byStatus['Not Contacted'] ?? 0} to contact`,
    },
    { label: 'Partners confirmed', value: p?.byStatus['Confirmed'] ?? 0, hint: `${p?.total ?? 0} partners & media in total` },
    {
      label: 'Speakers confirmed',
      value: sp?.byStatus['Speaking Confirmed'] ?? 0,
      hint: `${(sp?.byStatus['Invited'] ?? 0) + (sp?.byStatus['Discussing'] ?? 0)} in conversation · ${sp?.total ?? 0} in total`,
    },
    {
      label: 'Delegates registered',
      value: (dl?.byStatus['Registered'] ?? 0) + (dl?.byStatus['Confirmed'] ?? 0),
      hint: `${dl?.byStatus['Confirmed'] ?? 0} invited to the calendar`,
    },
  ]

  const empty = !loading && kinds.every((k) => (stats[k].data?.total ?? 0) === 0)


  return (
    <WorkspacePage title="Overview" description={`How the ${year} edition is going.`}>
      {/* The four numbers that matter, on the wave band */}
      <WaveBand kicker={`${year} edition`} items={tiles} loading={loading} />

      {empty && portal && ws.slug && (
        <div className="ws-card mt-4 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Nothing in the {year} edition yet</p>
            <p className="text-[13px]" style={{ color: 'var(--fg-3)' }}>Start the pipeline with the sponsors to chase; speakers and delegates appear as they are added or register.</p>
          </div>
          <Link href={workspaceHref(portal.key, ws.slug, 'pipeline', year ?? undefined)} className="ws-btn ws-btn-primary">Open the pipeline <ArrowRight className="w-4 h-4" /></Link>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4 mt-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <FollowUps labels={labels} />
          <WhosComing labels={labels} />
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          <AgendaSummary />
          <Recent labels={labels} />
        </div>
      </div>
    </WorkspacePage>
  )
}
