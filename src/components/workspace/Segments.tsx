'use client'

// The directory (lib/segments): every company at the open event, across
// all its editions (Boston shows Boston only, London London only), or just
// the open edition; the Directory button has every event,
// each labelled Solution Provider or End User, with its people inside it and
// what each does at our events (Delegate, Speaker, Sponsor). A person is
// found by searching here, under their company; the search in the top bar
// looks across every event. Also the edition's Hit list. Read from the
// tabs as they are; nothing here changes a record.

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Building2, Check, ChevronDown, ChevronRight, Loader2, Mail, Phone, Plus, Search, Target, Users } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import type { Account, Firmographic, Member, Person, Relationship } from '@/lib/segments'
import { editionLabel, editionYears, eventLook, labelsForEdition } from '@/lib/portals'
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

type Scope = 'series' | 'edition' | 'all'

// Every edition of the open event (World Health AI Boston: its 2026, 2027…),
// and nothing of the series' other events: London's records stay in London.
function useSeriesLabels(): string[] {
  const { category } = useWorkspace()
  return useMemo(() => (category ? Array.from(new Set(editionYears(category).flatMap((y) => labelsForEdition(category, y)))) : []), [category])
}

function useSegments(scope: Scope = 'edition') {
  const edition = useWorkspace().labels
  const series = useSeriesLabels()
  const labels = scope === 'series' ? series : edition
  return useQuery<Segments>({
    queryKey: ['ws-segments', scope === 'all' ? 'all' : labels],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (scope === 'all') p.set('scope', 'all')
      else labels.forEach((l) => p.append('events', l))
      const r = await fetch(`/api/segments?${p}`)
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || 'segments')
      return r.json()
    },
    enabled: scope === 'all' || labels.length > 0,
    staleTime: 60_000,
  })
}

// "World Pharma AI London 2027" → "WPAI London 2027"
const shortEvent = (e: string) => e.replace(/^World Health AI/i, 'WHAI').replace(/^World Pharma AI/i, 'WPAI')

function Events({ events }: { events: string[] }) {
  if (!events.length) return <span style={{ color: 'var(--fg-4)' }}>—</span>
  const sorted = [...events].sort((a, b) => (b.match(/20\d{2}/)?.[0] ?? '').localeCompare(a.match(/20\d{2}/)?.[0] ?? '') || a.localeCompare(b))
  return (
    <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--fg-3)' }} title={sorted.join('\n')}>
      {sorted.slice(0, 2).map(shortEvent).join(', ')}{sorted.length > 2 ? <span style={{ color: 'var(--fg-4)' }}> +{sorted.length - 2}</span> : null}
    </span>
  )
}

// Every edition of the open event, or just the open edition.
function ScopeSwitch({ value, onChange }: { value: Scope; onChange: (v: Scope) => void }) {
  const { year, category } = useWorkspace()
  const look = category ? eventLook(category.name) : null
  return <Segmented size="sm" value={value} onChange={onChange} options={[{ value: 'series', label: look ? `All ${look.short} ${look.city}` : 'All years' }, { value: 'edition', label: `${year} edition` }]} />
}

// Into this year's pipelines, from here: a company into Sales (a sponsor
// lead, Not contacted), a person into Production (a speaker, Not
// contacted). Someone already in the year's pipeline shows its stage.
function usePipelineAdd() {
  const { category, year, labels } = useWorkspace()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const event = category && year ? editionLabel(category.name, year) : null
  const inYear = (r: { event?: string | null }) => !!r.event && labels.some((l) => l.toLowerCase() === r.event!.toLowerCase())
  const post = async (key: string, url: string, body: Record<string, unknown>) => {
    setBusy(key)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok && res.status !== 409) throw new Error((await res.json().catch(() => null))?.error || 'Could not add it.')
      setDone((d) => new Set(d).add(key))
      qc.invalidateQueries({ queryKey: ['ws-segments'] })
      qc.invalidateQueries({ queryKey: ['ws-board'] })
      qc.invalidateQueries({ queryKey: ['ws-stats'] })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not add it.')
    } finally {
      setBusy(null)
    }
  }
  const split = (name: string) => { const [f, ...rest] = name.trim().split(/\s+/); return { firstName: f || name, lastName: rest.join(' ') } }
  return {
    year, event, busy, done, inYear,
    addCompany: (a: Account) => {
      const lead = a.best
      const n = lead ? split(lead.name) : { firstName: '', lastName: '' }
      return post(`company:${a.key}`, '/api/sponsors', {
        companyName: a.name, event, status: 'Not Contacted', website: a.website, country: a.country, tags: 'Added from Companies',
        contactFirstName: n.firstName || null, contactLastName: n.lastName || null, contactEmail: lead?.email ?? null, contactPhone: lead?.phone ?? null, contactJobTitle: lead?.jobTitle ?? null,
      })
    },
    addSpeaker: (m: Member, company: string) => post(`speaker:${m.key}`, '/api/speakers', {
      ...split(m.name || m.email || 'Unnamed'), email: m.email, phone: m.phone, jobTitle: m.jobTitle,
      organization: company, event, year: Number(year) || null, status: 'Not Contacted',
    }),
  }
}
type PipelineAdd = ReturnType<typeof usePipelineAdd>

function AddButton({ label, busy, done, onClick }: { label: string; busy: boolean; done: boolean; onClick: () => void }) {
  if (done) return <span className="inline-flex items-center gap-1 text-[12px] whitespace-nowrap" style={{ color: 'var(--ok)' }}><Check className="w-3.5 h-3.5" /> Added</span>
  return (
    <button type="button" onClick={onClick} disabled={busy} className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-2 whitespace-nowrap" style={{ color: 'var(--accent-ink)' }}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} {label}
    </button>
  )
}

const NO_COMPANY_NAME = 'No company given'
// How a person takes part, in the CRM's terms: speaking, attending, or a
// contact of a sponsoring company.
const DOING: Record<Relationship, string> = { Speaker: 'Speaking', Delegate: 'Attending', Sponsor: 'Company contact' }

const matches = (m: Member, q: string) => m.name.toLowerCase().includes(q) || (m.email || '').includes(q) || (m.jobTitle || '').toLowerCase().includes(q)

// A company's people, under its row.
function Members({ members, query, company, add }: { members: Member[]; query: string; company: string; add?: PipelineAdd }) {
  return (
    <ul className="flex flex-col">
      {members.map((m) => {
        const hit = !!query && matches(m, query)
        return (
          <li key={m.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 pl-[54px] pr-4" style={{ borderTop: '1px solid var(--line)', background: hit ? 'var(--accent-soft)' : undefined }}>
            <Link href={`${PATH[m.records[0].table]}/${m.records[0].id}`} className="min-w-0 flex-1">
              <span className="text-[13px] font-medium" style={{ color: 'var(--fg)' }}>{m.name || m.email}</span>
              <span className="text-[12px]" style={{ color: 'var(--fg-3)' }}>{[m.jobTitle, m.email].filter(Boolean).length ? ` · ${[m.jobTitle, m.email].filter(Boolean).join(' · ')}` : ''}</span>
            </Link>
            <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]">
              {m.records.map((r, i) => (
                <Link key={i} href={`${PATH[r.table]}/${r.id}`} className="hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
                  {DOING[r.relationship]}{r.event ? ` · ${shortEvent(r.event)}` : ''}{r.status ? `: ${r.status}` : ''}
                </Link>
              ))}
            </span>
            {add?.event && !m.records.some((r) => r.relationship === 'Speaker' && add.inYear(r)) && (
              <AddButton label="Speaker pipeline" busy={add.busy === `speaker:${m.key}`} done={add.done.has(`speaker:${m.key}`)} onClick={() => add.addSpeaker(m, company === NO_COMPANY_NAME ? '' : company)} />
            )}
          </li>
        )
      })}
    </ul>
  )
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
    { label: 'To check', value: t?.conflicts, hint: 'Their people disagree on the type' },
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

// Companies (the series, or the edition), or with `everything` the
// Directory: every company in every event.
export function CompaniesView({ everything = false }: { everything?: boolean }) {
  const [picked, setScope] = useState<Scope>('series')
  const scope: Scope = everything ? 'all' : picked
  const { data, isLoading, error } = useSegments(scope)
  const { category } = useWorkspace()
  const event = category ? `${eventLook(category.name).series} ${eventLook(category.name).city}` : ''
  const [type, setType] = useState<'all' | Firmographic>('all')
  const [conflicts, setConflicts] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const q = query.trim().toLowerCase()
  const rows = useMemo(() => {
    return (data?.accounts ?? []).filter((a) =>
      (type === 'all' || a.firmographic === type) && (!conflicts || a.conflict) &&
      (!q || a.name.toLowerCase().includes(q) || (a.members ?? []).some((m) => matches(m, q))))
  }, [data, type, conflicts, q])
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)
  const add = usePipelineAdd()
  const toggle = (k: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <WorkspacePage
      title={everything ? 'Directory' : 'Companies'}
      description={everything ? 'Every company in the CRM, across every event, each once with its people. Search a person to find them under their company.' : scope === 'series'
        ? `Every company at ${event || 'this event'}, once, across all its editions, with its people. Search a person to find them under their company.`
        : 'Every company in this edition, once, with its people.'}
      actions={everything ? undefined : <ScopeSwitch value={picked} onChange={(v) => { setScope(v); setPage(1) }} />}
    >
      <Summary data={data} loading={isLoading} />
      <div className="ws-card overflow-hidden">
        <Toolbar query={query} setQuery={(v) => { setQuery(v); setPage(1) }} placeholder="Search companies or people…" count={rows.length}>
          <Segmented size="sm" value={type} onChange={(v) => { setType(v); setPage(1) }} options={[{ value: 'all', label: 'All' }, { value: 'Solution Provider', label: 'Solution providers' }, { value: 'End User', label: 'End users' }]} />
          <button type="button" className="ws-chip" data-active={conflicts} onClick={() => { setConflicts(!conflicts); setPage(1) }}>
            <AlertTriangle className="w-3.5 h-3.5" /> To check
          </button>
        </Toolbar>
        {error ? <EmptyState icon={AlertTriangle} title="Couldn’t load the companies" body={(error as Error).message} /> :
         isLoading ? <Skeleton /> :
         rows.length === 0 ? <EmptyState icon={Building2} title="No companies match" body="Try another filter, or clear the search." /> : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[minmax(0,2.4fr)_160px_minmax(0,1.4fr)_minmax(0,1.1fr)_70px_90px] gap-3 px-4 py-2.5 text-[12px] font-medium" style={{ color: 'var(--fg-4)', borderBottom: '1px solid var(--line)' }}>
                <span>Company</span><span>Type</span><span>Events</span><span>{add.year} sales</span><span className="text-right">People</span><span className="text-right">Updated</span>
              </div>
              {shown.map((a) => {
                const found = q ? (a.members ?? []).filter((m) => matches(m, q)) : []
                const expanded = open.has(a.key) || found.length > 0
                return (
                  <div key={a.key} style={{ borderBottom: '1px solid var(--line)' }}>
                    <div className="grid grid-cols-[minmax(0,2.4fr)_160px_minmax(0,1.4fr)_minmax(0,1.1fr)_70px_90px] gap-3 items-center px-4 py-2.5 transition-colors hover:bg-[var(--glass-hover)]">
                      <span className="flex items-center gap-2 min-w-0">
                        <button type="button" onClick={() => toggle(a.key)} className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-1 shrink-0" aria-expanded={expanded} aria-label={expanded ? `Hide ${a.name}'s people` : `Show ${a.name}'s people`}>
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <Link href={`${PATH[a.open.table]}/${a.open.id}`} className="flex items-center gap-3 min-w-0">
                          <Initials name={a.name} size={30} />
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{a.name}</span>
                            <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{a.best ? [a.best.name, a.best.jobTitle].filter(Boolean).join(' · ') : 'No contact yet'}</span>
                            {a.conflict && a.disagree?.length ? (
                              <span className="block text-[11.5px] truncate" style={{ color: 'var(--warn)' }} title={a.disagree.join('\n')}>
                                {a.disagree[0]}{a.disagree.length > 1 ? ` +${a.disagree.length - 1} more` : ''}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </span>
                      <span><TypeBadge type={a.firmographic} conflict={a.conflict} /></span>
                      <span className="min-w-0 truncate"><Events events={a.events ?? []} /></span>
                      {(() => {
                        // This year's sponsor record, if the company has one.
                        const rec = (a.members ?? []).flatMap((m) => m.records).find((r) => r.relationship === 'Sponsor' && add.inYear(r))
                        if (rec) return <Link href={`${PATH[rec.table]}/${rec.id}`} className="text-[13px] truncate hover:underline underline-offset-4" style={{ color: 'var(--fg-2)' }}>{rec.status ?? 'In the pipeline'}</Link>
                        if (a.key === '__none' || !add.event) return <span className="text-[13px]" style={{ color: 'var(--fg-4)' }}>—</span>
                        return <span><AddButton label="Sales pipeline" busy={add.busy === `company:${a.key}`} done={add.done.has(`company:${a.key}`)} onClick={() => add.addCompany(a)} /></span>
                      })()}
                      <span className="text-right tabular text-[13.5px]">{a.people}</span>
                      <span className="text-right text-[12.5px]" style={{ color: 'var(--fg-4)' }}>{timeAgo(a.updatedAt)}</span>
                    </div>
                    {expanded && <Members members={found.length && !open.has(a.key) ? found : a.members ?? []} query={q} company={a.name} add={add} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {rows.length > PAGE && <div className="px-4 py-3"><Pagination page={page} totalPages={Math.ceil(rows.length / PAGE)} total={rows.length} pageSize={PAGE} onPage={setPage} onPageSize={() => {}} /></div>}
      </div>
    </WorkspacePage>
  )
}

// ── People ───────────────────────────────────────────────────────────────────

export function PeopleView() {
  const [scope, setScope] = useState<Scope>('series')
  const { data, isLoading, error } = useSegments(scope)
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
    <WorkspacePage
      title="People"
      description={scope === 'series' ? 'Everyone in the series, once, with every role they have had at any of our events.' : 'Everyone in this edition, once, with every role they have at the event.'}
      actions={<ScopeSwitch value={scope} onChange={(v) => { setScope(v); setPage(1) }} />}
    >
      <Summary data={data} loading={isLoading} />
      <div className="ws-card overflow-hidden">
        <Toolbar query={query} setQuery={(v) => { setQuery(v); setPage(1) }} placeholder="Search people, emails or companies…" count={rows.length}>
          <Segmented size="sm" value={type} onChange={(v) => { setType(v); setPage(1) }} options={[{ value: 'all', label: 'All' }, { value: 'Solution Provider', label: 'Solution providers' }, { value: 'End User', label: 'End users' }]} />
          <TagFilter value={tag} onChange={(v) => { setTag(v); setPage(1) }} />
          <button type="button" className="ws-chip" data-active={multi} onClick={() => { setMulti(!multi); setPage(1) }}>In more than one role</button>
        </Toolbar>
        {error ? <EmptyState icon={AlertTriangle} title="Couldn’t load the people" body={(error as Error).message} /> :
         isLoading ? <Skeleton /> :
         rows.length === 0 ? <EmptyState icon={Users} title="No one matches" body="Try another filter, or clear the search." /> : (
          <div className="overflow-x-auto">
            <table className="ws-table w-full min-w-[820px]">
              <thead><tr><th>Person</th><th>Company</th><th>Company type</th><th>Roles</th><th>Where they are</th></tr></thead>
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
                    <td><TypeBadge type={p.firmographic} /></td>
                    <td><Tags tags={p.tags} /></td>
                    <td>
                      <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]">
                        {p.records.map((r, i) => (
                          <Link key={i} href={`${PATH[r.table]}/${r.id}`} className="hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
                            {DOING[r.relationship]}{scope === 'series' && r.event ? ` · ${shortEvent(r.event)}` : ''}{r.status ? `: ${r.status}` : ''}
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
