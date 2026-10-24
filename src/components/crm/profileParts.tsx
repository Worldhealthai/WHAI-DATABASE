'use client'

// The pieces a record's page is built from, shared by the company pages
// (CompanyProfile) and the people pages (PersonProfile): the stage bar, a
// fact, the events the record is in as tabs, and the page's back/next nav.

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react'
import { EventPicker } from '@/components/crm/EventPicker'
import { KINDS, type RecordKind } from '@/lib/recordKinds'
import { eventLook } from '@/lib/portals'
import { useUpcomingEventOptions } from '@/lib/useEventOptions'

// "Leonard Warren" → "LW"; a one-word name gives its first two letters ("IQ").
export const initials = (name: string) => {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words.slice(0, 2).map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 2)).toUpperCase() || '?'
}
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const money = (amount: unknown, currency?: string | null) => {
  const n = Number(amount)
  if (!amount || !Number.isFinite(n)) return null
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 0 }).format(n) } catch { return `${currency || 'GBP'} ${n.toLocaleString()}` }
}
// "World Health AI London 2027" → its colours, "London 2027" and the series.
export function eventParts(label: string) {
  const year = label.match(/\b(20\d{2})\b/)?.[1] ?? ''
  const look = eventLook(label.replace(year, '').trim())
  return { look, title: [look.city !== '—' ? look.city : '', year].filter(Boolean).join(' ') || label }
}

export interface NavItem { id: string; name: string }
export interface ProfileNav { prev: NavItem | null; next: NavItem | null; index: number; total: number }

// Back to the list, and the previous/next record in it.
export function ProfileNavBar({ kind, nav }: { kind: RecordKind; nav: ProfileNav }) {
  const def = KINDS[kind]
  const list = def.detailPath
  return (
    <nav className="flex items-center justify-between gap-2">
      <Link href={list} className="ws-btn ws-btn-ghost ws-btn-sm -ml-2">
        <ArrowLeft className="w-3.5 h-3.5" /> {def.plural}
        {nav.index >= 0 && <span className="tabular" style={{ color: 'var(--fg-4)' }}>· {nav.index + 1} of {nav.total}</span>}
      </Link>
      <div className="flex items-center gap-1">
        <Link href={nav.prev ? `${list}/${nav.prev.id}` : '#'} aria-disabled={!nav.prev} title={nav.prev?.name} className="ws-btn ws-btn-sm" style={nav.prev ? undefined : { opacity: 0.4, pointerEvents: 'none' }}>
          <ChevronLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline max-w-[140px] truncate">{nav.prev?.name ?? 'Previous'}</span>
        </Link>
        <Link href={nav.next ? `${list}/${nav.next.id}` : '#'} aria-disabled={!nav.next} title={nav.next?.name} className="ws-btn ws-btn-sm" style={nav.next ? undefined : { opacity: 0.4, pointerEvents: 'none' }}>
          <span className="hidden sm:inline max-w-[140px] truncate">{nav.next?.name ?? 'Next'}</span> <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </nav>
  )
}

export function Fact({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium mb-1" style={{ color: 'var(--fg-4)' }}>{label}</dt>
      <dd className="text-[13.5px] truncate" style={{ color: 'var(--fg)', fontWeight: strong ? 600 : 500 }}>{value}</dd>
    </div>
  )
}

// The stages as one bar: done ones filled, the current one marked, a click
// moves the record there. The negative ones (Rejected, Cancelled…) sit
// apart; clicking the one it is at reopens it.
export function StageBar({ kind, status, accent, disabled, onChange }: { kind: RecordKind; status: string; accent: string; disabled: boolean; onChange: (s: string) => void }) {
  const stages = KINDS[kind].stages.filter((s) => !s.negative)
  const negative = KINDS[kind].stages.filter((s) => s.negative)
  const idx = stages.findIndex((s) => s.status === status)
  const closed = negative.some((s) => s.status === status)
  return (
    <div className="flex items-stretch gap-2 flex-wrap sm:flex-nowrap">
      <div className="flex-1 grid gap-1.5 min-w-[240px]" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => {
          const done = !closed && idx > i
          const current = !closed && idx === i
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
      <div className="flex items-center gap-1.5 self-center">
        {negative.map((s) => {
          const at = s.status === status
          return (
            <button
              key={s.status}
              type="button"
              disabled={disabled}
              onClick={() => onChange(at ? stages[0].status : s.status)}
              className="ws-btn ws-btn-sm"
              style={at ? { color: 'var(--bad)', borderColor: 'var(--bad)' } : { color: 'var(--fg-3)' }}
              title={at ? `${s.label}: click to reopen` : `Mark as ${s.label.toLowerCase()}`}
            >
              {at ? <><X className="w-3.5 h-3.5" /> {s.label}</> : s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// The events the record's company or person is in, as tabs (the open one
// is this record), and adding them to more. `addNote` says what adding does.
export function EventTabs({ kind, id, current, addNote }: { kind: RecordKind; id: string; current: string | null; addNote: string }) {
  const { api, detailPath: list } = KINDS[kind]
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
  const label = (s: string | null) => (s ? KINDS[kind].statusLabel(s) : '')

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
              {e.status && <span className="pl-1.5 ml-0.5" style={{ color: 'var(--fg-3)', borderLeft: '1px solid var(--line-2)' }}>{label(e.status)}</span>}
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
          <p className="text-[12px] mb-2" style={{ color: 'var(--fg-3)' }}>{addNote}</p>
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
