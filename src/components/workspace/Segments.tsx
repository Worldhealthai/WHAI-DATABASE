'use client'

// The edition in two layers (lib/segments): Companies (who the company is:
// Solution Provider or End User), People (what each person does at the
// event: Delegate, Speaker, Sponsor, several at once) and the Hit list (the
// Solution Providers most worth a call today). Read from the three tabs as
// they are; nothing here changes a record.

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, Mail, Phone, Search, Target, Users } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import type { Account, Firmographic, Person, Relationship } from '@/lib/segments'
import { CopyPopover } from '@/components/crm/CopyPopover'
import { Pagination } from '@/components/search/Pagination'
import { EmptyState, Initials, Segmented, formatMoney, timeAgo } from './ui'
import { WorkspacePage } from './WorkspacePage'

interface Segments {
  accounts: Account[]
  people: Person[]
  hitList: Account[]
  totals: { rows: number; accounts: number; people: number; solutionProviders: number; endUsers: number; conflicts: number; multiTag: number }
}

const PATH: Record<string, string> = { sponsors: '/sponsors', speakers: '/speakers', delegates: '/delegates', partners: '/partners' }
const TAG_ORDER: Relationship[] = ['Sponsor', 'Speaker', 'Delegate']

function useSegments() {
  const { labels } = useWorkspace()
  return useQuery<Segments>({
    queryKey: ['ws-segments', labels],
    queryFn: async () => {
      const p = new URLSearchParams()
      labels.forEach((l) => p.append('events', l))
      const r = await fetch(`/api/segments?${p}`)
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || 'segments')
      return r.json()
    },
    enabled: labels.length > 0,
    staleTime: 60_000,
  })
}

// ── Small marks ──────────────────────────────────────────────────────────────

export function TypeBadge({ type, conflict }: { type: Firmographic | null; conflict?: boolean }) {
  if (!type) return <span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>—</span>
  const seller = type === 'Solution Provider'
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap" style={{ color: 'var(--fg-2)' }} title={conflict ? 'Labelled both ways by the rules: check it' : undefined}>
      <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: seller ? 'var(--accent)' : 'var(--line-3)' }} />
      {type}
      {conflict && <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--warn)' }} aria-label="Conflict" />}
    </span>
  )
}

export function Tags({ tags }: { tags: Relationship[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {TAG_ORDER.filter((t) => tags.includes(t)).map((t) => (
        <span key={t} className="inline-flex items-center h-[22px] px-2 rounded-md text-[11.5px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)' }}>{t}</span>
      ))}
    </span>
  )
}

function Completeness({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2" title={`${value} of 100: how much there is to work with`}>
      <span className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
        <span className="block h-full rounded-full" style={{ width: `${value}%`, background: value >= 70 ? 'var(--ok)' : value >= 40 ? 'var(--accent)' : 'var(--line-3)' }} />
      </span>
      <span className="text-[12px] tabular" style={{ color: 'var(--fg-3)' }}>{value}</span>
    </span>
  )
}

function Summary({ data, loading }: { data?: Segments; loading: boolean }) {
  const t = data?.totals
  const cells = [
    { label: 'Companies', value: t?.accounts, hint: `${t?.people ?? 0} people` },
    { label: 'Solution providers', value: t?.solutionProviders, hint: 'Sell to our audience' },
    { label: 'End users', value: t?.endUsers, hint: 'Buy from them' },
    { label: 'In more than one role', value: t?.multiTag, hint: `${t?.conflicts ?? 0} companies to check` },
  ]
  return (
    <div className="ws-card grid grid-cols-2 xl:grid-cols-4 mb-4">
      {cells.map((c, i) => (
        <div key={c.label} className={`px-5 py-3.5 min-w-0 ${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'border-t xl:border-t-0' : ''} ${i === 2 ? 'xl:border-l' : ''}`} style={{ borderColor: 'var(--line)' }}>
          <p className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{c.label}</p>
          {loading ? <div className="h-6 w-12 mt-1.5 rounded animate-pulse" style={{ background: 'var(--surface-3)' }} /> : (
            <p className="text-[22px] leading-none mt-1.5 tabular font-semibold" style={{ color: 'var(--fg)' }}>{c.value ?? 0}</p>
          )}
          <p className="text-[12px] mt-1.5 truncate" style={{ color: 'var(--fg-4)' }}>{c.hint}</p>
        </div>
      ))}
    </div>
  )
}

function Toolbar({ children, query, setQuery, placeholder, count }: { children?: React.ReactNode; query: string; setQuery: (v: string) => void; placeholder: string; count: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
      <label className="relative flex-1 min-w-[200px] max-w-[360px]">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-4)' }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="ws-input" style={{ paddingLeft: 34 }} />
      </label>
      {children}
      <span className="ml-auto text-[12.5px] tabular" style={{ color: 'var(--fg-4)' }}>{count.toLocaleString()} shown</span>
    </div>
  )
}

function TagFilter({ value, onChange }: { value: Relationship | ''; onChange: (v: Relationship | '') => void }) {
  return (
    <span className="inline-flex gap-1">
      {(['', ...TAG_ORDER] as (Relationship | '')[]).map((t) => (
        <button key={t || 'all'} type="button" className="ws-chip" data-active={value === t} onClick={() => onChange(t)}>{t ? `${t}s` : 'All roles'}</button>
      ))}
    </span>
  )
}

const PAGE = 50

// ── Companies ────────────────────────────────────────────────────────────────

export function CompaniesView() {
  const { data, isLoading, error } = useSegments()
  const [type, setType] = useState<'all' | Firmographic>('all')
  const [tag, setTag] = useState<Relationship | ''>('')
  const [conflicts, setConflicts] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.accounts ?? []).filter((a) =>
      (type === 'all' || a.firmographic === type) && (!tag || a.tags.includes(tag)) && (!conflicts || a.conflict) &&
      (!q || a.name.toLowerCase().includes(q) || (a.best?.name || '').toLowerCase().includes(q) || (a.best?.email || '').includes(q)))
  }, [data, type, tag, conflicts, query])
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)

  return (
    <WorkspacePage title="Companies" description="Every company in this edition, once, across sponsors, speakers and delegates.">
      <Summary data={data} loading={isLoading} />
      <div className="ws-card overflow-hidden">
        <Toolbar query={query} setQuery={(v) => { setQuery(v); setPage(1) }} placeholder="Search companies or contacts…" count={rows.length}>
          <Segmented size="sm" value={type} onChange={(v) => { setType(v); setPage(1) }} options={[{ value: 'all', label: 'All' }, { value: 'Solution Provider', label: 'Solution providers' }, { value: 'End User', label: 'End users' }]} />
          <TagFilter value={tag} onChange={(v) => { setTag(v); setPage(1) }} />
          <button type="button" className="ws-chip" data-active={conflicts} onClick={() => { setConflicts(!conflicts); setPage(1) }}>
            <AlertTriangle className="w-3.5 h-3.5" /> To check
          </button>
        </Toolbar>
        {error ? <EmptyState icon={AlertTriangle} title="Couldn’t load the companies" body={(error as Error).message} /> :
         isLoading ? <Skeleton /> :
         rows.length === 0 ? <EmptyState icon={Building2} title="No companies match" body="Try another filter, or clear the search." /> : (
          <div className="overflow-x-auto">
            <table className="ws-table w-full min-w-[860px]">
              <thead><tr><th>Company</th><th>Type</th><th>Roles at the event</th><th>Sponsor stage</th><th className="text-right">People</th><th>Data</th><th className="text-right">Updated</th></tr></thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.key} className="cursor-pointer">
                    <td>
                      <Link href={`${PATH[a.open.table]}/${a.open.id}`} className="flex items-center gap-3 min-w-0">
                        <Initials name={a.name} size={30} />
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{a.name}</span>
                          <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{a.best ? [a.best.name, a.best.jobTitle].filter(Boolean).join(' · ') : 'No contact yet'}</span>
                        </span>
                      </Link>
                    </td>
                    <td><TypeBadge type={a.firmographic} conflict={a.conflict} /></td>
                    <td><Tags tags={a.tags} /></td>
                    <td className="text-[13px]" style={{ color: a.sponsorStage ? 'var(--fg-2)' : 'var(--fg-4)' }}>{a.sponsorStage ?? '—'}{a.valueAmount ? <span style={{ color: 'var(--fg-4)' }}> · {formatMoney(a.valueAmount)}</span> : null}</td>
                    <td className="text-right tabular">{a.people}</td>
                    <td><Completeness value={a.completeness} /></td>
                    <td className="text-right text-[12.5px]" style={{ color: 'var(--fg-4)' }}>{timeAgo(a.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > PAGE && <div className="px-4 py-3"><Pagination page={page} totalPages={Math.ceil(rows.length / PAGE)} total={rows.length} pageSize={PAGE} onPage={setPage} onPageSize={() => {}} /></div>}
      </div>
    </WorkspacePage>
  )
}

// ── People ───────────────────────────────────────────────────────────────────

export function PeopleView() {
  const { data, isLoading, error } = useSegments()
  const [tag, setTag] = useState<Relationship | ''>('')
  const [multi, setMulti] = useState(false)
  const [type, setType] = useState<'all' | Firmographic>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.people ?? []).filter((p) =>
      (!tag || p.tags.includes(tag)) && (!multi || p.tags.length > 1) && (type === 'all' || p.firmographic === type) &&
      (!q || p.name.toLowerCase().includes(q) || (p.email || '').includes(q) || (p.company || '').toLowerCase().includes(q)))
  }, [data, tag, multi, type, query])
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)

  return (
    <WorkspacePage title="People" description="Everyone in this edition, once, with every role they have at the event.">
      <Summary data={data} loading={isLoading} />
      <div className="ws-card overflow-hidden">
        <Toolbar query={query} setQuery={(v) => { setQuery(v); setPage(1) }} placeholder="Search people, emails or companies…" count={rows.length}>
          <TagFilter value={tag} onChange={(v) => { setTag(v); setPage(1) }} />
          <button type="button" className="ws-chip" data-active={multi} onClick={() => { setMulti(!multi); setPage(1) }}>In more than one role</button>
          <Segmented size="sm" value={type} onChange={(v) => { setType(v); setPage(1) }} options={[{ value: 'all', label: 'Any company' }, { value: 'Solution Provider', label: 'Solution providers' }, { value: 'End User', label: 'End users' }]} />
        </Toolbar>
        {error ? <EmptyState icon={AlertTriangle} title="Couldn’t load the people" body={(error as Error).message} /> :
         isLoading ? <Skeleton /> :
         rows.length === 0 ? <EmptyState icon={Users} title="No one matches" body="Try another filter, or clear the search." /> : (
          <div className="overflow-x-auto">
            <table className="ws-table w-full min-w-[820px]">
              <thead><tr><th>Person</th><th>Company</th><th>Roles at the event</th><th>Company type</th><th>Where they are</th></tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <Link href={`${PATH[p.records[0].table]}/${p.records[0].id}`} className="flex items-center gap-3 min-w-0">
                        <Initials name={p.name || p.email || '?'} size={30} />
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{p.name || p.email}</span>
                          <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[p.jobTitle, p.email].filter(Boolean).join(' · ') || '—'}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-[13px] truncate max-w-[220px]" style={{ color: 'var(--fg-2)' }}>{p.company || '—'}</td>
                    <td><Tags tags={p.tags} /></td>
                    <td><TypeBadge type={p.firmographic} /></td>
                    <td>
                      <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]">
                        {p.records.map((r, i) => (
                          <Link key={i} href={`${PATH[r.table]}/${r.id}`} className="hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
                            {r.relationship}{r.status ? `: ${r.status}` : ''}
                          </Link>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > PAGE && <div className="px-4 py-3"><Pagination page={page} totalPages={Math.ceil(rows.length / PAGE)} total={rows.length} pageSize={PAGE} onPage={setPage} onPageSize={() => {}} /></div>}
      </div>
    </WorkspacePage>
  )
}

// ── Hit list ─────────────────────────────────────────────────────────────────

export function HitListView() {
  const { data, isLoading, error } = useSegments()
  const { year } = useWorkspace()
  const list = data?.hitList ?? []
  return (
    <WorkspacePage
      title="Hit list"
      description={`The ${list.length || 50} solution providers in the ${year} edition with the most to work with: complete details first, then the warmest.`}
    >
      {error ? <div className="ws-card"><EmptyState icon={AlertTriangle} title="Couldn’t load the list" body={(error as Error).message} /></div> :
       isLoading ? <div className="ws-card"><Skeleton /></div> :
       list.length === 0 ? <div className="ws-card"><EmptyState icon={Target} title="No open solution providers" body="Sponsors and paid delegates who are not confirmed or rejected appear here." /></div> : (
        <ol className="ws-card divide-y" style={{ borderColor: 'var(--line)' }}>
          {list.map((a, i) => (
            <li key={a.key} className="grid grid-cols-[28px_minmax(0,1fr)] md:grid-cols-[28px_minmax(0,1.3fr)_minmax(0,1.4fr)_auto] gap-x-4 gap-y-2 items-center px-5 py-3.5">
              <span className="text-[13px] tabular font-semibold" style={{ color: 'var(--fg-4)' }}>{i + 1}</span>
              <Link href={`${PATH[a.open.table]}/${a.open.id}`} className="min-w-0">
                <span className="block text-[14px] font-semibold truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{a.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-[12px]" style={{ color: 'var(--fg-3)' }}>
                  {a.sponsorStage ?? a.decidedBy.join(', ')}
                  {a.tier ? <span>· {a.tier}</span> : null}
                  {a.valueAmount ? <span>· {formatMoney(a.valueAmount)}</span> : null}
                  {a.tags.length > 1 ? <span>· also {a.tags.filter((t) => t !== 'Sponsor').join(', ').toLowerCase()}</span> : null}
                </span>
              </Link>
              <span className="min-w-0 col-start-2 md:col-start-auto">
                <span className="block text-[13px] truncate" style={{ color: 'var(--fg)' }}>{a.best ? a.best.name : 'No contact yet'}</span>
                <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{a.best?.jobTitle || '—'}</span>
              </span>
              <span className="flex items-center gap-1 col-start-2 md:col-start-auto">
                {a.best?.email && <CopyPopover label={`${a.best.name || a.name}'s email`} value={a.best.email} title={a.best.email}><Mail className="w-3.5 h-3.5" /></CopyPopover>}
                {a.best?.phone && <CopyPopover label={`${a.best.name || a.name}'s phone`} value={a.best.phone} title={a.best.phone}><Phone className="w-3.5 h-3.5" /></CopyPopover>}
                <span className="ml-2"><Completeness value={a.completeness} /></span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </WorkspacePage>
  )
}

function Skeleton() {
  return <div className="flex flex-col gap-2 p-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-11 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div>
}
