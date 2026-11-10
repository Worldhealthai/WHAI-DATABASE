'use client'

// The profile pages for anyone who is not yet on a pipeline (November 2026):
// a company with no sponsor record, and a person known only from a leads
// list. They read like any other profile: the company with its whole team
// across every event, the person with their details and their colleagues,
// and the way on (an End User into Production, a Solution Provider into
// Sales).

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Building2, Download, Globe, Linkedin, Loader2, Mail, MapPin, Pencil, Phone, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { downloadCsv } from '@/lib/csv'
import { CopyPopover } from '@/components/crm/CopyPopover'
import { CardHead, Crumbs, EventsLine, Fact, MiniHeader, NextStep, PROFILE_GRID, PROFILE_MAIN, ProfileSide, ProfileSkeleton, WhereLine, downloadVcard, fmtDate, initials, kindOfTable, nextStage, stageLabel, stageTone, useCollapse, type EventItem } from '@/components/crm/profileParts'
import { useWorkspace } from '@/lib/workspace'
import { companyKey, type Account, type Person, type Relationship } from '@/lib/segments'
import { Field, Modal, Segmented } from './ui'
import { AddButton, Members, PersonAdds, Sides, TypeBadge, companyHref, recHref, roles, usePipelineAdd } from './Segments'
import { IntelCompanyStrip, IntelDeployments, IntelDescription, IntelPeopleNamed, IntelSidebar, IntelStrip, NoIntel, useCategoryName, useIntel } from './IntelPanel'
import { isProvider as intelIsProvider, providerTypeLabel } from '@/lib/intel'

function useCompany(key: string | null, name: string | null) {
  return useQuery<{ account: Account; people: Person[] }>({
    queryKey: ['ws-segments', 'company', key, name],
    queryFn: async () => {
      const r = await fetch(`/api/companies/${encodeURIComponent(key || '')}?name=${encodeURIComponent(name || '')}`)
      if (!r.ok) throw new Error(r.status === 404 ? 'No company by that name' : 'Could not load the company')
      return r.json()
    },
    enabled: !!name,
    staleTime: 30_000,
  })
}

// The trail back: "← Companies › Aidoc".
function Trail({ label, href, current }: { label: string; href: string; current: string }) {
  return <nav className="mb-3 min-h-10 flex items-center"><Crumbs items={[{ label, href }]} current={current} /></nav>
}

const shortEvent = (e: string) => e.replace(/^World Health AI/i, 'WHAI').replace(/^World Pharma AI/i, 'WPAI')

// The company's history at our events: each event it was in, and what its
// people did there, derived from the team's records.
const DOING: Record<Relationship, [string, string]> = { Speaker: ['speaking', 'speaking'], Delegate: ['attending', 'attending'], Sponsor: ['sponsor contact', 'sponsor contacts'], Lead: ['lead', 'leads'] }
function EventHistory({ a, className = '' }: { a: Account; className?: string }) {
  const events = [...(a.events ?? [])].sort((x, y) => (y.match(/20\d{2}/)?.[0] ?? '').localeCompare(x.match(/20\d{2}/)?.[0] ?? '') || x.localeCompare(y))
  if (!events.length) return null
  const rows = events.map((e) => {
    const n = new Map<Relationship, number>()
    for (const m of a.members ?? []) for (const r of m.records) if (r.event && r.event.toLowerCase() === e.toLowerCase()) n.set(r.relationship, (n.get(r.relationship) ?? 0) + 1)
    const parts = (['Sponsor', 'Speaker', 'Delegate', 'Lead'] as Relationship[]).filter((k) => n.get(k)).map((k) => `${n.get(k)} ${DOING[k][n.get(k)! > 1 ? 1 : 0]}`)
    return { e, parts }
  })
  return <EventHistoryCard rows={rows} className={className} />
}
function EventHistoryCard({ rows, className }: { rows: { e: string; parts: string[] }[]; className: string }) {
  const c = useCollapse('company-events')
  return (
    <section className={`ws-card overflow-hidden scroll-mt-4 ${className}`} id="events">
      <CardHead title="Events" count={rows.length} collapse={{ open: c.open, toggle: c.toggle, id: c.id }} />
      <ul id={c.id} className={`flex flex-col ${c.bodyClass}`}>
        {rows.map(({ e, parts }) => (
          <li key={e} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 sm:px-5 py-2.5 min-h-[44px]" style={{ borderTop: '1px solid var(--line)' }}>
            <span className="text-[13.5px] font-medium flex-1 basis-[200px]" style={{ color: 'var(--fg)' }}>{shortEvent(e)}</span>
            <span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{parts.length ? parts.join(' · ') : 'In the CRM for this event'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// "A name opens their details", said once: after the first profile seen
// on this browser it stays quiet.
const HINT_KEY = 'crm.hint.contactPanel'
const seenHint = () => { try { return !!localStorage.getItem(HINT_KEY) } catch { return true } }
function NameHint() {
  // Read once on the client (the server shows nothing); marked seen after,
  // without a re-render, so it stays for the page it first appeared on.
  const seen = useSyncExternalStore(() => () => {}, seenHint, () => true)
  useEffect(() => { try { localStorage.setItem(HINT_KEY, '1') } catch { /* private window */ } }, [])
  if (seen) return null
  return <span className="text-[11.5px]" style={{ color: 'var(--fg-4)' }}>A name opens their details</span>
}

// ── A company ────────────────────────────────────────────────────────────────

// The page in two columns on a desk (PROFILE_* in profileParts): the main
// column reads top to bottom (who they are, what they do, the hospitals or
// vendors, the team, the events); the sidebar (sticky while it fits) holds the
// companies around them: similar companies, competitors, signals. On a
// phone everything stacks in the main column's order, with the sidebar's
// cards after the team: that is what the order-* classes are for.

// Where the company is at each event, for the band's one line: its Sales
// stage where it has a record there, else what its people do.
const ROLE_WORD: Record<Relationship, string> = { Sponsor: 'Sponsor', Speaker: 'Speaking', Delegate: 'Attending', Lead: 'Lead' }
function companyEvents(a: Account, slug: string | null): EventItem[] {
  const recs = (a.members ?? []).flatMap((m) => m.records).filter((r) => r.event)
  const events = Array.from(new Set(recs.map((r) => String(r.event))))
    .sort((x, y) => (y.match(/20\d{2}/)?.[0] ?? '').localeCompare(x.match(/20\d{2}/)?.[0] ?? '') || x.localeCompare(y))
  return events.map((e) => {
    const here = recs.filter((r) => String(r.event).toLowerCase() === e.toLowerCase())
    const best = here.find((r) => r.relationship === 'Sponsor') ?? here.find((r) => r.relationship === 'Speaker') ?? here.find((r) => r.relationship === 'Delegate') ?? here[0]
    const kind = kindOfTable(best.table)
    const status = best.relationship === 'Sponsor' && best.status && kind ? stageLabel(kind, best.status) : ROLE_WORD[best.relationship]
    return { key: e, event: e, status, tone: kind ? stageTone(kind, best.status) : 'var(--line-3)', href: recHref(slug, best) }
  })
}

export function CompanyProfile({ companyKeyParam, name }: { companyKeyParam: string; name: string }) {
  const ws = useWorkspace()
  const qc = useQueryClient()
  const { data, isLoading, error } = useCompany(companyKeyParam, name)
  // The intelligence layer (crm.intel_company), read alongside the company.
  const intelQ = useIntel(companyKeyParam, name)
  const intel = intelQ.data?.company ?? null
  const add = usePipelineAdd()
  const a = data?.account
  const back = ws.href('companies')
  const headRef = useRef<HTMLElement>(null)
  const openAdd = useRef<(() => void) | null>(null)
  const [moving, setMoving] = useState(false)

  if (isLoading) return <ProfileSkeleton />
  if (error || !a) return (
    <div className="crm-profile max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-6">
      <Trail label="Companies" href={back} current={name} />
      <p className="ws-card px-4 sm:px-5 py-4 text-[13.5px]" style={{ color: 'var(--fg-3)' }}>{(error as Error)?.message || 'Not found'}</p>
    </div>
  )
  const isProvider = intel ? intelIsProvider(intel) : a.firmographic === 'End User'
  const members = a.members ?? []
  const records = members.flatMap((m) => m.records)
  const inSales = records.find((r) => r.relationship === 'Sponsor' && add.inYear(r))
  const solution = a.firmographic === 'Solution Provider'
  // With the band's action on the company, the per-person one is noise.
  const personAdd = add.event && solution ? undefined : add
  const website = a.website ?? intel?.website ?? null
  const edition = add.event ? shortEvent(add.event) : null
  // An End User's way on is one person at a time into Production: the band
  // offers the best-placed one not yet in it; the rest are a tap away below.
  const speaking = members.filter((m) => m.records.some((r) => r.relationship === 'Speaker' && add.inYear(r)))
  const candidate = !solution ? ([a.best && members.find((m) => m.name === a.best?.name), ...members].find((m) => m && !speaking.includes(m)) || null) : null

  const moveSales = async (status: string) => {
    if (!inSales) return
    setMoving(true)
    try {
      await fetch(`/api/${inSales.table}/${inSales.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      await qc.invalidateQueries({ queryKey: ['ws-segments'] })
      qc.invalidateQueries({ queryKey: ['ws-board'] })
    } finally { setMoving(false) }
  }
  const exportTeam = () => downloadCsv(`${a.name} team`, ['Name', 'Job title', 'Email', 'Phone', 'Records'],
    members.map((m) => [m.name, m.jobTitle, m.email, m.phone, roles(m.records).map((r) => [ROLE_WORD[r.relationship], r.event ? shortEvent(r.event) : null, r.status].filter(Boolean).join(' · ')).join('; ')]))

  const primary = !add.event ? null
    : solution ? (inSales
      ? (() => { const n = inSales.status ? nextStage('sponsor', inSales.status) : null; return n ? <button type="button" className="ws-btn ws-btn-sm ws-btn-primary ws-tap" disabled={moving} onClick={() => moveSales(n.status)}>{moving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />} Move to {n.label.toLowerCase()}</button> : null })()
      : <AddButton primary label="Sales pipeline" busy={add.busy === `company:${a.key}`} done={add.done.has(`company:${a.key}`)} onClick={() => add.addCompany(a)} />)
    : candidate ? <PersonAdds add={add} who={candidate} company={a.name} type="End User" primary /> : null

  const where = !add.event ? <WhereLine label="Not in a workspace" kind={null} />
    : solution ? (inSales
      ? <WhereLine label="In Sales" kind="sponsor" status={inSales.status} extra={<>
          <span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{edition}</span>
          {recHref(ws.slug, inSales) && <Link href={recHref(ws.slug, inSales)!} className="text-[12.5px] hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>Open the record</Link>}
        </>} />
      : <WhereLine label="Not in Sales yet" kind={null} extra={<span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{edition}</span>} />)
    : <WhereLine label="Production" kind={null} extra={<span className="text-[13px]" style={{ color: 'var(--fg-2)' }}>
        <span className="font-semibold" style={{ color: 'var(--fg)' }}>{speaking.length} of {members.length}</span> {members.length === 1 ? 'person' : 'people'} in it for {edition}
        {candidate && <span style={{ color: 'var(--fg-4)' }}> · next to add: {candidate.name}</span>}
      </span>} />

  return (
    <div className="crm-profile max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-24 sm:pb-8">
      <Trail label="Companies" href={back} current={a.name} />
      <MiniHeader watch={headRef} name={a.name} action={primary} />
      <div className={PROFILE_GRID}>
        <div className={PROFILE_MAIN}>
          {/* Who they are, the ten-second strip, and where we are with them */}
          <header ref={headRef} className="ws-card overflow-hidden order-1">
            <div className="p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[15px] font-semibold shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)', border: '1px solid var(--line)' }}>{initials(a.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-medium flex items-center gap-2 flex-wrap" style={{ color: 'var(--fg-4)' }}>
                  <TypeBadge type={a.firmographic} conflict={a.conflict} /> <Sides sides={a.sides ?? []} />
                  {intel?.providerType && <span className="text-[12px]" style={{ color: 'var(--fg-3)' }}>{providerTypeLabel(intel.providerType)}</span>}
                </p>
                <h1 className="text-[22px] font-semibold leading-tight tracking-tight sm:truncate mt-0.5" style={{ color: 'var(--fg)' }}>{a.name}</h1>
                <p className="text-[13px] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--fg-3)' }}>
                  {/* The people here are the CRM's contacts, not the company's size (that is in the strip below). */}
                  <span className="inline-flex items-center gap-1" title="People at this company in the CRM"><Users className="w-3.5 h-3.5" /> {a.people} {a.people === 1 ? 'contact' : 'contacts'} on file</span>
                  {intel?.odsCode && <span className="inline-flex items-center gap-1 tabular" title="NHS ODS code, from the Intelligence dataset">ODS {intel.odsCode}</span>}
                  {/* Location lives in the strip once the intelligence layer has it. */}
                  {!intel?.hq && a.country && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {a.country}</span>}
                  {website && <a href={/^https?:\/\//i.test(website) ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline underline-offset-4"><Globe className="w-3.5 h-3.5" /> {website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>}
                </p>
              </div>
              {/* The secondary actions; the primary one is in the band below. */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:shrink-0">
                {a.key !== '__none' && <button type="button" onClick={() => openAdd.current?.()} className="ws-btn ws-btn-sm ws-tap"><UserPlus className="w-3.5 h-3.5" /> Add contact</button>}
                <button type="button" onClick={exportTeam} disabled={!members.length} className="ws-btn ws-btn-sm ws-tap" title="The team as a spreadsheet (CSV)"><Download className="w-3.5 h-3.5" /> Export</button>
              </div>
            </div>
            {/* The ten-second strip, or the quiet line when the layer has nothing. */}
            {intel ? <IntelStrip c={intel} /> : intelQ.isSuccess ? <NoIntel compact /> : null}
            <NextStep
              where={where}
              action={<>
                {add.event && <Link href={ws.href(solution ? 'pipeline' : 'production')} className="ws-btn ws-btn-sm ws-tap">{solution ? 'Sales' : 'Production'} board</Link>}
                {primary}
              </>}
              events={<EventsLine items={companyEvents(a, ws.slug)} />}
            />
          </header>

          {/* What they do, with its sources; the hospitals or vendors with their evidence */}
          {intel && <IntelDescription c={intel} className="order-2" />}
          {intel && <IntelDeployments c={intel} slug={ws.slug} className="order-3" />}

          {/* The team: the CRM's people, then anyone Lusha names besides */}
          <section className="ws-card overflow-hidden order-4" id="team">
            <CardHead title={isProvider ? 'People' : 'Team'} count={members.length} sub={<NameHint />} />
            <Members members={members} query="" company={a.name} add={personAdd} where="event" account={a} flush openAdd={openAdd} />
            {intel && <IntelPeopleNamed c={intel} exclude={members.map((m) => m.name)} type={a.firmographic} />}
          </section>

          {/* The lead lists' notes are per person: in the contact panel, not here. */}
          <EventHistory a={a} className="order-6" />
        </div>

        {/* The companies around them */}
        {intel && (
          <ProfileSide>
            <IntelSidebar c={intel} slug={ws.slug} className="order-5" />
          </ProfileSide>
        )}
      </div>
    </div>
  )
}

// ── A person known from a leads list ─────────────────────────────────────────

type Lead = Record<string, string | null>

export function ContactProfile({ id }: { id: string }) {
  const ws = useWorkspace()
  const router = useRouter()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false)
  const headRef = useRef<HTMLElement>(null)
  const { data: lead, isLoading, error } = useQuery<Lead>({
    queryKey: ['lead', id],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${id}`)
      if (!r.ok) throw new Error(r.status === 404 ? 'This contact has moved: they are now in a pipeline, or were removed.' : 'Could not load the contact')
      return r.json()
    },
  })
  const company = useCompany(lead?.companyName ? companyKey(lead.companyName) : null, lead?.companyName ?? null)
  // The company's own categories, in place of Lusha's industry.
  const intelCo = useIntel(lead?.companyName ? companyKey(lead.companyName) : null, lead?.companyName ?? null).data?.company ?? null
  const catName = useCategoryName()
  const back = ws.href('contacts')

  const move = async (to: 'speaker' | 'sponsor') => {
    if (!lead?.event) return
    setBusy(to); setErr('')
    try {
      const r = await fetch(`/api/leads/${id}/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, event: lead.event }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error || 'Could not add them')
      qc.invalidateQueries({ queryKey: ['ws-segments'] })
      qc.invalidateQueries({ queryKey: ['ws-board'] })
      router.replace(`/${j.kind === 'speaker' ? 'speakers' : 'sponsors'}/${j.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add them')
      setBusy(null)
    }
  }
  const remove = async () => {
    if (!confirm('Remove this contact from the CRM?')) return
    setBusy('remove')
    const r = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (r.ok) { qc.invalidateQueries({ queryKey: ['ws-segments'] }); router.replace(back) } else { setErr('Could not remove them'); setBusy(null) }
  }

  if (isLoading) return <ProfileSkeleton side={false} />
  if (error || !lead) return (
    <div className="crm-profile max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-6">
      <Trail label="Contacts" href={back} current="Contact" />
      <p className="ws-card px-4 sm:px-5 py-4 text-[13.5px]" style={{ color: 'var(--fg-3)' }}>{(error as Error)?.message || 'Not found'}</p>
    </div>
  )

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || 'Unnamed'
  const where = [lead.city, lead.country].filter(Boolean).join(', ')
  const acct = company.data?.account
  const type = acct?.firmographic ?? (lead.segment as Account['firmographic'])
  const colleagues = (acct?.members ?? []).filter((m) => !m.records.some((r) => r.table === 'leads' && r.id === id))
  const firmHref = acct ? companyHref(ws.slug, acct) : null

  const moveBtn = type === 'End User' ? (
    <button onClick={() => move('speaker')} disabled={!!busy} className="ws-btn ws-btn-sm ws-btn-primary ws-tap">
      {busy === 'speaker' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Production pipeline
    </button>
  ) : (
    <button onClick={() => move('sponsor')} disabled={!!busy || !lead.companyName} className="ws-btn ws-btn-sm ws-btn-primary ws-tap" title={lead.companyName ? `${lead.companyName} into Sales, with ${name} as its contact` : 'No company to add'}>
      {busy === 'sponsor' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Sales pipeline
    </button>
  )

  return (
    <div className="crm-profile max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-24 sm:pb-8">
      <Trail label="Contacts" href={back} current={name} />
      <MiniHeader watch={headRef} name={name} action={moveBtn} />
      <div className="flex flex-col gap-4">
      <header ref={headRef} className="ws-card overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)', border: '1px solid var(--line)' }}>{initials(name)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>Contact · {type}</p>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight sm:truncate" style={{ color: 'var(--fg)' }}>{name}</h1>
            {(lead.jobTitle || lead.companyName) && (
              <p className="text-[13.5px] mt-0.5" style={{ color: 'var(--fg-2)' }}>
                {lead.jobTitle}{lead.jobTitle && lead.companyName && <span style={{ color: 'var(--fg-4)' }}> · </span>}
                {lead.companyName && (firmHref ? <Link href={firmHref} className="hover:underline underline-offset-4">{lead.companyName}</Link> : lead.companyName)}
              </p>
            )}
            <div className="flex items-center gap-1 mt-2 flex-wrap -ml-2">
              {lead.email && <CopyPopover label={`${name}'s email`} value={lead.email} title={`Email: ${lead.email}`}><Mail className="w-3.5 h-3.5" /> <span className="max-w-[240px] truncate">{lead.email}</span></CopyPopover>}
              {lead.email2 && <CopyPopover label={`${name}'s other email`} value={lead.email2} title={`Email: ${lead.email2}`}><Mail className="w-3.5 h-3.5" /> <span className="max-w-[240px] truncate">{lead.email2}</span></CopyPopover>}
              {lead.phone && <CopyPopover label={`${name}'s phone`} value={lead.phone} title={`Phone: ${lead.phone}`}><Phone className="w-3.5 h-3.5" /> {lead.phone}</CopyPopover>}
              {lead.linkedinUrl && <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="ws-btn ws-btn-ghost ws-btn-sm ws-tap"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</a>}
            </div>
          </div>
          {/* The secondary actions; the primary one is in the band below. */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:shrink-0">
            <button onClick={() => setEditing(true)} disabled={!!busy} className="ws-btn ws-btn-sm ws-tap"><Pencil className="w-3.5 h-3.5" /> Edit</button>
            <button onClick={() => downloadVcard({ name, jobTitle: lead.jobTitle, company: lead.companyName, email: lead.email, phone: lead.phone, url: lead.linkedinUrl })} className="ws-btn ws-btn-sm ws-tap" title="Their details as a contact card (.vcf)"><Download className="w-3.5 h-3.5" /> Export</button>
            <button onClick={remove} disabled={!!busy} className="ws-btn ws-btn-sm ws-btn-ghost ws-tap max-sm:!w-9 max-sm:!px-0" title="Delete this contact" aria-label="Delete this contact" style={{ color: 'var(--bad)' }}>
              {busy === 'remove' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        {editing && <EditContactModal lead={lead} onClose={() => setEditing(false)} onSaved={(next) => { qc.setQueryData(['lead', id], next); qc.invalidateQueries({ queryKey: ['ws-segments'] }); setEditing(false) }} />}
        <NextStep
          where={<WhereLine label="Not in a pipeline yet" kind={null} extra={<>
            <span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{type === 'End User' ? 'An End User goes to Production' : 'A Solution Provider goes to Sales'}</span>
            {err && <span className="text-[12px]" style={{ color: 'var(--bad)' }}>{err}</span>}
          </>} />}
          action={moveBtn}
          events={lead.event ? <EventsLine items={[{ key: lead.event, event: lead.event, status: 'Lead', current: true }]} /> : undefined}
        />
      </header>

      {/* Their company in ten seconds, each part a link to its page */}
      <IntelCompanyStrip companyKey={acct?.key ?? (lead.companyName ? companyKey(lead.companyName) : null)} name={lead.companyName ?? null} slug={ws.slug} />

        <section className="ws-card overflow-hidden">
          <CardHead title="About" />
          <div className="px-4 sm:px-5 pb-5">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <Fact label="Company" value={lead.companyName ? <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {lead.companyName}</span> : '—'} />
            <Fact label="Type" value={type || '—'} />
            <Fact label="Location" value={where ? <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {where}</span> : '—'} />
            {intelCo?.categories.length
              ? <Fact label="Category" value={<span className="whitespace-normal">{intelCo.categories.map(catName).join(' · ')}</span>} />
              : <Fact label="Industry" value={[lead.industry, lead.subIndustry].filter(Boolean).join(' · ') || '—'} />}
            <Fact label="Website" value={lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline underline-offset-4"><Globe className="w-3.5 h-3.5" /> {lead.website.replace(/^https?:\/\/(www\.)?/, '')}</a> : '—'} />
            <Fact label="Added" value={fmtDate(lead.createdAt)} />
          </dl>
          {lead.notes && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
              <p className="text-[11.5px] font-medium mb-1" style={{ color: 'var(--fg-4)' }}>Notes</p>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fg-2)' }}>{lead.notes}</p>
            </div>
          )}
          </div>
        </section>

        <section className="ws-card overflow-hidden">
          <CardHead
            title={lead.companyName ? <>Colleagues at {lead.companyName}</> : 'Colleagues'}
            count={company.isLoading ? '' : colleagues.length}
            action={firmHref ? <Link href={firmHref} className="ws-btn ws-btn-ghost ws-btn-sm ws-tap" style={{ color: 'var(--fg-3)' }}>Company profile</Link> : undefined}
          />
          {company.isLoading ? <div className="h-24 mx-4 sm:mx-5 mb-4 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} /> :
           colleagues.length === 0 ? <p className="px-4 sm:px-5 pb-4 text-[13px]" style={{ color: 'var(--fg-4)' }}>No one else at {lead.companyName || 'their company'} yet.</p> : (
            <Members members={colleagues} query="" company={acct!.name} where="year" flush />
          )}
        </section>
      </div>
    </div>
  )
}

// Edit a contact's details (a person from a leads list): name, title,
// company, emails, phone, LinkedIn, location, website, type and notes.
const LEAD_FIELDS: { k: string; label: string; type?: string; span?: boolean }[] = [
  { k: 'firstName', label: 'First name' }, { k: 'lastName', label: 'Last name' },
  { k: 'jobTitle', label: 'Job title' }, { k: 'companyName', label: 'Company' },
  { k: 'email', label: 'Email', type: 'email' }, { k: 'email2', label: 'Other email', type: 'email' },
  { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'linkedinUrl', label: 'LinkedIn URL', type: 'url' },
  { k: 'city', label: 'City' }, { k: 'country', label: 'Country' },
  { k: 'website', label: 'Company website', type: 'url', span: true },
]

function EditContactModal({ lead, onClose, onSaved }: { lead: Lead; onClose: () => void; onSaved: (next: Lead) => void }) {
  const [f, setF] = useState<Record<string, string>>(() => Object.fromEntries([...LEAD_FIELDS.map((x) => x.k), 'notes', 'segment'].map((k) => [k, lead[k] ?? ''])))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    setSaving(true); setErr('')
    try {
      const r = await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error || 'Could not save')
      onSaved(j)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save')
      setSaving(false)
    }
  }
  return (
    <Modal title="Edit contact" subtitle={[lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || undefined} onClose={onClose} width="max-w-2xl"
      footer={<>
        {err && <span className="text-[12px] mr-auto" style={{ color: 'var(--bad)' }}>{err}</span>}
        <button type="button" className="ws-btn ws-btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="ws-btn ws-btn-primary" onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LEAD_FIELDS.map((x) => (
          <Field key={x.k} label={x.label} span={x.span}>
            <input className="ws-input" type={x.type ?? 'text'} value={f[x.k]} onChange={(e) => setF((p) => ({ ...p, [x.k]: e.target.value }))} />
          </Field>
        ))}
        <Field label="Type" span>
          <Segmented size="sm" value={f.segment || 'End User'} onChange={(v) => setF((p) => ({ ...p, segment: v }))}
            options={[{ value: 'End User', label: 'End User' }, { value: 'Solution Provider', label: 'Solution Provider' }]} />
        </Field>
        <Field label="Notes" span>
          <textarea className="ws-input min-h-[90px] py-2" value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} />
        </Field>
      </div>
    </Modal>
  )
}
