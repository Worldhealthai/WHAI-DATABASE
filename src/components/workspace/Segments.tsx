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
import { AlertTriangle, Building2, Download, Check, ChevronDown, ChevronRight, Loader2, Mail, Phone, Plus, Search, Target, Users } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { useSticky } from '@/lib/useSticky'
import { downloadCsv } from '@/lib/csv'
import type { Account, Firmographic, Member, Person, Relationship } from '@/lib/segments'
import { editionLabel, editionYears, eventLook, labelsForEdition } from '@/lib/portals'
import { CopyPopover } from '@/components/crm/CopyPopover'
import { Pagination } from '@/components/search/Pagination'
import { EmptyState, Initials, Segmented, formatMoney, timeAgo } from './ui'
import { WorkspacePage } from './WorkspacePage'
import { TitleFilter, tokenMatches, type TitleToken } from './TitleFilter'
import { FocusToggle } from '@/components/crm/FocusToggle'
import { effectiveFocus, type Focus } from '@/lib/contactFocus'
import { useIntelCards, useIntelCardsFor } from './IntelPanel'

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

// What a view reads: Companies the companies (with their people inside),
// Contacts the people, the Hit list its list. Each gets only that, since
// with the leads lists the whole is too big to send at once.
type View = 'accounts' | 'people' | 'hit'
function useSegments(scope: Scope = 'edition', view: View = 'accounts') {
  const edition = useWorkspace().labels
  const series = useSeriesLabels()
  const labels = scope === 'series' ? series : edition
  return useQuery<Segments>({
    queryKey: ['ws-segments', scope === 'all' ? 'all' : labels, view],
    queryFn: async () => {
      const p = new URLSearchParams({ view })
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
export function usePipelineAdd() {
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
    // A lead goes on as themselves (/api/leads/:id/promote): the new record
    // takes their details and note, and they leave the leads list.
    promote: (key: string, leadId: string, to: 'speaker' | 'sponsor') => post(`${to}:${key}`, `/api/leads/${leadId}/promote`, { to, event, year: Number(year) || null }),
    // A person (not a lead) into Sales: their company for the edition, with
    // them as its contact; joining its record when it already has one.
    addContactToSales: (m: Member, company: string) => {
      const n = split(m.name || m.email || '')
      return post(`sponsor:${m.key}`, '/api/sales-contact', { company, event, firstName: n.firstName || null, lastName: n.lastName || null, jobTitle: m.jobTitle, email: m.email, phone: m.phone })
    },
    addSpeaker: (m: Member, company: string) => post(`speaker:${m.key}`, '/api/speakers', {
      ...split(m.name || m.email || 'Unnamed'), email: m.email, phone: m.phone, jobTitle: m.jobTitle,
      organization: company, event, year: Number(year) || null, status: 'Not Contacted',
    }),
  }
}
export type PipelineAdd = ReturnType<typeof usePipelineAdd>

// The way on for a person in Companies or Contacts, by their company's type
// (November 2026): an End User into Production (the speaker pipeline), a
// Solution Provider into Sales (as their company's contact). Not shown once
// they are already in that pipeline this year. A lead goes on as themselves
// (promote), leaving the leads list.
export function PersonAdds({ add, who, company, type }: { add: PipelineAdd; who: Pick<Member, 'key' | 'name' | 'email' | 'phone' | 'jobTitle' | 'records'>; company: string | null; type: Firmographic | null }) {
  if (!add.event || !type) return null
  const lead = who.records.find((r) => r.table === 'leads')
  const firm = company && company !== NO_COMPANY_NAME ? company : ''
  if (type === 'End User') {
    if (who.records.some((r) => r.relationship === 'Speaker' && add.inYear(r))) return null
    return <AddButton label="Production pipeline" busy={add.busy === `speaker:${who.key}`} done={add.done.has(`speaker:${who.key}`)}
      onClick={() => (lead ? add.promote(who.key, lead.id, 'speaker') : add.addSpeaker(who as Member, firm))} />
  }
  if (who.records.some((r) => r.relationship === 'Sponsor' && add.inYear(r)) || !firm) return null
  return <AddButton label="Sales pipeline" busy={add.busy === `sponsor:${who.key}`} done={add.done.has(`sponsor:${who.key}`)}
    onClick={() => (lead ? add.promote(who.key, lead.id, 'sponsor') : add.addContactToSales(who as Member, firm))} />
}

export function AddButton({ label, busy, done, onClick }: { label: string; busy: boolean; done: boolean; onClick: () => void }) {
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
const DOING: Record<Relationship, string> = { Speaker: 'Speaking', Delegate: 'Attending', Sponsor: 'Company contact', Lead: 'Lead' }

// A record's page, as a link. A person opens on their first record in a
// pipeline; someone known only from a leads list opens on their contact
// page in the event (ContactProfile). A company with a sponsor record opens
// on it; any other on its own page with its team (CompanyProfile).
const pageOf = (records: { table: string; id: string }[]) => records.find((r) => PATH[r.table]) ?? records[0]
export function recHref(slug: string | null, rec: { table: string; id: string }): string | null {
  if (PATH[rec.table]) return `${PATH[rec.table]}/${rec.id}`
  if (rec.table === 'leads' && slug) return `/event/${slug}/contacts/${rec.id}`
  return null
}
export function companyHref(slug: string | null, a: { key: string; name: string; open?: { table: string; id: string } }): string | null {
  if (a.open?.table === 'sponsors') return `/sponsors/${a.open.id}`
  if (!slug || a.key === '__none') return null
  return `/event/${slug}/companies/${encodeURIComponent(a.key)}?name=${encodeURIComponent(a.name)}`
}
function RecLink({ rec, className, style, children }: { rec: { table: string; id: string }; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const { slug } = useWorkspace()
  const href = recHref(slug, rec)
  return href ? <Link href={href} className={className} style={style}>{children}</Link> : <span className={className} style={style}>{children}</span>
}
function CompanyLink({ a, className, style, children }: { a: Account; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const { slug } = useWorkspace()
  const href = companyHref(slug, a)
  return href ? <Link href={href} className={className} style={style}>{children}</Link> : <span className={className} style={style}>{children}</span>
}

// Filters on the people inside companies: job titles (TitleFilter: words
// or exact titles, any of them) and how they take part.
type Doing = '' | 'Attending' | 'Speaking' | 'Company contact'
interface PersonFilter { titles: TitleToken[]; doing: Doing; focus: '' | Focus }
const personFilterOn = (f: PersonFilter) => !!(f.titles.length || f.doing || f.focus)
const doingPasses = (m: Member, f: PersonFilter) => !f.doing || m.records.some((r) => DOING[r.relationship] === f.doing)
function personPasses(m: Member, f: PersonFilter): boolean {
  if (f.titles.length && !f.titles.some((t) => tokenMatches(m.jobTitle, t))) return false
  if (f.focus && !effectiveFocus(m).includes(f.focus)) return false
  return doingPasses(m, f)
}

const matches = (m: Member, q: string) => m.name.toLowerCase().includes(q) || (m.email || '').includes(q) || (m.jobTitle || '').toLowerCase().includes(q) || (m.note || '').toLowerCase().includes(q)

// A company's people, under its row.
// Where a record is, as much as the view needs: nothing inside one edition,
// the year across an event's editions, the whole event in the Directory.
type Where = 'none' | 'year' | 'event'
const whereOf = (event: string | null | undefined, where: Where) =>
  !event || where === 'none' ? '' : where === 'year' ? ` ${event.match(/20\d{2}/)?.[0] ?? shortEvent(event)}` : ` · ${shortEvent(event)}`

export function Members({ members, query, company, add, where, account }: { members: Member[]; query: string; company: string; add?: PipelineAdd; where: Where; account?: Account }) {
  return (
    <ul className="flex flex-col">
      {members.map((m) => {
        const hit = !!query && matches(m, query)
        return (
          <li key={m.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 pl-[54px] pr-4" style={{ borderTop: '1px solid var(--line)', background: hit ? 'var(--accent-soft)' : undefined }}>
            <RecLink rec={pageOf(m.records)} className="min-w-0 flex-1 basis-[320px]">
              <span className="text-[13px] font-medium" style={{ color: 'var(--fg)' }}>{m.name || m.email}</span>
              <span className="text-[12px]" style={{ color: 'var(--fg-3)' }}>{[m.jobTitle, m.email].filter(Boolean).length ? ` · ${[m.jobTitle, m.email].filter(Boolean).join(' · ')}` : ''}</span>
              {m.note && <span className="block text-[11.5px] sm:truncate mt-0.5" style={{ color: 'var(--fg-4)' }} title={m.note}>{m.note}</span>}
            </RecLink>
            <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]">
              {m.records.map((r, i) => (
                <RecLink key={i} rec={r} className="hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
                  {DOING[r.relationship]}{whereOf(r.event, where)}{r.status ? `: ${r.status}` : ''}
                </RecLink>
              ))}
            </span>
            {where === 'event' && <FocusToggle key={(m.focus ?? []).join()} rows={m.focusRows ?? []} email={m.email} initial={m.focus ?? []} auto={m.focusAuto ?? []} size="xs" />}
            {add && <PersonAdds add={add} who={m} company={company} type={account?.firmographic ?? null} />}
          </li>
        )
      })}
      {account && account.key !== '__none' && <AddContact account={account} />}
    </ul>
  )
}

// A new person at the company, for Health or Pharma (/api/directory-contact):
// for a company in the Health directory, its Pharma contact, and back.
function AddContact({ account }: { account: Account }) {
  const qc = useQueryClient()
  const sides = account.sides ?? []
  // The side it is missing, else Pharma.
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<Focus>(sides.length === 1 && sides[0] === 'Pharma' ? 'Health' : 'Pharma')
  const [f, setF] = useState({ firstName: '', lastName: '', jobTitle: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const sponsorIds = Array.from(new Set((account.members ?? []).flatMap((m) => m.records).filter((r) => r.relationship === 'Sponsor' && r.table === 'sponsors').map((r) => r.id)))
  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/directory-contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company: account.name, sponsorIds, focus: side, ...f }) })
      const j = await res.json().catch(() => null)
      if (!res.ok) throw new Error(j?.error || 'Could not add them')
      setMsg({ ok: true, text: `Added as a ${side} contact${j?.event ? ` (${shortEvent(j.event)})` : ''}` })
      setF({ firstName: '', lastName: '', jobTitle: '', email: '' })
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['ws-segments'] })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not add them' })
    } finally {
      setBusy(false)
    }
  }
  const input = (k: keyof typeof f, ph: string, type = 'text') => (
    <input className="ws-input h-8 text-[13px] min-w-0 flex-1 basis-[140px]" type={type} placeholder={ph} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} />
  )
  return (
    <li className="py-2 pl-[54px] pr-4" style={{ borderTop: '1px solid var(--line)' }}>
      {!open ? (
        <span className="flex flex-wrap items-center gap-3">
          <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-2" style={{ color: 'var(--accent-ink)' }} onClick={() => { setOpen(true); setMsg(null) }}>
            <Plus className="w-3.5 h-3.5" /> Add contact
          </button>
          {msg && <span className="text-[12px]" style={{ color: msg.ok ? 'var(--ok)' : 'var(--bad)' }}>{msg.text}</span>}
        </span>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium" style={{ color: 'var(--fg-3)' }}>New contact for</span>
            <Segmented size="sm" value={side} onChange={(v) => setSide(v as Focus)} options={[{ value: 'Health', label: 'Health' }, { value: 'Pharma', label: 'Pharma' }]} />
          </div>
          <div className="flex flex-wrap gap-2">
            {input('firstName', 'First name')}{input('lastName', 'Last name')}{input('jobTitle', 'Job title')}{input('email', 'Email', 'email')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="ws-btn ws-btn-primary ws-btn-sm" disabled={busy || !(f.firstName || f.lastName || f.email)} onClick={save}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Add
            </button>
            <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => setOpen(false)}>Cancel</button>
            {msg && !msg.ok && <span className="text-[12px]" style={{ color: 'var(--bad)' }}>{msg.text}</span>}
          </div>
        </div>
      )}
    </li>
  )
}

// The sides a company is on, as small words in the brands' colours.
export function Sides({ sides }: { sides: Focus[] }) {
  if (!sides?.length) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
      {sides.map((f) => <span key={f} style={{ color: `var(--ev-${f === 'Health' ? 'london' : 'pharma'}-ink)` }}>{f}</span>)}
    </span>
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

function Toolbar({ children, query, setQuery, placeholder, count, people }: { children?: React.ReactNode; query: string; setQuery: (v: string) => void; placeholder: string; count: number; people?: number | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
      <label className="relative flex-1 min-w-[200px] max-w-[360px]">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-4)' }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="ws-input" style={{ paddingLeft: 34 }} />
      </label>
      {children}
      <span className="ml-auto text-[12.5px] tabular" style={{ color: 'var(--fg-4)' }}>{count.toLocaleString()} shown{people != null ? ` · ${people.toLocaleString()} ${people === 1 ? 'person' : 'people'}` : ''}</span>
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

const rolesOf = (records: { relationship: Relationship; event?: string | null; status: string | null }[]) =>
  records.map((r) => `${DOING[r.relationship]}${r.event ? ` (${shortEvent(r.event)})` : ''}${r.status ? `: ${r.status}` : ''}`).join('; ')

// The company table's columns: Type only while both types are shown, Events
// only in the Directory (inside an event every company is in it).
// On desktop, four columns from the intelligence layer follow the sales
// column: Team (size), HQ, Hospitals (sourced), Similar.
// (Written out in full: Tailwind reads whole class names from the source.)
const COMPANY_GRID: Record<string, string> = {
  te: 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_150px_minmax(0,1.3fr)_minmax(0,1fr)_64px_minmax(0,1.1fr)_76px_64px_64px_80px]',
  t: 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_150px_minmax(0,1fr)_64px_minmax(0,1.1fr)_76px_64px_64px_80px]',
  e: 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_64px_minmax(0,1.1fr)_76px_64px_64px_80px]',
  '': 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_64px_minmax(0,1.1fr)_76px_64px_64px_80px]',
}

// ── Companies ────────────────────────────────────────────────────────────────

// Companies (the series, or the edition), or with `everything` the
// Directory: every company in every event.
export function CompaniesView({ everything = false }: { everything?: boolean }) {
  const { category, slug, year } = useWorkspace()
  // Kept for the tab's session, so Back from a profile finds it as it was.
  const sk = `${everything ? 'directory' : 'companies'}.${everything ? '' : slug}`
  const [picked, setScope] = useSticky<Scope>(`${sk}.scope`, 'series')
  const scope: Scope = everything ? 'all' : picked
  const { data, isLoading, error } = useSegments(scope)
  const event = category ? `${eventLook(category.name).series} ${eventLook(category.name).city}` : ''
  const [type, setType] = useSticky<'all' | Firmographic>(`${sk}.type`, 'all')
  const [conflicts, setConflicts] = useSticky(`${sk}.conflicts`, false)
  const [both, setBoth] = useSticky(`${sk}.both`, false)
  const [query, setQuery] = useSticky(`${sk}.query`, '')
  const [page, setPage] = useSticky(`${sk}.page`, 1)
  const [openList, setOpenList] = useSticky<string[]>(`${sk}.open`, [])
  const open = useMemo(() => new Set(openList), [openList])
  const [pf, setPf] = useSticky<PersonFilter>(`${sk}.people`, { titles: [], doing: '', focus: '' })
  const setP = (patch: Partial<PersonFilter>) => { setPf((x) => ({ ...x, ...patch })); setPage(1) }
  // The intelligence layer's light rows (crm.v_intel_cards), for the
  // columns and two filters: companies with hospitals named in sourced
  // announcements, and a category. The rows are asked for by CRM key: the
  // page in view, or every company once one of the two filters is on.
  const [sourced, setSourced] = useSticky(`${sk}.sourced`, false)
  const [intelCat, setIntelCat] = useSticky(`${sk}.category`, '')
  const intelFiltering = sourced || !!intelCat
  const intel = useIntelCards()
  const q = query.trim().toLowerCase()
  const filtering = personFilterOn(pf)
  // The people a company shows for the search and the people filters: all
  // of them when neither is set.
  const peopleOf = useMemo(() => (a: Account) => {
    const nameHit = !!q && a.name.toLowerCase().includes(q)
    return (a.members ?? []).filter((m) => personPasses(m, pf) && (!q || nameHit || matches(m, q)))
  }, [q, pf])
  const cardFor = intel.cardFor
  const rows = useMemo(() => {
    return (data?.accounts ?? []).filter((a) => {
      const card = sourced || intelCat ? cardFor(a.key, a.name) : null
      return (type === 'all' || a.firmographic === type) && (!conflicts || a.conflict) && (!both || (a.sides ?? []).length > 1) &&
        (!sourced || (card?.hospitals ?? 0) > 0) && (!intelCat || card?.categories.includes(intelCat)) &&
        (filtering ? peopleOf(a).length > 0 : !q || a.name.toLowerCase().includes(q) || (a.members ?? []).some((m) => matches(m, q)))
    })
  }, [data, type, conflicts, both, sourced, intelCat, cardFor, q, filtering, peopleOf])
  // Every job title among the companies in view (by type and the other
  // people filter), with how many people hold it: what the title filter
  // offers.
  const titleCounts = useMemo(() => {
    const m = new Map<string, { title: string; count: number }>()
    for (const a of data?.accounts ?? []) {
      if ((type !== 'all' && a.firmographic !== type) || (conflicts && !a.conflict)) continue
      for (const p of a.members ?? []) {
        const t = (p.jobTitle || '').replace(/\s+/g, ' ').trim()
        if (!t || !doingPasses(p, pf)) continue
        const k = t.toLowerCase()
        const e = m.get(k) ?? { title: t, count: 0 }
        e.count++
        m.set(k, e)
      }
    }
    return Array.from(m.values()).sort((x, y) => y.count - x.count || x.title.localeCompare(y.title))
  }, [data, type, conflicts, pf])
  const peopleCount = useMemo(() => (filtering || q ? rows.reduce((n, a) => n + peopleOf(a).length, 0) : null), [rows, filtering, q, peopleOf])
  const shown = useMemo(() => rows.slice((page - 1) * PAGE, page * PAGE), [rows, page])
  // The cards the tab asks for: the page's keys, or every company's once
  // one of the two intelligence filters is on.
  const intelKeys = useMemo(() => (intelFiltering ? (data?.accounts ?? []) : shown).map((a) => a.key), [intelFiltering, data, shown])
  const intelLoaded = useIntelCardsFor(intel, intelKeys)
  const add = usePipelineAdd()
  const exportCompanies = () => {
    const out: (string | number | null)[][] = []
    for (const a of rows) {
      const people = q || filtering ? peopleOf(a) : a.members ?? []
      const rec = (a.members ?? []).flatMap((m) => m.records).find((r) => r.relationship === 'Sponsor' && add.inYear(r))
      const base = [a.name, a.firmographic, (a.events ?? []).map(shortEvent).join('; '), rec?.status ?? '', a.website, a.country]
      if (!people.length) out.push([...base, '', '', '', '', '', ''])
      for (const m of people) out.push([...base, m.name, m.jobTitle, m.email, m.phone, rolesOf(m.records), m.note])
    }
    downloadCsv(`${everything ? 'directory' : `companies ${event} ${scope === 'series' ? 'all years' : year}`}`,
      ['Company', 'Type', 'Events', `${year} sales`, 'Website', 'Country', 'Name', 'Job title', 'Email', 'Phone', 'Roles', 'Note'], out)
  }
  const showType = type === 'all'
  const grid = COMPANY_GRID[`${showType ? 't' : ''}${everything ? 'e' : ''}`]
  const toggle = (k: string) => setOpenList((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))

  return (
    <WorkspacePage
      title={everything ? 'Directory' : 'Companies'}
      description={everything ? 'Every company in the CRM, across every event, each once with its people. Search a person to find them under their company.' : scope === 'series'
        ? `Every company at ${event || 'this event'}, once, across all its editions, with its people. Search a person to find them under their company.`
        : 'Every company in this edition, once, with its people.'}
      actions={
        <>
          {!everything && <ScopeSwitch value={picked} onChange={(v) => { setScope(v); setPage(1) }} />}
          <button type="button" className="ws-btn" disabled={!rows.length} onClick={exportCompanies} title="Download these companies and their people as a CSV">
            <Download className="w-4 h-4" /> Export
          </button>
        </>
      }
    >
      <Summary data={data} loading={isLoading} />
      {/* How far the intelligence layer reaches on this page, so the gaps in its columns read as coverage. */}
      {data && intelLoaded && (
        <p className="-mt-2 mb-4 px-1 text-[12px]" style={{ color: 'var(--fg-4)' }}>
          Intelligence on {shown.filter((a) => cardFor(a.key, a.name)).length} of {shown.length} companies on this page · Team is from LinkedIn via Lusha; Hospitals counts those named in sourced announcements, a lower bound
        </p>
      )}
      <div className="ws-card">
        <Toolbar query={query} setQuery={(v) => { setQuery(v); setPage(1) }} placeholder="Search companies or people…" count={rows.length} people={peopleCount}>
          <Segmented size="sm" value={type} onChange={(v) => { setType(v); setPage(1) }} options={[{ value: 'all', label: 'All' }, { value: 'Solution Provider', label: 'Solution providers' }, { value: 'End User', label: 'End users' }]} />
          <button type="button" className="ws-chip" data-active={conflicts} onClick={() => { setConflicts(!conflicts); setPage(1) }}>
            <AlertTriangle className="w-3.5 h-3.5" /> To check
          </button>
          {everything && (
            <button type="button" className="ws-chip" data-active={both} onClick={() => { setBoth(!both); setPage(1) }} title="Companies in both the Health and the Pharma events">
              In Health and Pharma
            </button>
          )}
          {/* From the intelligence layer */}
          <button type="button" className="ws-chip" data-active={sourced} onClick={() => { setSourced(!sourced); setPage(1) }} title="Companies with at least one hospital named in a sourced announcement">
            <Building2 className="w-3.5 h-3.5" /> Has sourced hospitals
          </button>
          <label className="inline-flex items-center">
            <span className="sr-only">Category</span>
            <select className="ws-chip !pr-7 appearance-none cursor-pointer" data-active={!!intelCat} value={intelCat} onChange={(e) => { setIntelCat(e.target.value); setPage(1) }}
              style={{ backgroundImage: 'none' }}>
              <option value="">Any category</option>
              {intel.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 -ml-6 pointer-events-none" style={{ color: 'var(--fg-4)' }} />
          </label>
        </Toolbar>
        {/* The people inside: by job title, and Health or Pharma */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="text-[12px] font-medium mr-1" style={{ color: 'var(--fg-4)' }}>People</span>
          <TitleFilter titles={titleCounts} tokens={pf.titles} onChange={(titles) => setP({ titles })} />
          {/* Health or Pharma: the Directory only; inside an event the event says it. */}
          {everything && (
            <Segmented size="sm" value={pf.focus || 'any'} onChange={(v) => setP({ focus: v === 'any' ? '' : (v as Focus) })}
              options={[{ value: 'any', label: 'Health or Pharma' }, { value: 'Health', label: 'Health' }, { value: 'Pharma', label: 'Pharma' }]} />
          )}
          {filtering && <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm ml-auto" onClick={() => setP({ titles: [], doing: '', focus: '' })}>Clear</button>}
        </div>
        {error ? <EmptyState icon={AlertTriangle} title="Couldn’t load the companies" body={(error as Error).message} /> :
         isLoading ? <Skeleton /> :
         rows.length === 0 ? <EmptyState icon={Building2} title="No companies match" body="Try another filter, or clear the search." /> : (
          <div className="overflow-x-auto">
            {/* On a phone a company is its name and type, with the sales
                action under the name; the rest is on its record. */}
            <div className="md:min-w-[900px]">
              <div className={`grid ${grid} gap-3 px-4 py-2.5 text-[12px] font-medium`} style={{ color: 'var(--fg-4)', borderBottom: '1px solid var(--line)' }}>
                <span>Company</span>{showType && <span>Type</span>}{everything && <span className="hidden md:block">Events</span>}<span className="hidden md:block">{add.year} sales</span>
                <span className="hidden md:block text-right" title="About, from LinkedIn via Lusha">Team</span><span className="hidden md:block pl-4">HQ</span><span className="hidden md:block text-right" title="Hospitals named in sourced announcements, a lower bound">Hospitals</span><span className="hidden md:block text-right">Similar</span>
                <span className="hidden md:block text-right">People</span><span className="hidden md:block text-right">Updated</span>
              </div>
              {shown.map((a) => {
                const found = q || filtering ? peopleOf(a) : []
                const expanded = open.has(a.key) || found.length > 0
                return (
                  <div key={a.key} style={{ borderBottom: '1px solid var(--line)' }}>
                    <div className={`grid ${grid} gap-3 items-center px-4 py-2.5 transition-colors hover:bg-[var(--glass-hover)]`}>
                      <span className="flex items-center gap-2 min-w-0">
                        <button type="button" onClick={() => toggle(a.key)} className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-1 shrink-0" aria-expanded={expanded} aria-label={expanded ? `Hide ${a.name}'s people` : `Show ${a.name}'s people`}>
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <CompanyLink a={a} className="flex items-center gap-3 min-w-0">
                          <Initials name={a.name} size={30} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 min-w-0"><span className="text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{a.name}</span>{everything && <Sides sides={a.sides ?? []} />}</span>
                            <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{a.best ? [a.best.name, a.best.jobTitle].filter(Boolean).join(' · ') : 'No contact yet'}</span>
                            {a.conflict && a.disagree?.length ? (
                              <span className="block text-[11.5px] truncate" style={{ color: 'var(--warn)' }} title={a.disagree.join('\n')}>
                                {a.disagree[0]}{a.disagree.length > 1 ? ` +${a.disagree.length - 1} more` : ''}
                              </span>
                            ) : null}
                          </span>
                        </CompanyLink>
                      </span>
                      {showType && <span><TypeBadge type={a.firmographic} conflict={a.conflict} /></span>}
                      {everything && <span className="hidden md:block min-w-0 truncate"><Events events={a.events ?? []} /></span>}
                      {(() => {
                        // This year's sponsor record, if the company has one.
                        const rec = (a.members ?? []).flatMap((m) => m.records).find((r) => r.relationship === 'Sponsor' && add.inYear(r))
                        if (rec) return <Link href={`${PATH[rec.table]}/${rec.id}`} className="col-span-2 md:col-span-1 pl-11 md:pl-0 text-[13px] truncate hover:underline underline-offset-4" style={{ color: 'var(--fg-2)' }}>{rec.status ?? 'In the pipeline'}</Link>
                        // Sales is for Solution Providers; an End User's people go to Production.
                        if (a.key === '__none' || !add.event || a.firmographic !== 'Solution Provider') return <span className="hidden md:block text-[13px]" style={{ color: 'var(--fg-4)' }}>—</span>
                        return <span className="col-span-2 md:col-span-1 pl-11 md:pl-0"><AddButton label="Sales pipeline" busy={add.busy === `company:${a.key}`} done={add.done.has(`company:${a.key}`)} onClick={() => add.addCompany(a)} /></span>
                      })()}
                      {(() => {
                        // A company the intelligence layer has nothing on says so once, in
                        // the Team cell; its other cells stay empty rather than a row of dashes.
                        const c = cardFor(a.key, a.name)
                        if (!c) return <><span className="hidden md:block col-span-4 text-[12px]" style={{ color: 'var(--fg-4)' }}>{intel.known.has(a.key) || intel.failed ? 'No intel yet' : ''}</span></>
                        const dash = <span style={{ color: 'var(--fg-4)' }}>—</span>
                        const city = c.hq ? c.hq.split(',')[0].trim() : null
                        // Hospitals are a vendor's; a provider shows its sourced vendors instead; none on file, a dash.
                        const vendorSide = c.roles.includes('vendor') || (!c.roles.includes('provider') && !c.providerType)
                        const hospitals = vendorSide ? (c.hospitals > 0 ? c.hospitals : null) : (c.vendors > 0 ? c.vendors : null)
                        return (
                          <>
                            <span className="hidden md:block text-right tabular text-[13px]" style={{ color: 'var(--fg-2)' }} title={c.team != null ? `About ${c.team.toLocaleString('en-GB')}, LinkedIn via Lusha${c.teamAsOf ? `, ${new Date(c.teamAsOf).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : ''}` : undefined}>{c.team != null ? c.team.toLocaleString('en-GB') : dash}</span>
                            <span className="hidden md:block pl-4 text-[12.5px] truncate" style={{ color: 'var(--fg-3)' }} title={c.hq ?? undefined}>{city ?? dash}</span>
                            <span className="hidden md:block text-right tabular text-[13px]" style={{ color: 'var(--fg-2)' }} title={hospitals ? `${hospitals} ${vendorSide ? 'hospitals' : 'vendors'} named in sourced announcements, a lower bound` : 'None on file'}>{hospitals ?? dash}</span>
                            <span className="hidden md:block text-right tabular text-[13px]" style={{ color: 'var(--fg-2)' }}>{c.similar > 0 ? c.similar : dash}</span>
                          </>
                        )
                      })()}
                      <span className="hidden md:block text-right tabular text-[13.5px]">{a.people}</span>
                      <span className="hidden md:block text-right text-[12.5px]" style={{ color: 'var(--fg-4)' }}>{timeAgo(a.updatedAt)}</span>
                    </div>
                    {expanded && <Members members={found.length && (filtering || !open.has(a.key)) ? found : a.members ?? []} query={q} company={a.name} add={add} where={everything ? 'event' : scope === 'series' ? 'year' : 'none'} account={a} />}
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

// ── Contacts ─────────────────────────────────────────────────────────────────

// Every contact, once, with their company in small letters beside the name:
// the same people as Companies, as one list.
export function ContactsView() {
  const { slug, year } = useWorkspace()
  const sk = `contacts.${slug}`
  const [scope, setScope] = useSticky<Scope>(`${sk}.scope`, 'series')
  const { data, isLoading, error } = useSegments(scope, 'people')
  const [type, setType] = useSticky<'all' | Firmographic>(`${sk}.type`, 'all')
  const [titles, setTitles] = useSticky<TitleToken[]>(`${sk}.titles`, [])
  const [query, setQuery] = useSticky(`${sk}.query`, '')
  const [page, setPage] = useSticky(`${sk}.page`, 1)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.people ?? []).filter((p) =>
      (type === 'all' || p.firmographic === type) && (!titles.length || titles.some((t) => tokenMatches(p.jobTitle, t))) &&
      (!q || p.name.toLowerCase().includes(q) || (p.email || '').includes(q) || (p.company || '').toLowerCase().includes(q) || (p.jobTitle || '').toLowerCase().includes(q) || (p.note || '').toLowerCase().includes(q)))
  }, [data, type, titles, query])
  // Every job title among the contacts of the type in view, with how many
  // hold it: what the title search offers, as on Companies.
  const titleCounts = useMemo(() => {
    const m = new Map<string, { title: string; count: number }>()
    for (const p of data?.people ?? []) {
      if (type !== 'all' && p.firmographic !== type) continue
      const t = (p.jobTitle || '').replace(/\s+/g, ' ').trim()
      if (!t) continue
      const e = m.get(t.toLowerCase()) ?? { title: t, count: 0 }
      e.count++
      m.set(t.toLowerCase(), e)
    }
    return Array.from(m.values()).sort((x, y) => y.count - x.count || x.title.localeCompare(y.title))
  }, [data, type])
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)
  const where: Where = scope === 'series' ? 'year' : 'none'
  const add = usePipelineAdd()

  return (
    <WorkspacePage
      title="Contacts"
      description={scope === 'series' ? 'Everyone at this event, across its editions, once, with their company beside their name.' : 'Everyone in this edition, once, with their company beside their name.'}
      actions={
        <>
          <ScopeSwitch value={scope} onChange={(v) => { setScope(v); setPage(1) }} />
          <button type="button" className="ws-btn" disabled={!rows.length} title="Download these contacts as a CSV"
            onClick={() => downloadCsv(`contacts ${slug ?? ''} ${scope === 'series' ? 'all years' : year ?? ''}`,
              ['Name', 'Company', 'Job title', 'Email', 'Phone', 'Type', 'Roles', 'Note'],
              rows.map((p) => [p.name, p.company, p.jobTitle, p.email, p.phone, p.firmographic, rolesOf(p.records), p.note]))}>
            <Download className="w-4 h-4" /> Export
          </button>
        </>
      }
    >
      <div className="ws-card overflow-hidden">
        <Toolbar query={query} setQuery={(v) => { setQuery(v); setPage(1) }} placeholder="Search names, companies, titles or emails…" count={rows.length}>
          <Segmented size="sm" value={type} onChange={(v) => { setType(v); setPage(1) }} options={[{ value: 'all', label: 'All' }, { value: 'Solution Provider', label: 'Solution providers' }, { value: 'End User', label: 'End users' }]} />
        </Toolbar>
        {/* By job title: words (chief, director…) or exact titles, as on Companies */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="text-[12px] font-medium mr-1" style={{ color: 'var(--fg-4)' }}>Job title</span>
          <TitleFilter titles={titleCounts} tokens={titles} onChange={(t) => { setTitles(t); setPage(1) }} />
          {titles.length > 0 && <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm ml-auto" onClick={() => { setTitles([]); setPage(1) }}>Clear</button>}
        </div>
        {error ? <EmptyState icon={AlertTriangle} title="Couldn’t load the contacts" body={(error as Error).message} /> :
         isLoading ? <Skeleton /> :
         rows.length === 0 ? <EmptyState icon={Users} title="No one matches" body="Try another filter, or clear the search." /> : (
          <ul className="flex flex-col">
            {shown.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5" style={{ borderTop: '1px solid var(--line)' }}>
                <RecLink rec={pageOf(p.records)} className="flex items-center gap-3 min-w-0 flex-1 basis-[260px]">
                  <Initials name={p.name || p.email || '?'} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate">
                      <span className="text-[13.5px] font-medium" style={{ color: 'var(--fg)' }}>{p.name || p.email}</span>
                      {p.company && <span className="text-[11.5px] ml-2" style={{ color: 'var(--fg-4)' }}>{p.company}</span>}
                    </span>
                    <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[p.jobTitle, p.email].filter(Boolean).join(' · ') || '—'}</span>
                    {p.note && <span className="block text-[11.5px] truncate mt-0.5" style={{ color: 'var(--fg-4)' }} title={p.note}>{p.note}</span>}
                  </span>
                </RecLink>
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] pl-[42px] sm:pl-0">
                  {p.records.map((r, i) => (
                    <RecLink key={i} rec={r} className="hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
                      {DOING[r.relationship]}{whereOf(r.event, where)}{r.status ? `: ${r.status}` : ''}
                    </RecLink>
                  ))}
                </span>
                <span className="pl-[42px] sm:pl-0"><PersonAdds add={add} who={p} company={p.company} type={p.firmographic} /></span>
              </li>
            ))}
          </ul>
        )}
        {rows.length > PAGE && <div className="px-4 py-3"><Pagination page={page} totalPages={Math.ceil(rows.length / PAGE)} total={rows.length} pageSize={PAGE} onPage={setPage} onPageSize={() => {}} /></div>}
      </div>
    </WorkspacePage>
  )
}

// ── Hit list ─────────────────────────────────────────────────────────────────

export function HitListView() {
  const { data, isLoading, error } = useSegments('edition', 'hit')
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
              <CompanyLink a={a} className="min-w-0">
                <span className="block text-[14px] font-semibold truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{a.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-[12px]" style={{ color: 'var(--fg-3)' }}>
                  {a.sponsorStage ?? a.decidedBy.join(', ')}
                  {a.tier ? <span>· {a.tier}</span> : null}
                  {a.valueAmount ? <span>· {formatMoney(a.valueAmount)}</span> : null}
                  {a.tags.length > 1 ? <span>· also {a.tags.filter((t) => t !== 'Sponsor').join(', ').toLowerCase()}</span> : null}
                </span>
              </CompanyLink>
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
