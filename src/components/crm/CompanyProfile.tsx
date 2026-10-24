'use client'

// A sponsor's or partner's page: the company, the events it is in as tabs
// (each event is its own record: the tab open is this one), this event's
// stage and deal, its contacts, and its activity. Shared by
// /sponsors/[id] and /partners/[id]; the pages keep the data and actions.

import { ArrowRightLeft, Globe, Linkedin, Loader2, Mail, Pencil, Phone, Trash2, UserPlus } from 'lucide-react'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { CopyPopover } from '@/components/crm/CopyPopover'
import { EventTabs, Fact, ProfileNavBar, StageBar, eventParts, fmtDate, initials, money } from '@/components/crm/profileParts'
import { KINDS } from '@/lib/recordKinds'
import type { Sponsor, SponsorContact } from '@/types'

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
          notes: null, createdAt: company.createdAt,
        }
      : null
  const people = [...(primary ? [{ c: primary, isPrimary: true }] : []), ...(company.contacts ?? []).map((c) => ({ c, isPrimary: false }))]
  const look = company.event ? eventParts(company.event).look : null
  const accent = look?.accent ?? 'var(--accent)'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Back, and the next/previous company in the list */}
      <ProfileNavBar
        kind={kind}
        nav={{
          prev: nav.prev && { id: nav.prev.id, name: nav.prev.companyName },
          next: nav.next && { id: nav.next.id, name: nav.next.companyName },
          index: nav.index, total: nav.total,
        }}
      />

      {/* The company, and the events it is in */}
      <header className="ws-card overflow-hidden">
        <div className="p-5 flex items-start gap-4">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" className="w-14 h-14 rounded-xl object-contain shrink-0" style={{ background: '#fff', border: '1px solid var(--line)' }} />
          ) : (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-semibold shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)', border: '1px solid var(--line)' }}>
              {initials(company.companyName)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>{def.label}</p>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight truncate" style={{ color: 'var(--fg)' }}>{company.companyName}</h1>
            <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 flex-wrap text-[12.5px]" style={{ color: 'var(--fg-3)' }}>
              {company.website && (
                <a href={/^https?:\/\//i.test(company.website) ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline underline-offset-4">
                  <Globe className="w-3.5 h-3.5" /> {company.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')}
                </a>
              )}
              <span>{people.length} {people.length === 1 ? 'contact' : 'contacts'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onEdit} className="ws-btn ws-btn-sm"><Pencil className="w-3.5 h-3.5" /> Edit</button>
            <button onClick={onDelete} disabled={deleting} className="ws-btn ws-btn-sm ws-btn-ghost" title={`Delete this ${def.label.toLowerCase()}`} aria-label="Delete" style={{ color: 'var(--bad)' }}>
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <EventTabs kind={kind} id={company.id} current={company.event ?? null} addNote="Each event gets its own record of the company, starting at Not contacted, with the contacts copied." />
      </header>

      {/* This event's stage and deal */}
      <section className="ws-card p-5">
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>
            {company.event ? <>In {eventParts(company.event).title} <span className="font-normal" style={{ color: 'var(--fg-3)' }}>· {look?.series}</span></> : 'No event'}
          </h2>
          {stageSaving && <span className="text-[12px] inline-flex items-center gap-1.5" style={{ color: 'var(--fg-4)' }}><Loader2 className="w-3 h-3 animate-spin" /> Saving</span>}
        </div>
        <StageBar kind={kind} status={company.status} accent={accent} disabled={stageSaving} onChange={onStageChange} />

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 mt-5 pt-5" style={{ borderTop: '1px solid var(--line)' }}>
          <Fact label={kind === 'partner' ? 'Type' : 'Tier'} value={company.tier || '—'} />
          <Fact label="Value" value={money(company.valueAmount, company.valueCurrency) ?? '—'} strong={!!company.valueAmount} />
          <Fact label="Added" value={fmtDate(company.createdAt)} />
          <Fact label="Updated" value={fmtDate(company.updatedAt)} />
        </dl>
        {company.packageDetails && (
          <div className="mt-4">
            <dt className="text-[11.5px] font-medium mb-1" style={{ color: 'var(--fg-4)' }}>Package</dt>
            <dd className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--fg-2)' }}>{company.packageDetails}</dd>
          </div>
        )}
        {company.status !== 'Confirmed' && !company.valueAmount && (
          <p className="text-[12px] mt-4" style={{ color: 'var(--fg-4)' }}>Tier, value and package are recorded once the stage is Confirmed.</p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Contacts: the primary first */}
          <section className="ws-card">
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>Contacts <span className="font-normal tabular" style={{ color: 'var(--fg-4)' }}>{people.length || ''}</span></h2>
              <button onClick={contacts.onAdd} className="ws-btn ws-btn-sm"><UserPlus className="w-3.5 h-3.5" /> Add contact</button>
            </div>
            {people.length === 0 ? (
              <p className="px-5 pb-5 text-[13px]" style={{ color: 'var(--fg-4)' }}>No contacts yet.</p>
            ) : (
              <ul>
                {people.map(({ c, isPrimary }) => (
                  <ContactRow key={`${c.id}-${isPrimary}`} c={c} isPrimary={isPrimary} actions={contacts} />
                ))}
              </ul>
            )}
          </section>

          {company.notes && (
            <section className="ws-card p-5">
              <h2 className="text-[15px] font-semibold mb-2" style={{ color: 'var(--fg)' }}>Notes</h2>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--fg-2)' }}>{company.notes}</p>
            </section>
          )}
        </div>

        <section className="ws-card p-5 self-start">
          <h2 className="text-[15px] font-semibold mb-3" style={{ color: 'var(--fg)' }}>Activity</h2>
          <ActivityFeed activities={company.activities ?? []} entityType={kind} entityId={company.id} onActivityAdded={refetch} />
        </section>
      </div>
    </div>
  )
}

function ContactRow({ c, isPrimary, actions }: { c: SponsorContact; isPrimary: boolean; actions: ContactActions }) {
  const name = [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ') || c.contactEmail || 'Unnamed'
  return (
    <li className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-2)]" style={{ borderTop: '1px solid var(--line)' }}>
      <button type="button" onClick={() => actions.onEdit(c)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <span className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0" style={{ background: 'var(--surface-3)', color: 'var(--fg-2)' }}>{initials(name)}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{name}</span>
            {isPrimary && <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-3)' }}>Primary</span>}
          </span>
          {c.contactJobTitle && <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{c.contactJobTitle}</span>}
        </span>
      </button>
      <div className="flex items-center gap-0.5 shrink-0">
        {/* A pop-up to copy from, not a mailto:/tel: link. */}
        {c.contactEmail && <CopyPopover label={`${name}'s email`} value={c.contactEmail} title={`Email: ${c.contactEmail}`}><Mail className="w-3.5 h-3.5" /></CopyPopover>}
        {c.contactPhone && <CopyPopover label={`${name}'s phone`} value={c.contactPhone} title={`Phone: ${c.contactPhone}`}><Phone className="w-3.5 h-3.5" /></CopyPopover>}
        {c.contactLinkedinUrl && <a href={c.contactLinkedinUrl} target="_blank" rel="noopener noreferrer" className="ws-btn ws-btn-ghost ws-btn-sm" title="LinkedIn" aria-label={`${name} on LinkedIn`}><Linkedin className="w-3.5 h-3.5" /></a>}
        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button type="button" onClick={() => actions.onMove(c, isPrimary)} className="ws-btn ws-btn-ghost ws-btn-sm" title="Move to another company" aria-label="Move to another company"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
          {!isPrimary && <button type="button" onClick={() => actions.onDelete(c)} className="ws-btn ws-btn-ghost ws-btn-sm" title="Remove contact" aria-label="Remove contact" style={{ color: 'var(--bad)' }}><Trash2 className="w-3.5 h-3.5" /></button>}
        </span>
      </div>
    </li>
  )
}

