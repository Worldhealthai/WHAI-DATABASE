'use client'

// A speaker's or delegate's page, laid out like a company's: the person,
// the events they are in as tabs (each event is its own record: the tab
// open is this one), this event's stage and details, who they are, and the
// activity. Shared by /speakers/[id] and /delegates/[id]; the pages keep
// the data and actions.

import { Building2, Linkedin, Loader2, Mail, MapPin, Mic, Pencil, Phone, Trash2 } from 'lucide-react'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { CopyPopover } from '@/components/crm/CopyPopover'
import { EventTabs, Fact, ProfileNavBar, StageBar, eventParts, fmtDate, initials, money, type ProfileNav } from '@/components/crm/profileParts'
import { KINDS } from '@/lib/recordKinds'
import { partnerConsentLabel, type Delegate, type Speaker } from '@/types'
import { MoveRecordButton } from './MoveRecordButton'
import { PersonRolesCard } from './PersonRoles'

type Props = {
  nav: ProfileNav
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
  onStageChange: (status: string) => void
  stageSaving: boolean
  refetch: () => void
} & ({ kind: 'speaker'; person: Speaker & { activities?: any[] } } | { kind: 'delegate'; person: Delegate & { activities?: any[] } })

const yesNo = (v: boolean | null | undefined) => partnerConsentLabel(v) || '—'

export function PersonProfile(props: Props) {
  const { kind, person, nav, onEdit, onDelete, deleting, onStageChange, stageSaving, refetch } = props
  const def = KINDS[kind]
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || 'Unnamed'
  const look = person.event ? eventParts(person.event).look : null
  const accent = look?.accent ?? 'var(--accent)'
  const where = [person.city, person.country].filter(Boolean).join(', ')
  const headshot = kind === 'speaker' ? props.person.headshotUrl : null
  const firstStage = def.stages[0].label

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <ProfileNavBar kind={kind} nav={nav} />

      {/* The person, and the events they are in */}
      <header className="ws-card overflow-hidden">
        <div className="p-5 flex items-start gap-4">
          {headshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headshot} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" style={{ border: '1px solid var(--line)' }} />
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)', border: '1px solid var(--line)' }}>
              {initials(name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>{def.label}</p>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight truncate" style={{ color: 'var(--fg)' }}>{name}</h1>
            {(person.jobTitle || person.organization) && (
              <p className="text-[13.5px] mt-0.5 truncate" style={{ color: 'var(--fg-2)' }}>
                {person.jobTitle}
                {person.jobTitle && person.organization && <span style={{ color: 'var(--fg-4)' }}> · </span>}
                {person.organization}
              </p>
            )}
            <div className="flex items-center gap-1 mt-2 flex-wrap -ml-2">
              {/* A pop-up to copy from, not a mailto:/tel: link. */}
              {person.email && <CopyPopover label={`${name}'s email`} value={person.email} title={`Email: ${person.email}`}><Mail className="w-3.5 h-3.5" /> <span className="max-w-[220px] truncate">{person.email}</span></CopyPopover>}
              {person.phone && <CopyPopover label={`${name}'s phone`} value={person.phone} title={`Phone: ${person.phone}`}><Phone className="w-3.5 h-3.5" /> {person.phone}</CopyPopover>}
              {person.linkedinUrl && <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="ws-btn ws-btn-ghost ws-btn-sm"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</a>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onEdit} className="ws-btn ws-btn-sm"><Pencil className="w-3.5 h-3.5" /> Edit</button>
            <MoveRecordButton kind={kind} id={person.id} name={name || 'this person'} />
            <button onClick={onDelete} disabled={deleting} className="ws-btn ws-btn-sm ws-btn-ghost" title={`Delete this ${def.label.toLowerCase()}`} aria-label="Delete" style={{ color: 'var(--bad)' }}>
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <EventTabs
          kind={kind}
          id={person.id}
          current={person.event ?? null}
          addNote={`Each event gets its own record of ${person.firstName || 'them'}, starting at ${firstStage}, with their details copied.`}
        />
      </header>

      {/* This event's stage and details */}
      <section className="ws-card p-5">
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>
            {person.event ? <>In {eventParts(person.event).title} <span className="font-normal" style={{ color: 'var(--fg-3)' }}>· {look?.series}</span></> : 'No event'}
          </h2>
          {stageSaving && <span className="text-[12px] inline-flex items-center gap-1.5" style={{ color: 'var(--fg-4)' }}><Loader2 className="w-3 h-3 animate-spin" /> Saving</span>}
        </div>
        <StageBar kind={kind} status={person.status} accent={accent} disabled={stageSaving} onChange={onStageChange} />

        {props.kind === 'speaker' && props.person.sessionTitle && (
          <p className="flex items-start gap-2 mt-5 text-[14px] font-medium" style={{ color: 'var(--fg)' }}>
            <Mic className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} /> {props.person.sessionTitle}
          </p>
        )}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 mt-5 pt-5" style={{ borderTop: '1px solid var(--line)' }}>
          {props.kind === 'speaker' ? (
            <>
              <Fact label="Session type" value={props.person.sessionType || '—'} />
              <Fact label="Speaker type" value={props.person.subType || '—'} />
              <Fact label="Contract" value={props.person.contractStatus || 'Not started'} />
              <Fact label="Fee" value={money(props.person.fee, props.person.feeCurrency) ?? (props.person.feeStatus || 'Not set')} />
              <Fact label="Travel" value={props.person.travelRequired ? 'Required' : 'No'} />
              <Fact label="Hotel" value={props.person.hotelRequired ? 'Required' : 'No'} />
              <Fact label="Shares with sponsors" value={yesNo(props.person.partnerConsent)} />
              <Fact label="Added" value={fmtDate(person.createdAt)} />
            </>
          ) : (
            <>
              <Fact label="Company type" value={props.person.subType || '—'} />
              <Fact label="Pass" value={props.person.ticketType || '—'} />
              <Fact label="Source" value={props.person.source || '—'} />
              <Fact label="Shares with sponsors" value={yesNo(props.person.partnerConsent)} />
              <Fact label="Dietary" value={props.person.dietaryRequirements || '—'} />
              <Fact label="Accessibility" value={props.person.accessibilityNeeds || '—'} />
              <Fact label="Added" value={fmtDate(person.createdAt)} />
              <Fact label="Updated" value={fmtDate(person.updatedAt)} />
            </>
          )}
        </dl>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <section className="ws-card p-5">
            <h2 className="text-[15px] font-semibold mb-3" style={{ color: 'var(--fg)' }}>About</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <Row icon={Building2} label="Organisation" value={person.organization} />
              <Row icon={MapPin} label="Location" value={where} />
            </dl>
            {props.kind === 'speaker' && props.person.sessionDescription && <Text title="Session description" body={props.person.sessionDescription} />}
            {person.bio && <Text title="Bio" body={person.bio} />}
            {props.kind === 'speaker' && props.person.expertiseAreas && (
              <div className="mt-4">
                <p className="text-[11.5px] font-medium mb-1.5" style={{ color: 'var(--fg-4)' }}>Expertise</p>
                <div className="flex flex-wrap gap-1.5">
                  {props.person.expertiseAreas.split(',').map((e) => e.trim()).filter(Boolean).map((e) => (
                    <span key={e} className="ws-chip">{e}</span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {person.notes && (
            <section className="ws-card p-5">
              <h2 className="text-[15px] font-semibold mb-2" style={{ color: 'var(--fg)' }}>Notes</h2>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--fg-2)' }}>{person.notes}</p>
            </section>
          )}
        </div>

        <div className="space-y-4 self-start">
          <PersonRolesCard
            self={{ kind, id: person.id }}
            person={{ email: person.email, firstName: person.firstName, lastName: person.lastName, organization: person.organization }}
          />
          <section className="ws-card p-5">
          <h2 className="text-[15px] font-semibold mb-3" style={{ color: 'var(--fg)' }}>Activity</h2>
          <ActivityFeed activities={person.activities ?? []} entityType={kind} entityId={person.id} onActivityAdded={refetch} />
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--fg-4)' }} />
      <div className="min-w-0">
        <dt className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>{label}</dt>
        <dd className="text-[13.5px] truncate" style={{ color: value ? 'var(--fg)' : 'var(--fg-4)' }}>{value || '—'}</dd>
      </div>
    </div>
  )
}

function Text({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
      <p className="text-[11.5px] font-medium mb-1" style={{ color: 'var(--fg-4)' }}>{title}</p>
      <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--fg-2)' }}>{body}</p>
    </div>
  )
}
