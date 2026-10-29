'use client'

// The first screen inside a workspace: how this edition is going, at a glance.

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { KINDS, listParams, recordName, recordSubtitle, type RecordKind } from '@/lib/recordKinds'
import { workspaceHref } from '@/lib/portals'
import { Initials, Segmented, StageDot, StagePill, formatMoney, timeAgo } from './ui'
import { WorkspacePage } from './WorkspacePage'
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

// Each stage's colour in the overview's bars: won green, lost red, not yet
// contacted a pale grey, and the stages in play the event's colour,
// stronger the further along they are.
function stageColours(kind: RecordKind): Record<string, string> {
  const stages = KINDS[kind].stages
  const live = stages.filter((s) => !s.negative && s.hex !== 'var(--ok)' && s.hex !== 'var(--line-3)')
  const out: Record<string, string> = {}
  for (const s of stages) {
    if (s.negative) out[s.status] = s.hex === 'var(--bad)' ? 'color-mix(in srgb, var(--bad) 70%, var(--surface))' : 'var(--line-2)'
    else if (s.hex === 'var(--ok)') out[s.status] = 'var(--ok)'
    else if (s.hex === 'var(--line-3)') out[s.status] = 'var(--line-2)'
    else {
      const i = live.indexOf(s)
      out[s.status] = `color-mix(in srgb, var(--accent) ${35 + Math.round((45 * (i + 1)) / Math.max(1, live.length))}%, var(--surface))`
    }
  }
  return out
}

// One row per kind: a single bar split by stage, the counts beneath it.
function StageRow({ kind, stats, loading, href }: { kind: RecordKind; stats?: Stats; loading: boolean; href: string }) {
  const def = KINDS[kind]
  const total = stats?.total ?? 0
  const colours = stageColours(kind)
  return (
    <Link href={href} className="block py-4 first:pt-1 last:pb-1 group">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-[13.5px] font-semibold group-hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{def.plural}</span>
        <span className="text-[12.5px] tabular" style={{ color: 'var(--fg-4)' }}>
          {loading ? '' : `${total} in total${def.hasValue && stats?.value.total ? ` · ${formatMoney(stats.value.total, stats.value.currency)}` : ''}`}
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px" style={{ background: 'var(--surface-3)' }}>
        {!loading && total > 0 && def.stages.map((s) => {
          const n = stats?.byStatus[s.status] ?? 0
          return n ? <span key={s.status} style={{ width: `${(n / total) * 100}%`, background: colours[s.status] }} title={`${s.label}: ${n}`} /> : null
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {def.stages.map((s) => (
          <span key={s.status} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--fg-3)' }}>
            <StageDot hex={colours[s.status]} />
            {s.label}
            <span className="tabular font-medium" style={{ color: 'var(--fg)' }}>{loading ? '·' : stats?.byStatus[s.status] ?? 0}</span>
          </span>
        ))}
      </div>
    </Link>
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

  const sectionHref = (k: RecordKind) => (portal && ws.slug ? workspaceHref(portal.key, ws.slug, k === 'partner' ? 'partners' : `${k}s`, year ?? undefined) : '#')

  return (
    <WorkspacePage title="Overview" description={`How the ${year} edition is going.`}>
      {/* The four numbers that matter, in one strip */}
      <div className="ws-card grid grid-cols-2 xl:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.label} className={`px-5 py-4 min-w-0 ${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'border-t xl:border-t-0' : ''} ${i === 2 ? 'xl:border-l' : ''}`} style={{ borderColor: 'var(--line)' }}>
            <p className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{t.label}</p>
            {loading ? (
              <div className="h-7 w-14 rounded-md mt-2 animate-pulse" style={{ background: 'var(--surface-3)' }} />
            ) : (
              <p className="text-[26px] leading-none mt-2 tabular font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>{t.value}</p>
            )}
            {t.hint && <p className="text-[12px] mt-2 truncate" style={{ color: 'var(--fg-4)' }}>{t.hint}</p>}
          </div>
        ))}
      </div>

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
        <div className="ws-card px-5 py-4">
          <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--fg)' }}>By stage</p>
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {kinds.map((k) => <StageRow key={k} kind={k} stats={stats[k].data} loading={stats[k].isLoading} href={sectionHref(k)} />)}
          </div>
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          <AgendaSummary />
          <Recent labels={labels} />
        </div>
      </div>
    </WorkspacePage>
  )
}
