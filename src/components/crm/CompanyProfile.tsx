'use client'

// A sponsor's or partner's page: the company, the events it is in as tabs
// (each event is its own record: the tab open is this one), this event's
// stage, its contacts, what the intelligence layer knows, and its activity.
// Shared by /sponsors/[id] and /partners/[id]; the pages keep the data and
// actions.
//
// Two columns on a desk (profileParts PROFILE_*): the main column is the
// header with the ten-second strip, the stage with the events it is in,
// the contacts, what they do, the hospitals named in announcements,
// enquiries and notes; the sidebar (sticky while it fits) is the deal, the
// activity, and the companies around them. On a phone it all stacks, the
// sidebar's cards after the contacts.

import { useRef } from 'react'
import { ArrowRightLeft, Download, Globe, Linkedin, Loader2, Mail, Pencil, Phone, Trash2, UserPlus, Users } from 'lucide-react'
import { downloadCsv } from '@/lib/csv'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { CopyPopover } from '@/components/crm/CopyPopover'
import { CardHead, EventTabs, Fact, MiniHeader, MoveOn, NextStep, PROFILE_GRID, PROFILE_MAIN, ProfileSide, ProfileNavBar, StageBar, WhereLine, eventParts, fmtDate, money, nextStage, shortEventName, useBoard } from '@/components/crm/profileParts'
import { KINDS } from '@/lib/recordKinds'
import { FocusToggle } from './FocusToggle'
import { focusOf, focusOfEvent, type Focus } from '@/lib/contactFocus'
import type { Sponsor, SponsorContact } from '@/types'
import { PersonRolesLine } from './PersonRoles'
import { EnquiryCard } from './EnquiryCard'
import { ContactLink, type ContactSeed } from './ContactLink'
import { IntelDeployments, IntelDescription, IntelSidebar, IntelStrip, NoIntel, useIntel } from '@/components/workspace/IntelPanel'
import { companyKey } from '@/lib/segments'
import { eventSlug } from '@/lib/portals'

type Kind = 'sponsor' | 'partner'
type Company = Sponsor & { activities: any[]; contacts: SponsorContact[] }

export interface ContactActions {
  onAdd: () => void
  onEdit: (c: SponsorContact) => void
  onMove: (c: SponsorContact, isPrimary: boolean) => void
  onDelete: (c: SponsorContact) => void
}

interface Props {
  kind: Kind
  company: Company
  nav: { prev: { id: string; companyName: string } | null; next: { id: string; companyName: string } | null; index: number; total: number }
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
  onStageChange: (status: string) => void
  stageSaving: boolean
  contacts: ContactActions
  refetch: () => void
}

export function CompanyProfile({ kind, company, nav, onEdit, onDelete, deleting, onStageChange, stageSaving, contacts, refetch }: Props) {
  const def = KINDS[kind]
  const primary: SponsorContact | null =
    company.contactFirstName || company.contactLastName || company.contactEmail
      ? {
          id: company.id, companyId: company.id,
          contactFirstName: company.contactFirstName, contactLastName: company.contactLastName,
          contactEmail: company.contactEmail, contactPhone: company.contactPhone,
          contactJobTitle: company.contactJobTitle, contactLinkedinUrl: company.contactLinkedinUrl,
          notes: null, tags: company.tags ?? null, createdAt: company.createdAt,
        }
      : null
  const people = [...(primary ? [{ c: primary, isPrimary: true }] : []), ...(company.contacts ?? []).map((c) => ({ c, isPrimary: false }))]
  const look = company.event ? eventParts(company.event).look : null
  const accent = look?.accent ?? 'var(--accent)'
  // The event's workspace, so the intelligence panel's links open company
  // pages inside it; this page itself sits outside the workspace.
  const wsSlug = company.event ? eventSlug(company.event.replace(/\b20\d{2}\b/, '').trim()) : null
  // What the intelligence layer knows about the company.
  const intelQ = useIntel(companyKey(company.companyName), company.companyName)
  const intel = intelQ.data?.company ?? null
  const website = company.website ?? intel?.website ?? null

  const board = useBoard(kind)
  const headRef = useRef<HTMLElement>(null)
  const next = nextStage(kind, company.status)
  const closed = KINDS[kind].stages.some((s) => s.negative && s.status === company.status)
  const edition = company.event ? eventParts(company.event) : null
  const exportContacts = () => downloadCsv(`${company.companyName} contacts`, ['Name', 'Job title', 'Email', 'Phone', 'LinkedIn', 'Primary', 'Event', 'Stage'],
    people.map(({ c, isPrimary }) => [[c.contactFirstName, c.contactLastName].filter(Boolean).join(' '), c.contactJobTitle, c.contactEmail, c.contactPhone, c.contactLinkedinUrl, isPrimary ? 'Yes' : '', company.event, company.status]))
  // The panel steps through the contacts in this order.
  const seeds = people.map(({ c }) => contactSeed(kind, company, c, contacts))

  return (
    <div className="crm-profile max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-24 sm:pb-8">
      {/* The trail back, and the next/previous company in the list */}
      <div className="mb-3">
        <ProfileNavBar
          kind={kind}
          name={company.companyName}
          nav={{
            prev: nav.prev && { id: nav.prev.id, name: nav.prev.companyName },
            next: nav.next && { id: nav.next.id, name: nav.next.companyName },
            index: nav.index, total: nav.total,
          }}
        />
      </div>
      <MiniHeader watch={headRef} name={company.companyName} action={next && !closed ? (
        <button type="button" className="ws-btn ws-btn-sm ws-btn-primary ws-tap" disabled={stageSaving} onClick={() => onStageChange(next.status)}>Move to {next.label.toLowerCase()}</button>
      ) : undefined} />

      <div className={PROFILE_GRID}>
        <div className={PROFILE_MAIN}>
          {/* Who they are, the ten-second strip, and where we are with them */}
          <header ref={headRef} className="ws-card overflow-hidden order-1">
            <div className="p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-3">
              {company.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt="" className="w-12 h-12 rounded-xl object-contain shrink-0" style={{ background: '#fff', border: '1px solid var(--line)' }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>{def.label}{company.tier ? ` · ${company.tier}` : ''}</p>
                <h1 className="text-[22px] font-semibold leading-tight tracking-tight sm:truncate" style={{ color: 'var(--fg)' }}>{company.companyName}</h1>
                <div className="flex items-center gap-x-3 gap-y-1 mt-1 flex-wrap text-[13px]" style={{ color: 'var(--fg-3)' }}>
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {people.length} {people.length === 1 ? 'contact' : 'contacts'}</span>
                  {/* The country lives in the strip once the intelligence layer has it. */}
                  {!intel?.hq && company.country && <span>{company.country}</span>}
                  {website && (
                    <a href={/^https?:\/\//i.test(website) ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline underline-offset-4">
                      <Globe className="w-3.5 h-3.5" /> {website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')}
                    </a>
                  )}
                </div>
              </div>
              {/* The secondary actions; the primary one is in the band below. */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:shrink-0">
                <button onClick={contacts.onAdd} className="ws-btn ws-btn-sm ws-tap"><UserPlus className="w-3.5 h-3.5" /> Add contact</button>
                <button onClick={onEdit} className="ws-btn ws-btn-sm ws-tap"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={exportContacts} disabled={!people.length} className="ws-btn ws-btn-sm ws-tap" title="The contacts as a spreadsheet (CSV)"><Download className="w-3.5 h-3.5" /> Export</button>
                <button onClick={onDelete} disabled={deleting} className="ws-btn ws-btn-sm ws-btn-ghost ws-tap max-sm:!w-9 max-sm:!px-0" title={`Delete this ${def.label.toLowerCase()}`} aria-label={`Delete this ${def.label.toLowerCase()}`} style={{ color: 'var(--bad)' }}>
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {intel ? <IntelStrip c={intel} /> : intelQ.isSuccess ? <NoIntel compact /> : null}
            <NextStep
              where={<WhereLine label={company.event ? `In ${board.label}` : 'In the directory, in no event yet'} kind={kind} status={company.status} extra={<>
                {/* A lead an agent found in Control Room says which one. */}
                {(company as { agentName?: string | null }).agentName && <span className="text-[12px]" style={{ color: 'var(--fg-3)' }} title="Added from Control Room">Found by {(company as { agentName?: string | null }).agentName}</span>}
                {/* No event: the company is on a side only, until it goes into an edition's pipeline. */}
                {!company.event && focusOf(company.tags).length > 0 && <span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{focusOf(company.tags).join(' and ')} side</span>}
                {edition && <span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{shortEventName(company.event ?? '')}</span>}
                {closed && company.updatedAt && <span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>since {fmtDate(company.updatedAt)}</span>}
                {stageSaving && <span className="text-[12px] inline-flex items-center gap-1.5" style={{ color: 'var(--fg-4)' }}><Loader2 className="w-3 h-3 animate-spin" /> Saving</span>}
              </>} />}
              action={<MoveOn kind={kind} status={company.status} onChange={onStageChange} saving={stageSaving} boardHref={board.href} boardLabel={board.label} />}
              events={<EventTabs kind={kind} id={company.id} current={company.event ?? null} addNote="Each event gets its own record of the company, starting at Not contacted, with the contacts copied." />}
            />
          </header>

          {/* Every stage of this event, to jump to any of them */}
          <section className="ws-card overflow-hidden order-2">
            <CardHead title="Stage" count={edition ? `${edition.title} · ${edition.look.series}` : 'No event'} />
            <div className="px-4 sm:px-5 pb-4">
              <StageBar kind={kind} status={company.status} accent={accent} disabled={stageSaving} onChange={onStageChange} at={company.updatedAt} />
            </div>
          </section>

          {/* Contacts: the primary first. A name opens the contact panel. */}
          <section className="ws-card overflow-hidden order-3">
            <CardHead title="Contacts" count={people.length || ''} action={<button onClick={contacts.onAdd} className="ws-btn ws-btn-ghost ws-btn-sm ws-tap" style={{ color: 'var(--fg-3)' }}><UserPlus className="w-3.5 h-3.5" /> Add</button>} />
            {people.length === 0 ? (
              <p className="px-4 sm:px-5 pb-4 text-[13px]" style={{ color: 'var(--fg-4)' }}>No contacts yet.</p>
            ) : (
              <ul>
                {people.map(({ c, isPrimary }, i) => (
                  <ContactRow key={`${c.id}-${isPrimary}`} kind={kind} companyName={company.companyName} event={company.event} c={c} isPrimary={isPrimary} actions={contacts} seed={seeds[i]} list={seeds} />
                ))}
              </ul>
            )}
          </section>

          {/* What the intelligence layer knows: what they do, the hospitals named in announcements */}
          {intel && <IntelDescription c={intel} className="order-5" />}
          {intel && <IntelDeployments c={intel} slug={wsSlug} className="order-6" />}

          <div className="contents [&>section]:order-7"><EnquiryCard kind={kind} id={company.id} /></div>

          {company.notes && (
            <section className="ws-card overflow-hidden order-8">
              <CardHead title="Notes" />
              <p className="px-4 sm:px-5 pb-4 text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--fg-2)' }}>{company.notes}</p>
            </section>
          )}
        </div>

        <ProfileSide>
          {/* The deal */}
          <section className="ws-card ws-card-quiet overflow-hidden order-4">
            <CardHead side title="Deal" />
            <dl className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <Fact label={kind === 'partner' ? 'Type' : 'Tier'} value={company.tier || '—'} />
              <Fact label="Value" value={money(company.valueAmount, company.valueCurrency) ?? '—'} strong={!!company.valueAmount} />
              <Fact label="Added" value={fmtDate(company.createdAt)} />
              <Fact label="Updated" value={fmtDate(company.updatedAt)} />
            </dl>
            {company.packageDetails && (
              <div className="mx-4 mb-4 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
                <p className="text-[11.5px] font-medium mb-1" style={{ color: 'var(--fg-4)' }}>Package</p>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--fg-2)' }}>{company.packageDetails}</p>
              </div>
            )}
            {company.status !== 'Confirmed' && !company.valueAmount && (
              <p className="px-4 pb-4 -mt-1 text-[12px]" style={{ color: 'var(--fg-4)' }}>Tier, value and package are recorded once the stage is Confirmed.</p>
            )}
          </section>

          <section className="ws-card ws-card-quiet overflow-hidden order-4">
            <CardHead side title="Activity" count={company.activities?.length || ''} />
            <div className="px-4 pb-4">
              <ActivityFeed activities={company.activities ?? []} entityType={kind} entityId={company.id} onActivityAdded={refetch} />
            </div>
          </section>

          {/* The companies around them */}
          {intel && <IntelSidebar c={intel} slug={wsSlug} className="order-4" />}
        </ProfileSide>
      </div>
    </div>
  )
}

// What the contact panel is opened with for one of the company's contacts.
function contactSeed(kind: Kind, company: Company, c: SponsorContact, actions: ContactActions): ContactSeed {
  const name = [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ') || c.contactEmail || 'Unnamed'
  const table = kind === 'partner' ? 'partners' : 'sponsors'
  const auto = [focusOfEvent(company.event)].filter((f): f is Focus => !!f)
  return {
    key: c.contactEmail ?? `${name}|${company.companyName ?? ''}`, name, email: c.contactEmail, phone: c.contactPhone, jobTitle: c.contactJobTitle, linkedinUrl: c.contactLinkedinUrl,
    company: company.companyName, type: 'Solution Provider',
    records: [{ relationship: 'Sponsor', table, id: c.companyId, status: company.status ?? null, event: company.event }],
    focusRows: [{ table, id: c.id }], focus: focusOf(c.tags), focusAuto: auto, note: c.notes,
    onEdit: () => actions.onEdit(c), href: null,
  }
}

function ContactRow({ kind, companyName, event, c, isPrimary, actions, seed, list }: { kind: Kind; companyName: string | null; event?: string | null; c: SponsorContact; isPrimary: boolean; actions: ContactActions; seed: ContactSeed; list: ContactSeed[] }) {
  const name = [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ') || c.contactEmail || 'Unnamed'
  const table = kind === 'partner' ? 'partners' : 'sponsors'
  const auto = [focusOfEvent(event)].filter((f): f is Focus => !!f)
  const focus = focusOf(c.tags)
  const focusWord = focus.length ? focus.join(' · ') : auto.join(' · ')
  return (
    <li className="group crm-row grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 sm:px-5 py-2.5" style={{ borderTop: '1px solid var(--line)' }}>
      <div className="min-w-0">
        <ContactLink
          href={null}
          seed={seed}
          list={list}
          className="flex items-center gap-3 min-w-0 w-full text-left"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[13.5px] font-medium truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{name}</span>
              {isPrimary && <span className="shrink-0 px-1.5 py-px rounded-md text-[11.5px]" style={{ border: '1px solid var(--line)', color: 'var(--fg-4)' }} title="The company's primary contact">Primary</span>}
            </span>
            <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[c.contactJobTitle, c.contactEmail].filter(Boolean).join(' · ') || '\u00a0'}</span>
          </span>
        </ContactLink>
        {/* Where else this person is: their speaker or delegate record. */}
        <div className="pl-11">
          <PersonRolesLine
            self={{ kind, id: c.id }}
            person={{ email: c.contactEmail, firstName: c.contactFirstName, lastName: c.contactLastName, organization: companyName }}
          />
        </div>
      </div>
      {/* Which side of the business they are for (one word; the toggle on
          hover), and the actions, right-aligned and shown on hover. */}
      <div className="flex items-center justify-end gap-2 min-w-[112px] min-h-8">
        <span className="text-[11.5px] group-hover:hidden group-focus-within:hidden" style={{ color: 'var(--fg-4)' }}>{focusWord}</span>
        <span className="hidden group-hover:inline-flex group-focus-within:inline-flex items-center gap-1">
          <FocusToggle rows={[{ table, id: c.id }]} email={c.contactEmail} initial={focus} auto={auto} size="xs" />
          {/* A pop-up to copy from, not a mailto:/tel: link. */}
          {c.contactEmail && <CopyPopover label={`${name}'s email`} value={c.contactEmail} title={`Email: ${c.contactEmail}`}><Mail className="w-3.5 h-3.5" /></CopyPopover>}
          {c.contactPhone && <CopyPopover label={`${name}'s phone`} value={c.contactPhone} title={`Phone: ${c.contactPhone}`}><Phone className="w-3.5 h-3.5" /></CopyPopover>}
          {c.contactLinkedinUrl && <a href={c.contactLinkedinUrl} target="_blank" rel="noopener noreferrer" className="ws-btn ws-btn-ghost ws-btn-sm" title="LinkedIn" aria-label={`${name} on LinkedIn`}><Linkedin className="w-3.5 h-3.5" /></a>}
          <button type="button" onClick={() => actions.onEdit(c)} className="ws-btn ws-btn-ghost ws-btn-sm" title="Edit contact" aria-label="Edit contact"><Pencil className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => actions.onMove(c, isPrimary)} className="ws-btn ws-btn-ghost ws-btn-sm" title="Move to another company" aria-label="Move to another company"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
          {!isPrimary && <button type="button" onClick={() => actions.onDelete(c)} className="ws-btn ws-btn-ghost ws-btn-sm" title="Remove contact" aria-label="Remove contact" style={{ color: 'var(--bad)' }}><Trash2 className="w-3.5 h-3.5" /></button>}
        </span>
      </div>
    </li>
  )
}
