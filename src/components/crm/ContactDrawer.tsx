'use client'

// The contact panel (November 2026): a click on a person's name in any list
// (a company's team, Contacts, a sponsor's contacts, the people Lusha names)
// slides their details in from the right, before anyone leaves the page:
// who they are, how to reach them, which side of the business they are for,
// every record they have in the CRM with its stage and event, their note,
// their company in one line, and the way on into a pipeline. "Open full
// profile" goes to their page as before; Previous and Next step through the
// list the name was in. On a phone it takes the whole screen.
//
// What the list already holds shows at once; the rest (location, LinkedIn,
// website, a second email) is fetched from their record while the panel is
// open. Mounted once, in the app's frame, through ContactDrawerProvider;
// any list opens it with ContactLink.

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Globe, Linkedin, Mail, MapPin, Pencil, Phone, X } from 'lucide-react'
import type { PersonRole } from '@/app/api/people/roles/route'
import { Initials } from '@/components/workspace/ui'
import { PersonAdds, companyHref, recHref, usePipelineAdd } from '@/components/workspace/Segments'
import { useIntel } from '@/components/workspace/IntelPanel'
import { useWorkspaceFromUrl } from '@/lib/workspace'
import { companyKey, type Member, type Relationship } from '@/lib/segments'
import { isProvider } from '@/lib/intel'
import { copyText, splitValues } from './CopyPopover'
import { FocusToggle } from './FocusToggle'
import { ContactDrawerContext, type ContactRecord, type ContactSeed } from './ContactLink'
import { StageDot, fmtDate, kindOfTable, stageLabel, stageTone } from './profileParts'

const shortEvent = (e: string | null | undefined) => (e || '').replace(/^World Health AI/i, 'WHAI').replace(/^World Pharma AI/i, 'WPAI')
// A lead record carries no role word: the event, when it was added and the
// list it came from say it (Ali, November 2026).
const DOING: Record<Relationship, string> = { Speaker: 'Speaking', Delegate: 'Attending', Sponsor: 'Company contact', Lead: '' }
const ROLE_REL: Record<PersonRole['kind'], Relationship> = { speaker: 'Speaker', delegate: 'Delegate', sponsor: 'Sponsor', partner: 'Sponsor' }
const num = (n: number) => n.toLocaleString('en-GB')

// What the panel shows: one person, and the list they were opened from so
// Previous and Next can step through it without closing.
interface Open { list: ContactSeed[]; index: number }
const seedId = (s: ContactSeed) => `${s.key ?? s.name}|${s.company ?? ''}`

export function ContactDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null)
  // Where focus was when the panel opened, for its return on close.
  const opener = useRef<HTMLElement | null>(null)
  const openContact = useCallback((s: ContactSeed, list?: ContactSeed[]) => {
    opener.current = document.activeElement as HTMLElement | null
    const at = list ? list.findIndex((x) => seedId(x) === seedId(s)) : -1
    // The seed clicked wins over its copy in the list (it carries the href).
    setOpen(at >= 0 && list ? { list: list.map((x, i) => (i === at ? s : x)), index: at } : { list: [s], index: 0 })
  }, [])
  const close = useCallback(() => {
    setOpen(null)
    const el = opener.current
    opener.current = null
    requestAnimationFrame(() => el?.focus?.())
  }, [])
  const step = useCallback((d: -1 | 1) => setOpen((o) => (o ? { ...o, index: Math.min(o.list.length - 1, Math.max(0, o.index + d)) } : o)), [])
  const api = useMemo(() => ({ openContact, close }), [openContact, close])
  return (
    <ContactDrawerContext.Provider value={api}>
      {children}
      {open && <Drawer open={open} onClose={close} onStep={step} />}
    </ContactDrawerContext.Provider>
  )
}


// The record's own row, for what the list did not carry.
type Detail = Record<string, string | null | undefined>
function useDetail(records: ContactRecord[]) {
  const lead = records.find((r) => r.table === 'leads')
  const own = lead ?? records.find((r) => r.table === 'speakers') ?? records.find((r) => r.table === 'delegates')
  const url = own ? `/api/${own.table}/${own.id}` : null
  return useQuery<Detail>({
    queryKey: ['contact-drawer', url],
    queryFn: async () => {
      const r = await fetch(url!)
      if (!r.ok) throw new Error('detail')
      return r.json()
    },
    enabled: !!url,
    staleTime: 60_000,
  })
}

// Everything else they are in (GET /api/people/roles), for a seed that
// carried only one record (a sponsor's contact).
function useOtherRoles(seed: ContactSeed) {
  const [first, ...rest] = seed.name.trim().split(/\s+/)
  const p = new URLSearchParams()
  if (seed.email) p.set('email', seed.email)
  else { if (first) p.set('first', first); if (rest.length) p.set('last', rest.join(' ')); if (seed.company) p.set('org', seed.company) }
  const key = p.toString()
  return useQuery<{ roles: PersonRole[] }>({
    queryKey: ['person-roles', key],
    queryFn: async () => {
      const r = await fetch(`/api/people/roles?${key}`)
      if (!r.ok) throw new Error('roles')
      return r.json()
    },
    enabled: Boolean(seed.email || (first && rest.length)),
    staleTime: 30_000,
  })
}

// The panel's frame: the scrim, focus held inside while it is open (and
// back where it was after, see the provider), Escape to close. The body is
// keyed by the person, so stepping to the next one starts it afresh.
function Drawer({ open, onClose, onStep }: { open: Open; onClose: () => void; onStep: (d: -1 | 1) => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const seed = open.list[open.index]
  // Stepping replaces the body, and the button pressed with it: focus goes
  // to the same button in the new one (or the panel, at the list's end).
  const stepped = useRef<'prev' | 'next' | null>(null)
  const step = (d: -1 | 1) => { stepped.current = d < 0 ? 'prev' : 'next'; onStep(d) }
  useEffect(() => {
    if (!stepped.current) return
    const b = panel.current?.querySelector<HTMLButtonElement>(`[data-step="${stepped.current}"]`)
    if (b && !b.disabled) b.focus(); else panel.current?.focus()
    stepped.current = null
  }, [open.index])
  useEffect(() => {
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
  }, [onClose])
  // Tab and Shift+Tab go round inside the panel.
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panel.current) return
    const f = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null)
    if (!f.length) return
    const first = f[0], last = f[f.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div className="absolute inset-0 anim-fade-in" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onMouseDown={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${seed.name}: contact details`}
        onKeyDown={trap}
        className="crm-profile absolute inset-y-0 right-0 w-full sm:w-[440px] flex flex-col outline-none anim-slide-in-right"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--line-2)', boxShadow: 'var(--shadow-lg)' }}
      >
        <DrawerBody key={seedId(seed)} seed={seed} onClose={onClose} onStep={step} index={open.index} total={open.list.length} prevName={open.list[open.index - 1]?.name} nextName={open.list[open.index + 1]?.name} />
      </div>
    </div>
  )
}

// A detail that copies itself on a tap: the icon, the value, and "Copy"
// (then "Copied") at the end. A link (LinkedIn, website) opens instead.
function DetailRow({ icon: Icon, value, label, href, hint }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; value: string; label: string; href?: string; hint?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const cls = 'crm-row w-full flex items-center gap-3 px-5 min-h-[40px] max-sm:min-h-[44px] text-left'
  const body = (
    <>
      <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--fg-4)' }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] truncate" style={{ color: 'var(--fg)' }}>{value}</span>
        {hint && <span className="block text-[11.5px]" style={{ color: 'var(--fg-4)' }}>{hint}</span>}
      </span>
    </>
  )
  if (href) return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} title={`Open ${label}`}>
      {body}<ArrowUpRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--fg-4)' }} />
    </a>
  )
  return (
    <button type="button" className={cls} title={`Copy ${label}`} aria-label={`Copy ${label}: ${value}`} onClick={async () => { if (await copyText(value)) { setCopied(true); setTimeout(() => setCopied(false), 1600) } }}>
      {body}
      <span className="shrink-0 inline-flex items-center gap-1 text-[11.5px]" style={{ color: copied ? 'var(--ok)' : 'var(--fg-4)' }} aria-live="polite">
        {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
      </span>
    </button>
  )
}

// A note, shut after three lines with a way to read the rest.
function Clamped({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [long, setLong] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => { const el = ref.current; if (el) setLong(el.scrollHeight > el.clientHeight + 2) }, [text])
  return (
    <>
      <p ref={ref} className={`text-[13px] leading-relaxed whitespace-pre-wrap ${open ? '' : 'line-clamp-3'}`} style={{ color: 'var(--fg-2)' }}>{text}</p>
      {(long || open) && (
        <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm ws-tap -ml-2 mt-0.5" style={{ color: 'var(--fg-3)' }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Show less' : 'Show more'} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    </>
  )
}

const sectionHead = (t: string, extra?: React.ReactNode) => (
  <h3 className="px-5 pb-1.5 flex items-baseline justify-between gap-3 text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>{t}{extra}</h3>
)

function DrawerBody({ seed, onClose, onStep, index, total, prevName, nextName }: { seed: ContactSeed; onClose: () => void; onStep: (d: -1 | 1) => void; index: number; total: number; prevName?: string; nextName?: string }) {
  const ws = useWorkspaceFromUrl()
  const slug = ws.slug
  const add = usePipelineAdd()
  const records = seed.records ?? []
  const detail = useDetail(records)
  const roles = useOtherRoles(seed)
  const d = detail.data ?? {}

  const email = seed.email ?? d.email ?? null
  const email2 = seed.email2 ?? d.email2 ?? null
  const phone = seed.phone ?? d.phone ?? null
  const jobTitle = seed.jobTitle ?? d.jobTitle ?? null
  const company = seed.company ?? d.companyName ?? d.organization ?? null
  const linkedin = seed.linkedinUrl ?? d.linkedinUrl ?? null
  const where = [seed.city ?? d.city, seed.country ?? d.country].filter(Boolean).join(', ')
  const note = seed.note ?? d.notes ?? null
  const notes = d.notes && d.notes !== note ? d.notes : null

  // Their records: the seed's, plus any the roles lookup adds.
  const all: ContactRecord[] = [...records]
  for (const r of roles.data?.roles ?? []) {
    const table = `${r.kind}s`
    if (!all.some((x) => x.table === table && x.id === r.id)) all.push({ relationship: ROLE_REL[r.kind], table, id: r.id, status: r.status, event: r.event })
  }
  const sponsorRec = all.find((r) => r.relationship === 'Sponsor')
  const coKey = companyKey(company)
  const coHref = company ? (sponsorRec && sponsorRec.table === 'sponsors' ? `/sponsors/${sponsorRec.id}` : coKey ? companyHref(slug, { key: coKey, name: company }) : null) : null

  // Their company in one line, from the intelligence layer. The website is
  // the company's own; the lead record's only when no company is linked.
  const intel = useIntel(coKey, company).data?.company ?? null
  const website = intel?.website ?? seed.website ?? d.website ?? null
  const websiteFromLead = !intel?.website && !!website
  const facts: string[] = []
  if (intel) {
    if (intel.teamFact) facts.push(`Team about ${num(intel.teamFact.value)}`)
    if (intel.hq) facts.push(intel.hq)
    const n = isProvider(intel) ? intel.vendors : intel.hospitals
    if (n > 0) facts.push(`${n} ${isProvider(intel) ? 'vendors' : 'hospitals'} in sourced announcements`)
    if (intel.categories.length) facts.push(intel.categories.slice(0, 2).join(', '))
  }

  const who: Pick<Member, 'key' | 'name' | 'email' | 'phone' | 'jobTitle' | 'records'> = { key: seed.key ?? seed.email ?? seed.name, name: seed.name, email, phone, jobTitle, records: all }
  const focusRows = seed.focusRows ?? records.map((r) => ({ table: r.table, id: r.id }))
  const href = seed.href ?? null

  // Where they are this year, in the pipeline their type goes to: an End
  // User in Production (as a speaker), a Solution Provider in Sales.
  const type = seed.type ?? null
  const pipe = type === 'End User' ? { label: 'Production', rel: 'Speaker' as Relationship, kind: 'speaker' as const } : type === 'Solution Provider' ? { label: 'Sales', rel: 'Sponsor' as Relationship, kind: 'sponsor' as const } : null
  const justAdded = add.done.has(`speaker:${who.key}`) || add.done.has(`sponsor:${who.key}`)
  const inPipe = pipe ? all.find((r) => r.relationship === pipe.rel && add.inYear(r)) : undefined
  const inPipeHref = inPipe ? recHref(slug, inPipe) : null
  const edition = add.event ? shortEvent(add.event) : null

  // A link inside the panel takes the admin away: the panel closes with it.
  const onClickCapture = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a[href]')
    if (a && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && !(a as HTMLAnchorElement).target) onClose()
  }

  // The accent goes to one thing: the way into the pipeline while there is
  // one to take, else the full profile.
  const footPrimary = !pipe || !add.event || (!!inPipe && !justAdded)
  const hasDetails = !!(email || email2 || phone || linkedin || website || where)

  return (
    <div className="flex flex-col h-full min-h-0" onClickCapture={onClickCapture}>
      {/* Who, and where we are with them */}
      <div className="shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <Initials name={seed.name} size={44} className="!rounded-full mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold leading-tight truncate" style={{ color: 'var(--fg)' }}>{seed.name}</p>
            {jobTitle && <p className="text-[13px] mt-0.5 line-clamp-2" style={{ color: 'var(--fg-2)' }}>{jobTitle}</p>}
            {company && (
              <p className="text-[12.5px] mt-0.5 truncate" style={{ color: 'var(--fg-3)' }}>
                {coHref ? <Link href={coHref} className="hover:underline underline-offset-4">{company}</Link> : company}
                {type && <span style={{ color: 'var(--fg-4)' }}> · {type}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-0.5 -mr-2 -mt-1 shrink-0">
            {seed.onEdit && <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-9 !w-9 !px-0 max-sm:!h-10 max-sm:!w-10" onClick={() => { onClose(); seed.onEdit?.() }} aria-label="Edit contact" title="Edit contact"><Pencil className="w-4 h-4" /></button>}
            <button type="button" onClick={onClose} className="ws-btn ws-btn-ghost ws-btn-sm !h-9 !w-9 !px-0 max-sm:!h-10 max-sm:!w-10" aria-label="Close" title="Close (Esc)"><X className="w-[18px] h-[18px]" /></button>
          </div>
        </div>
        {(pipe || focusRows.length > 0 || email) && (
          <div className="px-5 pb-3.5 flex items-center gap-x-3 gap-y-2 flex-wrap">
            {pipe && add.event && (inPipe && !justAdded ? (
              <span className="inline-flex items-center gap-2 text-[13px] min-h-8 min-w-0" style={{ color: 'var(--fg-2)' }}>
                <span className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>In {pipe.label}</span>
                {inPipeHref
                  ? <Link href={inPipeHref} className="inline-flex items-center gap-1.5 font-semibold hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}><StageDot tone={stageTone(pipe.kind, inPipe.status)} /> {inPipe.status ? stageLabel(pipe.kind, inPipe.status) : 'Open'}</Link>
                  : <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: 'var(--fg)' }}><StageDot tone={stageTone(pipe.kind, inPipe.status)} /> {inPipe.status ? stageLabel(pipe.kind, inPipe.status) : 'Open'}</span>}
                {edition && <span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>{edition}</span>}
              </span>
            ) : (
              <PersonAdds add={add} who={who} company={company} type={type} primary />
            ))}
            {(focusRows.length > 0 || email) && <span className="ml-auto"><FocusToggle rows={focusRows} email={email} initial={seed.focus ?? []} auto={seed.focusAuto ?? []} size="xs" /></span>}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Their records, one line each with the stage's dot */}
        <section className="pt-4 pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
          {sectionHead('In the CRM', all.length > 0 ? <span className="tabular">{all.length}</span> : null)}
          {all.length === 0 ? (
            <p className="px-5 text-[12.5px]" style={{ color: 'var(--fg-4)' }}>{roles.isLoading ? 'Looking for their records…' : 'No record yet: a name from Lusha, not in the CRM.'}</p>
          ) : (
            <ul className="flex flex-col">
              {all.map((r, i) => {
                const to = recHref(slug, r)
                const kind = kindOfTable(r.table)
                const list = r.table === 'leads' ? (note ?? '').split(' · ')[0] || null : null
                const added = r.table === 'leads' && d.createdAt ? fmtDate(d.createdAt) : null
                const status = r.status ? (kind ? stageLabel(kind, r.status) : r.status) : null
                const body = (
                  <>
                    <StageDot tone={kind ? stageTone(kind, r.status) : 'transparent'} className={kind ? '' : '!border !border-[var(--line-3)]'} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-[13px] font-medium truncate" style={{ color: 'var(--fg)' }}>{r.event ? shortEvent(r.event) : 'No event'}</span>
                        {DOING[r.relationship] && <span className="text-[12px] shrink-0" style={{ color: 'var(--fg-3)' }}>{DOING[r.relationship]}</span>}
                      </span>
                      {(added || list) && <span className="block text-[11.5px] truncate" style={{ color: 'var(--fg-4)' }}>{[added ? `Added ${added}` : null, list].filter(Boolean).join(' · ')}</span>}
                    </span>
                    <span className="shrink-0 max-w-[130px] truncate text-[12px] text-right" style={{ color: status ? 'var(--fg-2)' : 'var(--fg-4)' }}>{status ?? '—'}</span>
                  </>
                )
                const cls = 'flex items-center gap-2.5 px-5 py-2 min-h-[40px]'
                return <li key={`${r.table}-${r.id}-${i}`}>{to ? <Link href={to} className={`${cls} crm-row`} title="Open the record">{body}</Link> : <span className={cls}>{body}</span>}</li>
              })}
            </ul>
          )}
        </section>

        {/* How to reach them: a tap copies */}
        <section className="pt-4 pb-2" style={{ borderBottom: '1px solid var(--line)' }}>
          {sectionHead('Contact')}
          {!hasDetails && !detail.isLoading ? (
            <p className="px-5 pb-2 text-[12.5px]" style={{ color: 'var(--fg-4)' }}>No email, phone or LinkedIn on file.</p>
          ) : (
            <div className="flex flex-col">
              {email && splitValues(email).map((v) => <DetailRow key={v} icon={Mail} label="email" value={v} />)}
              {email2 && splitValues(email2).map((v) => <DetailRow key={v} icon={Mail} label="other email" value={v} />)}
              {phone && splitValues(phone).map((v) => <DetailRow key={v} icon={Phone} label="phone" value={v} />)}
              {linkedin && <DetailRow icon={Linkedin} label="LinkedIn" value={linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} href={linkedin} />}
              {website && <DetailRow icon={Globe} label="website" value={website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} href={/^https?:\/\//i.test(website) ? website : `https://${website}`} hint={websiteFromLead ? 'From their lead record; no company website on file' : undefined} />}
              {where && <div className="flex items-center gap-3 px-5 min-h-[40px] text-[13px]" style={{ color: 'var(--fg-2)' }}><MapPin className="w-4 h-4 shrink-0" style={{ color: 'var(--fg-4)' }} /> {where}</div>}
              {detail.isLoading && !where && !linkedin && <p className="px-5 py-2 text-[12px]" style={{ color: 'var(--fg-4)' }}>Loading the rest…</p>}
            </div>
          )}
        </section>

        {/* Notes, shut after three lines */}
        {(note || notes) && (
          <section className="px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
            <h3 className="text-[11.5px] font-medium mb-1.5" style={{ color: 'var(--fg-4)' }}>Notes</h3>
            <Clamped text={[note, notes].filter(Boolean).join('\n\n')} />
          </section>
        )}

        {/* Their company, in one line */}
        {intel && facts.length > 0 && (
          <section className="px-5 py-4">
            <h3 className="text-[11.5px] font-medium mb-1.5" style={{ color: 'var(--fg-4)' }}>Company</h3>
            <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--fg-3)' }}>
              <span className="text-[13px] font-medium" style={{ color: 'var(--fg)' }}>{coHref ? <Link href={coHref} className="hover:underline underline-offset-4">{intel.name}</Link> : intel.name}</span>
              {intel.oneLiner && <span style={{ color: 'var(--fg-2)' }}> · {intel.oneLiner} <span className="text-[11.5px] whitespace-nowrap" style={{ color: 'var(--fg-4)' }} title="The one-line summary as the WNG Intelligence dataset holds it">from the WNG dataset</span></span>}
              <span className="block mt-0.5">{facts.join(' · ')}</span>
            </p>
            {coHref && <Link href={coHref} className="ws-btn ws-btn-sm ws-tap mt-3">Company profile <ArrowUpRight className="w-3.5 h-3.5" /></Link>}
          </section>
        )}
      </div>

      {/* Stepping through the list, and their full page */}
      <div className="flex items-center gap-2 px-4 pt-3 shrink-0" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        {total > 1 && (
          <>
            <button type="button" data-step="prev" className="ws-btn ws-btn-sm ws-tap !w-9 !px-0" disabled={index === 0} onClick={() => onStep(-1)} aria-label={prevName ? `Previous: ${prevName}` : 'Previous'} title={prevName ? `Previous: ${prevName}` : undefined}><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" data-step="next" className="ws-btn ws-btn-sm ws-tap !w-9 !px-0" disabled={index >= total - 1} onClick={() => onStep(1)} aria-label={nextName ? `Next: ${nextName}` : 'Next'} title={nextName ? `Next: ${nextName}` : undefined}><ChevronRight className="w-4 h-4" /></button>
            <span className="text-[12px] tabular" style={{ color: 'var(--fg-4)' }}>{index + 1} of {total}</span>
          </>
        )}
        <span className="flex-1" />
        {href
          ? <Link href={href} className={`ws-btn ws-btn-sm ws-tap ${footPrimary ? 'ws-btn-primary' : ''}`}>Open full profile <ArrowUpRight className="w-3.5 h-3.5" /></Link>
          : coHref && !(intel && facts.length > 0) ? <Link href={coHref} className="ws-btn ws-btn-sm ws-tap">Company profile <ArrowUpRight className="w-3.5 h-3.5" /></Link> : null}
      </div>
    </div>
  )
}

