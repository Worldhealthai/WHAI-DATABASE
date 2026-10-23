'use client'

// A sponsor's or partner's page: the company, the events it is in as tabs
// (each event is its own record: the tab open is this one), this event's
// stage and deal, its contacts, and its activity. Shared by
// /sponsors/[id] and /partners/[id]; the pages keep the data and actions.

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRightLeft, Check, ChevronLeft, ChevronRight, Globe, Linkedin, Loader2, Mail, Pencil,
  Phone, Plus, Trash2, UserPlus, X,
} from 'lucide-react'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { EventPicker } from '@/components/crm/EventPicker'
import { KINDS } from '@/lib/recordKinds'
import { eventLook } from '@/lib/portals'
import { useUpcomingEventOptions } from '@/lib/useEventOptions'
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

// "Leonard Warren" → "LW"; a one-word name gives its first two letters ("IQ").
const initials = (name: string) => {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words.slice(0, 2).map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 2)).toUpperCase() || '?'
}
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const money = (amount: unknown, currency?: string | null) => {
  const n = Number(amount)
  if (!amount || !Number.isFinite(n)) return null
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 0 }).format(n) } catch { return `${currency || 'GBP'} ${n.toLocaleString()}` }
}
// "World Health AI London 2027" → its colours, "London 2027" and the series.
function eventParts(label: string) {
  const year = label.match(/\b(20\d{2})\b/)?.[1] ?? ''
  const look = eventLook(label.replace(year, '').trim())
  return { look, title: [look.city !== '—' ? look.city : '', year].filter(Boolean).join(' ') || label }
}

export function CompanyProfile({ kind, company, nav, onEdit, onDelete, deleting, onStageChange, stageSaving, contacts, refetch }: Props) {
  const def = KINDS[kind]
  const list = kind === 'sponsor' ? '/sponsors' : '/partners'
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
      <nav className="flex items-center justify-between gap-2">
        <Link href={list} className="ws-btn ws-btn-ghost ws-btn-sm -ml-2">
          <ArrowLeft className="w-3.5 h-3.5" /> {def.plural}
          {nav.index >= 0 && <span className="tabular" style={{ color: 'var(--fg-4)' }}>· {nav.index + 1} of {nav.total}</span>}
        </Link>
        <div className="flex items-center gap-1">
          <Link href={nav.prev ? `${list}/${nav.prev.id}` : '#'} aria-disabled={!nav.prev} title={nav.prev?.companyName} className="ws-btn ws-btn-sm" style={nav.prev ? undefined : { opacity: 0.4, pointerEvents: 'none' }}>
            <ChevronLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline max-w-[140px] truncate">{nav.prev?.companyName ?? 'Previous'}</span>
          </Link>
          <Link href={nav.next ? `${list}/${nav.next.id}` : '#'} aria-disabled={!nav.next} title={nav.next?.companyName} className="ws-btn ws-btn-sm" style={nav.next ? undefined : { opacity: 0.4, pointerEvents: 'none' }}>
            <span className="hidden sm:inline max-w-[140px] truncate">{nav.next?.companyName ?? 'Next'}</span> <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

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
        <EventTabs kind={kind} id={company.id} current={company.event ?? null} />
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

function Fact({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium mb-1" style={{ color: 'var(--fg-4)' }}>{label}</dt>
      <dd className="text-[13.5px] truncate" style={{ color: 'var(--fg)', fontWeight: strong ? 600 : 500 }}>{value}</dd>
    </div>
  )
}

// The stages as one bar: done ones filled, the current one marked, a click
// moves the record there. Rejected sits apart.
function StageBar({ kind, status, accent, disabled, onChange }: { kind: Kind; status: string; accent: string; disabled: boolean; onChange: (s: string) => void }) {
  const stages = KINDS[kind].stages.filter((s) => !s.negative)
  const negative = KINDS[kind].stages.filter((s) => s.negative)
  const idx = stages.findIndex((s) => s.status === status)
  const rejected = negative.some((s) => s.status === status)
  return (
    <div className="flex items-stretch gap-2 flex-wrap sm:flex-nowrap">
      <div className="flex-1 grid gap-1.5 min-w-[240px]" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => {
          const done = !rejected && idx > i
          const current = !rejected && idx === i
          return (
            <button
              key={s.status}
              type="button"
              disabled={disabled}
              onClick={() => onChange(s.status)}
              className="group flex flex-col gap-1.5 text-left disabled:cursor-wait"
              title={`Move to ${s.label}`}
            >
              <span className="h-1.5 rounded-full transition-colors" style={{ background: done || current ? accent : 'var(--surface-3)', opacity: done ? 0.55 : 1 }} />
              <span className="flex items-start gap-1 text-[12px] leading-tight transition-colors min-w-0" style={{ color: current ? 'var(--fg)' : done ? 'var(--fg-2)' : 'var(--fg-4)', fontWeight: current ? 600 : 500 }}>
                {done && <Check className="w-3 h-3 shrink-0 mt-px" style={{ color: accent }} />}
                <span className="group-hover:underline underline-offset-4 min-w-0">{s.label}</span>
              </span>
            </button>
          )
        })}
      </div>
      {negative.map((s) => (
        <button
          key={s.status}
          type="button"
          disabled={disabled}
          onClick={() => onChange(rejected ? stages[0].status : s.status)}
          className="ws-btn ws-btn-sm self-center"
          style={rejected ? { color: 'var(--bad)', borderColor: 'var(--bad)' } : { color: 'var(--fg-3)' }}
          title={rejected ? 'Rejected: click to reopen' : `Mark as ${s.label.toLowerCase()}`}
        >
          {rejected ? <><X className="w-3.5 h-3.5" /> {s.label}</> : s.label}
        </button>
      ))}
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
        {c.contactEmail && <a href={`mailto:${c.contactEmail.split(/\s+or\s+|[,;]\s*/)[0]}`} className="ws-btn ws-btn-ghost ws-btn-sm" title={c.contactEmail} aria-label={`Email ${name}`}><Mail className="w-3.5 h-3.5" /></a>}
        {c.contactPhone && <a href={`tel:${c.contactPhone}`} className="ws-btn ws-btn-ghost ws-btn-sm" title={c.contactPhone} aria-label={`Call ${name}`}><Phone className="w-3.5 h-3.5" /></a>}
        {c.contactLinkedinUrl && <a href={c.contactLinkedinUrl} target="_blank" rel="noopener noreferrer" className="ws-btn ws-btn-ghost ws-btn-sm" title="LinkedIn" aria-label={`${name} on LinkedIn`}><Linkedin className="w-3.5 h-3.5" /></a>}
        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button type="button" onClick={() => actions.onMove(c, isPrimary)} className="ws-btn ws-btn-ghost ws-btn-sm" title="Move to another company" aria-label="Move to another company"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
          {!isPrimary && <button type="button" onClick={() => actions.onDelete(c)} className="ws-btn ws-btn-ghost ws-btn-sm" title="Remove contact" aria-label="Remove contact" style={{ color: 'var(--bad)' }}><Trash2 className="w-3.5 h-3.5" /></button>}
        </span>
      </div>
    </li>
  )
}

// The events the company is in, as tabs (the open one is this record), and
// adding it to more.
function EventTabs({ kind, id, current }: { kind: Kind; id: string; current: string | null }) {
  const api = kind === 'sponsor' ? '/api/sponsors' : '/api/partners'
  const list = kind === 'sponsor' ? '/sponsors' : '/partners'
  const queryClient = useQueryClient()
  const upcoming = useUpcomingEventOptions()
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const { data, refetch } = useQuery<{ editions: { id: string; event: string | null; status: string | null }[] }>({
    queryKey: ['company-events', kind, id],
    queryFn: async () => {
      const r = await fetch(`${api}/${id}/editions`)
      if (!r.ok) throw new Error('editions')
      return r.json()
    },
  })
  const editions = (data?.editions ?? []).filter((e) => e.event)
  const inEvents = new Set(editions.map((e) => String(e.event).toLowerCase()))
  const options = upcoming.filter((ev) => !inEvents.has(ev.toLowerCase()))

  const save = async () => {
    if (!picked.length) return
    setSaving(true)
    try {
      await fetch(`${api}/${id}/editions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: picked }) })
      setPicked([]); setAdding(false)
      await refetch()
      for (const key of ['ws-list', 'ws-board', 'ws-stats']) queryClient.invalidateQueries({ queryKey: [key] })
    } finally { setSaving(false) }
  }

  return (
    <div style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
      <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
        <span className="text-[11.5px] font-medium mr-1 shrink-0" style={{ color: 'var(--fg-4)' }}>Events</span>
        {editions.map((e) => {
          const { look, title } = eventParts(String(e.event))
          const active = !!current && String(e.event).toLowerCase() === current.toLowerCase() && e.id === id
          const body = (
            <>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: look.accent }} />
              <span className="font-semibold" style={{ color: 'var(--fg)' }}>{title}</span>
              <span style={{ color: 'var(--fg-4)' }}>{look.short}</span>
              {e.status && <span className="pl-1.5 ml-0.5" style={{ color: 'var(--fg-3)', borderLeft: '1px solid var(--line-2)' }}>{e.status}</span>}
            </>
          )
          const cls = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] whitespace-nowrap shrink-0 transition-colors'
          return active ? (
            <span key={e.id} className={cls} aria-current="page" style={{ background: look.accentSoft, border: `1px solid ${look.accentLine}` }}>{body}</span>
          ) : (
            <Link key={e.id} href={`${list}/${e.id}`} className={`${cls} hover:bg-[var(--surface-3)]`} style={{ border: '1px solid var(--line)', background: 'var(--surface)' }} title={`Open ${e.event}`}>{body}</Link>
          )
        })}
        {options.length > 0 && (
          <button type="button" onClick={() => setAdding((a) => !a)} className="ws-btn ws-btn-sm ws-btn-ghost shrink-0" aria-expanded={adding}>
            <Plus className="w-3.5 h-3.5" /> Add to event
          </button>
        )}
      </div>
      {adding && (
        <div className="px-5 pb-4">
          <p className="text-[12px] mb-2" style={{ color: 'var(--fg-3)' }}>Each event gets its own record of the company, starting at Not contacted, with the contacts copied.</p>
          <EventPicker options={options} selected={picked} onToggle={(ev) => setPicked((p) => (p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev]))} />
          <div className="flex items-center gap-2 mt-3">
            <button type="button" onClick={save} disabled={!picked.length || saving} className="ws-btn ws-btn-sm ws-btn-primary">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {picked.length ? `Add to ${picked.length} ${picked.length === 1 ? 'event' : 'events'}` : 'Pick events'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setPicked([]) }} className="ws-btn ws-btn-sm ws-btn-ghost">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
