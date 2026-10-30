'use client'

// Post analytics: how a brand's LinkedIn page and its posts did, read live
// from LinkedIn (api/linkedin/analytics). The page follows the edition's
// brand, and any of the three pages can be looked at.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpRight, BarChart3, RefreshCw } from 'lucide-react'
import { EmptyState, Segmented, Stat } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { useWorkspace } from '@/lib/workspace'
import { BRANDS, brandFor, type BrandKey } from '@/lib/contentBrand'
import type { DayFigures, PageAnalytics, PostFigures } from '@/lib/linkedinAnalytics'
import { Tone, useEdition } from './shared'

const PERIODS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '12 months' },
] as const

const SHORT: Record<BrandKey, string> = { health: 'Health AI', pharma: 'Pharma AI', nexus: 'Nexus' }
const whole = (v: number) => v.toLocaleString('en-GB')
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`)
const short = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

type SortKey = 'publishedAt' | 'impressions' | 'clicks' | 'reactions' | 'comments' | 'reposts' | 'engagementRate'

export function PostAnalytics() {
  const ed = useEdition()
  const { href } = useWorkspace()
  const [brand, setBrand] = useState<BrandKey | null>(null)
  const shown: BrandKey = brand ?? (ed ? brandFor(ed.series) : 'health')
  const [days, setDays] = useState<string>('30')
  const [sort, setSort] = useState<SortKey>('publishedAt')

  const q = useQuery<PageAnalytics, Error & { reconnect?: boolean }>({
    queryKey: ['linkedin-analytics', shown, days],
    queryFn: async () => {
      const r = await fetch(`/api/linkedin/analytics?brand=${shown}&days=${days}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw Object.assign(new Error(j?.error || 'The figures could not be read from LinkedIn.'), { reconnect: Boolean(j?.reconnect) })
      return j as PageAnalytics
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
  const a = q.data
  const loading = q.isLoading
  const posts = [...(a?.posts ?? [])].sort((x, y) =>
    sort === 'publishedAt' ? Date.parse(y.publishedAt ?? '') - Date.parse(x.publishedAt ?? '') : (y[sort] ?? -1) - (x[sort] ?? -1),
  )
  const fromCrm = a?.posts.filter((p) => p.crm).length ?? 0
  const pin = usePinBelowTopbar()

  return (
    <WorkspacePage
      title="Post analytics"
      description="How the LinkedIn page and its posts are doing, read live from LinkedIn. Organic only: sponsored activity is not counted."
      actions={
        <button type="button" onClick={() => q.refetch()} disabled={q.isFetching} className="ws-btn ws-btn-sm" title="Read the figures from LinkedIn again">
          <RefreshCw className={`w-3.5 h-3.5 ${q.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Segmented size="sm" value={shown} onChange={(v) => setBrand(v)} options={(['health', 'pharma', 'nexus'] as BrandKey[]).map((b) => ({ value: b, label: SHORT[b], hint: BRANDS[b].name }))} />
        <Segmented size="sm" value={days} onChange={setDays} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
        {a && <span className="text-[12px] ml-auto" style={{ color: 'var(--fg-4)' }}>{`${a.page.name} · read ${new Date(a.read).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}</span>}
      </div>

      {q.error ? (
        <div className="ws-card">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn’t read the figures"
            body={q.error.message}
            action={q.error.reconnect || /page|connect/i.test(q.error.message) ? <Link href={href('content')} className="ws-btn ws-btn-sm">Go to the Content tab</Link> : undefined}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            <Stat label="Followers" value={a?.followers == null ? '—' : whole(a.followers)} loading={loading} hint={a?.totals.newFollowers == null ? 'New followers not available' : `${a.totals.newFollowers >= 0 ? '+' : ''}${whole(a.totals.newFollowers)} in the period`} />
            <Stat label="Impressions" value={a ? whole(a.totals.impressions) : '—'} loading={loading} hint="Times the page's posts were seen" />
            <Stat label="Engagement rate" value={a ? pct(a.totals.engagementRate) : '—'} loading={loading} hint="Interactions per impression" />
            <Stat label="Clicks" value={a ? whole(a.totals.clicks) : '—'} loading={loading} hint="On posts, links and the page" />
            <div className="col-span-2 lg:col-span-1 grid">
              <Stat label="Reactions · comments · reposts" value={a ? `${whole(a.totals.reactions)} · ${whole(a.totals.comments)} · ${whole(a.totals.reposts)}` : '—'} loading={loading} />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-5">
            <ChartCard title="Impressions" note={Number(days) > 90 ? 'A week a bar' : 'A day a bar'} loading={loading}>
              {a && <Bars data={a.daily} pick={(d) => d.impressions} week={Number(days) > 90} unit="impressions" />}
            </ChartCard>
            <ChartCard title="New followers" note="LinkedIn has these up to two days ago" loading={loading}>
              {a && (a.totals.newFollowers === null ? (
                <p className="text-[13px] py-10 text-center" style={{ color: 'var(--fg-3)' }}>LinkedIn did not give the follower figures for this page.</p>
              ) : (
                <Bars data={a.daily} pick={(d) => d.newFollowers} week={Number(days) > 90} unit="new followers" />
              ))}
            </ChartCard>
          </div>

          {/* Posts: the column headings stay in sight while the list scrolls
              (on wider screens, where the table needs no sideways scroll). */}
          <div className="ws-card overflow-hidden lg:overflow-visible">
            <div className="flex flex-wrap items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
              <p className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>Posts</p>
              {a && <span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{`${a.posts.length} in the period${fromCrm ? `, ${fromCrm} from the Content tab` : ''}. Each post's figures are for its whole life.`}</span>}
            </div>
            {loading ? (
              <div className="p-5 flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-md animate-pulse" style={{ background: 'var(--surface-3)' }} />)}</div>
            ) : !posts.length ? (
              <EmptyState icon={BarChart3} title="No posts in this period" body="Posts the page puts up show here, with their figures." className="py-10" />
            ) : (
              <div className="overflow-x-auto lg:overflow-visible">
                <table className="ws-table w-full min-w-[860px]" style={{ ['--pin' as string]: `${pin}px` }}>
                  <thead>
                    <tr>
                      <Th k="publishedAt" sort={sort} setSort={setSort} left>Post</Th>
                      <Th k="impressions" sort={sort} setSort={setSort}>Impressions</Th>
                      <Th k="clicks" sort={sort} setSort={setSort}>Clicks</Th>
                      <Th k="reactions" sort={sort} setSort={setSort}>Reactions</Th>
                      <Th k="comments" sort={sort} setSort={setSort}>Comments</Th>
                      <Th k="reposts" sort={sort} setSort={setSort}>Reposts</Th>
                      <Th k="engagementRate" sort={sort} setSort={setSort}>Engagement</Th>
                    </tr>
                  </thead>
                  <tbody>{posts.map((p) => <PostRow key={p.urn} p={p} />)}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </WorkspacePage>
  )
}

function Th({ k, sort, setSort, left, children }: { k: SortKey; sort: SortKey; setSort: (k: SortKey) => void; left?: boolean; children: React.ReactNode }) {
  return (
    <th className="lg:sticky lg:top-[var(--pin)] z-[5]" style={{ textAlign: left ? 'left' : 'right', background: 'var(--surface)', boxShadow: 'inset 0 -1px 0 var(--line)' }} aria-sort={sort === k ? 'descending' : undefined}>
      <button type="button" onClick={() => setSort(k)} className="hover:underline underline-offset-4 whitespace-nowrap" style={{ color: sort === k ? 'var(--fg)' : undefined, fontWeight: sort === k ? 600 : undefined }}>
        {children}{sort === k ? ' ↓' : ''}
      </button>
    </th>
  )
}

function PostRow({ p }: { p: PostFigures }) {
  const first = p.text.split('\n').find((l) => l.trim()) ?? '(No text)'
  return (
    <tr>
      <td className="max-w-[380px]">
        <a href={p.url} target="_blank" rel="noreferrer" className="group block min-w-0">
          <span className="flex items-center gap-1 text-[13.5px] font-medium truncate group-hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>
            <span className="truncate">{p.crm?.headline || first}</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--fg-4)' }} />
          </span>
          <span className="flex items-center gap-2 mt-0.5 text-[12px]" style={{ color: 'var(--fg-3)' }}>
            {p.publishedAt && <span className="tabular">{short(p.publishedAt)}</span>}
            {p.crm && <Tone tone="muted">Content tab</Tone>}
          </span>
        </a>
      </td>
      {[p.impressions, p.clicks, p.reactions, p.comments, p.reposts].map((v, i) => (
        <td key={i} className="text-right tabular text-[13px]" style={{ color: 'var(--fg-2)' }}>{whole(v)}</td>
      ))}
      <td className="text-right tabular text-[13px] font-medium" style={{ color: 'var(--fg)' }}>{pct(p.engagementRate)}</td>
    </tr>
  )
}

// How far down the CRM's top bar reaches, so the pinned headings sit
// just under it (it is two rows on wide screens, one on phones).
function usePinBelowTopbar(): number {
  const [h, setH] = useState(0)
  useEffect(() => {
    const bar = document.querySelector('header.crm-top')
    if (!bar) return
    const read = () => setH(Math.round(bar.getBoundingClientRect().height))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])
  return h
}

function ChartCard({ title, note, loading, children }: { title: string; note: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div className="ws-card px-5 py-4 min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <p className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>{title}</p>
        <p className="text-[11.5px]" style={{ color: 'var(--fg-4)' }}>{note}</p>
      </div>
      {loading ? <div className="h-[180px] rounded-md animate-pulse" style={{ background: 'var(--surface-3)' }} /> : children}
    </div>
  )
}

// One measure over the period as columns: a day a column, or a week for
// the twelve months. Hover a column for its figure; a day LinkedIn has no
// figure for yet is left empty.
function Bars({ data, pick, week, unit }: { data: DayFigures[]; pick: (d: DayFigures) => number | null; week: boolean; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const cols: { from: string; to: string; value: number | null }[] = []
  const step = week ? 7 : 1
  for (let i = 0; i < data.length; i += step) {
    const slice = data.slice(i, i + step)
    const known = slice.map(pick).filter((v): v is number => v !== null)
    cols.push({ from: slice[0].day, to: slice[slice.length - 1].day, value: known.length ? known.reduce((x, y) => x + y, 0) : null })
  }
  const max = Math.max(0, ...cols.map((c) => c.value ?? 0))
  const top = niceTop(max)
  const h = cols[hover ?? -1]
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <div className="relative h-[180px] mt-5 ml-10">
        {/* Gridlines: the top and the middle, recessive, labelled in the gutter. */}
        {[1, 0.5].map((f) => (
          <div key={f} className="absolute left-0 right-0" style={{ bottom: `${f * 100}%`, borderTop: '1px dashed var(--line)' }}>
            <span className="absolute right-full mr-2 -translate-y-1/2 text-[10.5px] tabular whitespace-nowrap" style={{ color: 'var(--fg-4)' }}>{whole(Math.round(top * f))}</span>
          </div>
        ))}
        <span className="absolute right-full mr-2 bottom-0 translate-y-1/2 text-[10.5px] tabular" style={{ color: 'var(--fg-4)' }}>0</span>
        <div className="absolute inset-0 flex items-end" style={{ gap: cols.length > 60 ? 1 : 2, borderBottom: '1px solid var(--line)' }}>
          {cols.map((c, i) => (
            <div key={c.from} className="relative flex-1 h-full flex items-end cursor-default" onMouseEnter={() => setHover(i)}>
              <div
                className="w-full"
                style={{
                  height: c.value && top ? `${Math.max(1.5, (c.value / top) * 100)}%` : 0,
                  background: 'var(--accent)',
                  opacity: hover === null || hover === i ? 1 : 0.45,
                  borderRadius: cols.length > 60 ? '2px 2px 0 0' : '4px 4px 0 0',
                  transition: 'opacity 120ms',
                }}
              />
            </div>
          ))}
        </div>
        {h && (
          <div
            className="absolute z-10 pointer-events-none rounded-md px-2.5 py-1.5 text-[12px] whitespace-nowrap"
            style={{ left: `${((hover! + 0.5) / cols.length) * 100}%`, top: -8, transform: `translateX(${hover! / cols.length > 0.7 ? '-100%' : hover! / cols.length < 0.3 ? '0' : '-50%'})`, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--glass-shadow)', color: 'var(--fg-2)' }}
          >
            <span className="block" style={{ color: 'var(--fg-3)' }}>{h.from === h.to ? short(h.from) : `${short(h.from)} – ${short(h.to)}`}</span>
            <span className="tabular font-semibold" style={{ color: 'var(--fg)' }}>{h.value === null ? 'Not yet known' : `${whole(h.value)} ${unit}`}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between mt-1.5 ml-10 text-[11px] tabular" style={{ color: 'var(--fg-4)' }}>
        <span>{short(cols[0].from)}</span>
        <span>{short(cols[cols.length - 1].to)}</span>
      </div>
    </div>
  )
}

function niceTop(max: number): number {
  if (max <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p
  return 10 * p
}
