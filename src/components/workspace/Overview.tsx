'use client'

// The first screen inside a workspace: how this edition is going, at a glance.

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { KINDS, listParams, recordName, recordSubtitle, type RecordKind } from '@/lib/recordKinds'
import { workspaceHref } from '@/lib/portals'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { Initials, Stat, StageDot, formatMoney, timeAgo } from './ui'
import { WorkspacePage } from './WorkspacePage'

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

function StageBars({ kind, stats, loading }: { kind: RecordKind; stats?: Stats; loading: boolean }) {
  const def = KINDS[kind]
  const total = stats?.total ?? 0
  return (
    <div className="ws-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>{def.plural} by stage</p>
        <span className="text-[12px] tabular" style={{ color: 'var(--fg-3)' }}>{loading ? '' : `${total} total`}</span>
      </div>
      <div className="flex flex-col gap-3">
        {def.stages.map((s) => {
          const n = stats?.byStatus[s.status] ?? 0
          const pct = total ? (n / total) * 100 : 0
          const v = stats?.value.byStatus[s.status]
          return (
            <div key={s.status} className="flex items-center gap-3">
              <span className="w-[120px] shrink-0 flex items-center gap-2 text-[13px]" style={{ color: 'var(--fg-2)' }}>
                <StageDot hex={s.hex} /> {s.label}
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.hex }} />
              </div>
              <span className="w-8 text-right text-[13px] tabular font-medium" style={{ color: 'var(--fg)' }}>{loading ? '·' : n}</span>
              {def.hasValue && (
                <span className="w-[88px] text-right text-[12px] tabular" style={{ color: 'var(--fg-4)' }}>{v ? formatMoney(v, stats?.value.currency) : ''}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Recent({ kind, labels }: { kind: RecordKind; labels: string[] }) {
  const ws = useWorkspace()
  const def = KINDS[kind]
  const { data, isLoading } = useRecent(kind, labels)
  const rows = data?.data ?? []
  const listHref = ws.portal && ws.slug ? workspaceHref(ws.portal.key, ws.slug, def.kind === 'partner' ? 'partners' : `${def.kind}s`, ws.year ?? undefined) : '#'
  return (
    <div className="ws-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Recently added {def.plural.toLowerCase()}</p>
        <Link href={listHref} className="text-[12.5px] font-medium inline-flex items-center gap-1 hover:underline underline-offset-4" style={{ color: 'var(--accent-ink)' }}>
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-11 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-[13px] py-6 text-center" style={{ color: 'var(--fg-4)' }}>Nothing for this edition yet.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => {
            const name = recordName(kind, r)
            return (
              <li key={r.id}>
                <Link href={`${def.detailPath}/${r.id}`} className="flex items-center gap-3 py-2 -mx-2 px-2 rounded-lg transition-colors hover:bg-[var(--surface-2)]">
                  <Initials name={name || '?'} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{name || 'Unnamed'}</span>
                    <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{recordSubtitle(kind, r) || '—'}</span>
                  </span>
                  <StatusBadge value={r.status} variant={def.badgeVariant} />
                  <span className="text-[11.5px] tabular w-14 text-right" style={{ color: 'var(--fg-4)' }}>{timeAgo(r.createdAt)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function Overview() {
  const ws = useWorkspace()
  const { portal, labels, year } = ws
  const kinds = (portal?.entities ?? []) as RecordKind[]
  const a = useKindStats(kinds[0] ?? 'sponsor', labels)
  const b = useKindStats(kinds[1] ?? 'partner', labels)
  const loading = a.isLoading || b.isLoading

  const tiles: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'default' | 'accent' | 'ok' | 'warn' }[] = []
  if (portal?.key === 'sales') {
    const s = a.data, p = b.data
    const confirmed = s?.byStatus['Confirmed'] ?? 0
    const inPlay = (s?.byStatus['Emailed'] ?? 0) + (s?.byStatus['In Discussion'] ?? 0)
    const notYet = s?.byStatus['Not Contacted'] ?? 0
    tiles.push(
      { label: 'Confirmed sponsors', value: confirmed, hint: s?.value.byStatus['Confirmed'] ? `${formatMoney(s.value.byStatus['Confirmed'], s.value.currency)} confirmed` : 'No value recorded yet', tone: 'ok' },
      { label: 'In conversation', value: inPlay, hint: `${s?.byStatus['In Discussion'] ?? 0} in discussion · ${s?.byStatus['Emailed'] ?? 0} emailed`, tone: 'accent' },
      { label: 'Still to contact', value: notYet, hint: notYet ? 'Leads waiting for a first email' : 'Every lead has been contacted', tone: notYet ? 'warn' : 'default' },
      { label: 'Partners confirmed', value: p?.byStatus['Confirmed'] ?? 0, hint: `${p?.total ?? 0} partners & media in total` },
    )
  } else {
    const sp = a.data, dl = b.data
    const confirmed = sp?.byStatus['Speaking Confirmed'] ?? 0
    const talking = (sp?.byStatus['Invited'] ?? 0) + (sp?.byStatus['Discussing'] ?? 0)
    const registered = (dl?.byStatus['Registered'] ?? 0) + (dl?.byStatus['Confirmed'] ?? 0)
    tiles.push(
      { label: 'Speakers confirmed', value: confirmed, hint: `${sp?.total ?? 0} speaker leads in total`, tone: 'ok' },
      { label: 'Speakers in conversation', value: talking, hint: `${sp?.byStatus['Discussing'] ?? 0} discussing · ${sp?.byStatus['Invited'] ?? 0} invited`, tone: 'accent' },
      { label: 'Delegates registered', value: registered, hint: `${dl?.byStatus['Confirmed'] ?? 0} invited to the calendar` },
      { label: 'Cancelled / no-show', value: (dl?.byStatus['Cancelled'] ?? 0) + (dl?.byStatus['No-show'] ?? 0), hint: `${dl?.byStatus['Rejected'] ?? 0} rejected`, tone: 'warn' },
    )
  }

  const empty = !loading && (a.data?.total ?? 0) + (b.data?.total ?? 0) === 0

  return (
    <WorkspacePage
      title="Overview"
      description={portal?.key === 'sales' ? 'Sponsorship and partnerships for this edition.' : 'Speakers and delegates for this edition.'}
    >
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {tiles.map((t) => <Stat key={t.label} {...t} loading={loading} />)}
      </div>

      {empty && portal && ws.slug && (
        <div className="ws-card mt-4 p-5 flex flex-wrap items-center justify-between gap-4" style={{ borderColor: 'var(--accent-line)', background: 'var(--accent-soft)' }}>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface)', color: 'var(--accent-ink)' }}><Sparkles className="w-5 h-5" /></span>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Nothing in the {year} edition yet</p>
              <p className="text-[13px]" style={{ color: 'var(--fg-3)' }}>
                {portal.key === 'sales' ? 'Start the pipeline: add the leads you will be chasing for this edition.' : 'Speakers and delegates appear here as they are added or register.'}
              </p>
            </div>
          </div>
          {portal.key === 'sales' && (
            <Link href={workspaceHref(portal.key, ws.slug, 'pipeline', year ?? undefined)} className="ws-btn ws-btn-primary">Open the pipeline <ArrowRight className="w-4 h-4" /></Link>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {kinds.map((k) => <StageBars key={k} kind={k} stats={k === kinds[0] ? a.data : b.data} loading={loading} />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {kinds.map((k) => <Recent key={k} kind={k} labels={labels} />)}
      </div>
    </WorkspacePage>
  )
}
