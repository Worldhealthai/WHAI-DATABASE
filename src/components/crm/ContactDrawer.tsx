'use client'

// The contact panel (November 2026): a click on a person's name in any list
// (a company's team, Contacts, a sponsor's contacts, the people Lusha names)
// slides their details in from the right, before anyone leaves the page:
// who they are, how to reach them, which side of the business they are for,
// every record they have in the CRM with its stage and event, their note,
// their company in one line, and the way on into a pipeline. "Open full
// profile" goes to their page as before.
//
// What the list already holds shows at once; the rest (location, LinkedIn,
// website, a second email) is fetched from their record while the panel is
// open. Mounted once, in the app's frame, through ContactDrawerProvider;
// any list opens it with ContactLink.

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Globe, Linkedin, Mail, MapPin, Pencil, Phone, X } from 'lucide-react'
import type { PersonRole } from '@/app/api/people/roles/route'
import { Initials } from '@/components/workspace/ui'
import { PersonAdds, companyHref, recHref, usePipelineAdd } from '@/components/workspace/Segments'
import { useIntel } from '@/components/workspace/IntelPanel'
import { useWorkspaceFromUrl } from '@/lib/workspace'
import { companyKey, type Member, type Relationship } from '@/lib/segments'
import { isProvider } from '@/lib/intel'
import { CopyPopover } from './CopyPopover'
import { FocusToggle } from './FocusToggle'
import { ContactDrawerContext, type ContactRecord, type ContactSeed } from './ContactLink'
import { fmtDate } from './profileParts'

const shortEvent = (e: string | null | undefined) => (e || '').replace(/^World Health AI/i, 'WHAI').replace(/^World Pharma AI/i, 'WPAI')
const DOING: Record<Relationship, string> = { Speaker: 'Speaking', Delegate: 'Attending', Sponsor: 'Company contact', Lead: 'Lead' }
const ROLE_REL: Record<PersonRole['kind'], Relationship> = { speaker: 'Speaker', delegate: 'Delegate', sponsor: 'Sponsor', partner: 'Sponsor' }
const num = (n: number) => n.toLocaleString('en-GB')

export function ContactDrawerProvider({ children }: { children: React.ReactNode }) {
  const [seed, setSeed] = useState<ContactSeed | null>(null)
  const openContact = useCallback((s: ContactSeed) => setSeed(s), [])
  const close = useCallback(() => setSeed(null), [])
  const api = useMemo(() => ({ openContact, close }), [openContact, close])
  return (
    <ContactDrawerContext.Provider value={api}>
      {children}
      {seed && <Drawer key={`${seed.key ?? seed.name}|${seed.company ?? ''}`} seed={seed} onClose={close} />}
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

function Drawer({ seed, onClose }: { seed: ContactSeed; onClose: () => void }) {
  const ws = useWorkspaceFromUrl()
  const slug = ws.slug
  const panel = useRef<HTMLDivElement>(null)
  const add = usePipelineAdd()
  const records = seed.records ?? []
  const detail = useDetail(records)
  const roles = useOtherRoles(seed)
  const d = detail.data ?? {}

  // Focus moves into the panel; Escape closes it; focus goes back after.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      before?.focus?.()
    }
  }, [onClose])

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

  // A link inside the panel takes the admin away: the panel closes with it.
  const onClickCapture = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a[href]')
    if (a && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && !(a as HTMLAnchorElement).target) onClose()
  }

  const label = (t: string) => <dt className="text-[11.5px] font-medium pt-[5px]" style={{ color: 'var(--fg-4)' }}>{t}</dt>

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div className="absolute inset-0 anim-fade-in" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onMouseDown={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${seed.name}: contact details`}
        onClickCapture={onClickCapture}
        className="absolute inset-y-0 right-0 w-full sm:w-[440px] flex flex-col outline-none anim-slide-in-right"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--line-2)', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Who */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
          <Initials name={seed.name} size={44} className="!rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold leading-tight truncate" style={{ color: 'var(--fg)' }}>{seed.name}</p>
            {jobTitle && <p className="text-[13px] mt-0.5" style={{ color: 'var(--fg-2)' }}>{jobTitle}</p>}
            {company && (
              <p className="text-[12.5px] mt-0.5 truncate" style={{ color: 'var(--fg-3)' }}>
                {coHref ? <Link href={coHref} className="hover:underline underline-offset-4">{company}</Link> : company}
                {seed.type && <span style={{ color: 'var(--fg-4)' }}> · {seed.type}</span>}
              </p>
            )}
            {(focusRows.length > 0 || email) && (
              <div className="mt-2"><FocusToggle rows={focusRows} email={email} initial={seed.focus ?? []} auto={seed.focusAuto ?? []} size="xs" /></div>
            )}
          </div>
          <button type="button" onClick={onClose} className="ws-btn ws-btn-ghost ws-btn-sm -mr-2 -mt-1 max-sm:!h-10 max-sm:!w-10 max-sm:!px-0 max-sm:justify-center" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* How to reach them */}
          <section className="px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
            {!email && !phone && !linkedin && !where && !website && !detail.isLoading ? (
              <p className="text-[12.5px]" style={{ color: 'var(--fg-4)' }}>No email, phone or LinkedIn on file.</p>
            ) : (
              <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1 items-start">
                {email && <>{label('Email')}<dd className="min-w-0 -ml-2"><CopyPopover align="left" label={`${seed.name}'s email`} value={email} title={`Email: ${email}`}><Mail className="w-3.5 h-3.5" /> <span className="max-w-[300px] truncate text-[13px]">{email}</span></CopyPopover></dd></>}
                {email2 && <>{label('Also')}<dd className="min-w-0 -ml-2"><CopyPopover align="left" label={`${seed.name}'s other email`} value={email2} title={`Email: ${email2}`}><Mail className="w-3.5 h-3.5" /> <span className="max-w-[300px] truncate text-[13px]">{email2}</span></CopyPopover></dd></>}
                {phone && <>{label('Phone')}<dd className="min-w-0 -ml-2"><CopyPopover align="left" label={`${seed.name}'s phone`} value={phone} title={`Phone: ${phone}`}><Phone className="w-3.5 h-3.5" /> <span className="text-[13px]">{phone}</span></CopyPopover></dd></>}
                {linkedin && <>{label('LinkedIn')}<dd className="min-w-0 -ml-2"><a href={linkedin} target="_blank" rel="noopener noreferrer" className="ws-btn ws-btn-ghost ws-btn-sm"><Linkedin className="w-3.5 h-3.5" /> <span className="max-w-[300px] truncate text-[13px]">{linkedin.replace(/^https?:\/\/(www\.)?/, '')}</span></a></dd></>}
                {website && <>{label('Website')}<dd className="min-w-0 -ml-2 flex items-center gap-1.5 flex-wrap"><a href={/^https?:\/\//i.test(website) ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="ws-btn ws-btn-ghost ws-btn-sm"><Globe className="w-3.5 h-3.5" /> <span className="max-w-[300px] truncate text-[13px]">{website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span></a>{websiteFromLead && <span className="text-[11.5px]" style={{ color: 'var(--fg-4)' }} title="No company website on file; this is what their lead record carries">from their lead record</span>}</dd></>}
                {where && <>{label('Location')}<dd className="text-[13px] pt-[5px] inline-flex items-center gap-1.5" style={{ color: 'var(--fg-2)' }}><MapPin className="w-3.5 h-3.5" style={{ color: 'var(--fg-4)' }} /> {where}</dd></>}
                {detail.isLoading && !where && !linkedin && <><dt /><dd className="text-[12px] pt-[5px]" style={{ color: 'var(--fg-4)' }}>Loading the rest…</dd></>}
              </dl>
            )}
          </section>

          {/* In the CRM */}
          <section className="px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
            <h3 className="text-[11.5px] font-medium mb-2" style={{ color: 'var(--fg-4)' }}>In the CRM</h3>
            {all.length === 0 ? (
              <p className="text-[12.5px]" style={{ color: 'var(--fg-4)' }}>{roles.isLoading ? 'Looking for their records…' : 'No record yet: a name from Lusha, not in the CRM.'}</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {/* The same template for every record: what · event · stage;
                    for a lead, when it was added and from which list. */}
                {all.map((r, i) => {
                  const to = recHref(slug, r)
                  const list = r.table === 'leads' ? (note ?? '').split(' · ')[0] || null : null
                  const added = r.table === 'leads' && d.createdAt ? fmtDate(d.createdAt) : null
                  const body = (
                    <>
                      <span className="w-[124px] max-sm:w-auto shrink-0"><span className="text-[12px] font-medium px-2 h-6 inline-flex items-center rounded-md max-w-full truncate" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)' }}>{DOING[r.relationship]}</span></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] truncate" style={{ color: 'var(--fg)' }}>{r.event ? shortEvent(r.event) : 'No event'}</span>
                        {(added || list) && <span className="block text-[11.5px]" style={{ color: 'var(--fg-4)' }}>{[added ? `added ${added}` : null, list].filter(Boolean).join(' · ')}</span>}
                      </span>
                      <span className="w-[120px] max-sm:w-auto max-sm:max-w-[120px] shrink-0 text-right text-[12px] truncate" style={{ color: r.status ? 'var(--fg-3)' : 'var(--fg-4)' }}>{r.status ?? '—'}</span>
                    </>
                  )
                  const cls = 'flex items-center gap-2 px-3 py-1.5 -mx-3 rounded-lg'
                  return <li key={`${r.table}-${r.id}-${i}`}>{to ? <Link href={to} className={`${cls} transition-colors [@media(hover:hover)]:hover:bg-[var(--surface-2)]`} title="Open the record">{body}</Link> : <span className={cls}>{body}</span>}</li>
                })}
              </ul>
            )}
            {add.event && (seed.type || company) && (
              <div className="mt-2 -ml-2 flex items-center gap-2 flex-wrap">
                <PersonAdds add={add} who={who} company={company} type={seed.type ?? null} />
              </div>
            )}
          </section>

          {/* Notes */}
          {(note || notes) && (
            <section className="px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
              <h3 className="text-[11.5px] font-medium mb-1.5" style={{ color: 'var(--fg-4)' }}>Notes</h3>
              {note && <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fg-2)' }}>{note}</p>}
              {notes && <p className="text-[13px] leading-relaxed mt-1.5 whitespace-pre-wrap" style={{ color: 'var(--fg-2)' }}>{notes}</p>}
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
            </section>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-3.5 shrink-0" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          {seed.onEdit && <button type="button" className="ws-btn ws-btn-sm" onClick={() => { onClose(); seed.onEdit?.() }}><Pencil className="w-3.5 h-3.5" /> Edit contact</button>}
          {coHref && <Link href={coHref} className="ws-btn ws-btn-sm">Company profile <ArrowUpRight className="w-3.5 h-3.5" /></Link>}
          <span className="flex-1" />
          {href && <Link href={href} className="ws-btn ws-btn-sm ws-btn-primary">Open full profile <ArrowUpRight className="w-3.5 h-3.5" /></Link>}
        </div>
      </div>
    </div>
  )
}
