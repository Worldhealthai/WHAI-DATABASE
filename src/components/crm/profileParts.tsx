'use client'

// The pieces a record's page is built from, shared by the company pages
// (CompanyProfile) and the people pages (PersonProfile): the stage bar, a
// fact, the events the record is in as tabs, and the page's back/next nav.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
// The stages as a journey: a dashed route curving through a stop per stage,
// the stretch behind drawn solid, and a marker that glides along it to the
// current stage (and from there to the next one picked). Each stop moves the
// record there; Rejected and the like sit apart at the end, as buttons.
const ROUTE_H = 64
const PAD = 18

function routeOf(width: number, n: number) {
  const pts = Array.from({ length: n }, (_, i) => ({
    x: n === 1 ? width / 2 : PAD + (i * (width - 2 * PAD)) / (n - 1),
    // A gentle swell: alternate stops sit a little higher.
    y: ROUTE_H / 2 + (i % 2 === 0 ? 9 : -9),
  }))
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const mx = (a.x + b.x) / 2
    d += ` C ${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`
  }
  return { pts, d }
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function StageBar({ kind, status, accent, disabled, onChange }: { kind: RecordKind; status: string; accent: string; disabled: boolean; onChange: (s: string) => void }) {
  const stages = KINDS[kind].stages.filter((s) => !s.negative)
  const negative = KINDS[kind].stages.filter((s) => s.negative)
  const idx = stages.findIndex((s) => s.status === status)
  const closed = negative.some((s) => s.status === status)
  const target = closed ? 0 : Math.max(0, idx)

  const boxRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [width, setWidth] = useState(0)
  const [lengths, setLengths] = useState<number[] | null>(null)
  // The marker: how far along the route, and where that is and which way it faces.
  const [boat, setBoat] = useState<{ len: number; x: number; y: number; angle: number } | null>(null)
  const posRef = useRef(0)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const route = width > 0 ? routeOf(width, stages.length) : null

  // Where each stop falls along the route, measured once it is drawn.
  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path || !route) return
    const total = path.getTotalLength()
    const out: number[] = []
    let L = 0
    for (const p of route.pts) {
      // Walk forward to the point nearest this stop.
      while (L < total && path.getPointAtLength(L).x < p.x - 0.5) L += 2
      out.push(Math.min(L, total))
    }
    out[0] = 0
    out[out.length - 1] = total
    setLengths(out)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.d])

  // Glide to the stage (straight there when motion is reduced).
  useEffect(() => {
    const path = pathRef.current
    if (!lengths || !path) return
    const total = path.getTotalLength()
    const place = (len: number) => {
      const a = path.getPointAtLength(len)
      const b = path.getPointAtLength(Math.min(len + 1, total))
      const c = len + 1 > total ? path.getPointAtLength(Math.max(0, len - 1)) : a
      const angle = len + 1 > total ? Math.atan2(a.y - c.y, a.x - c.x) : Math.atan2(b.y - a.y, b.x - a.x)
      posRef.current = len
      setBoat({ len, x: a.x, y: a.y, angle: (angle * 180) / Math.PI })
    }
    const to = lengths[target] ?? 0
    const from = Math.min(posRef.current, total)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || Math.abs(from - to) < 0.5) { place(to); return }
    let raf = 0
    const t0 = performance.now()
    const dur = Math.min(1400, 500 + Math.abs(to - from) * 1.6)
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur)
      place(from + (to - from) * ease(t))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [lengths, target])

  const pos = boat?.len ?? 0
  const ink = closed ? 'var(--fg-4)' : accent

  return (
    <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
      <div ref={boxRef} className="crm-journey flex-1 min-w-[260px]">
        <svg height={ROUTE_H} aria-hidden="true">
          {route && (
            <>
              <path ref={pathRef} d={route.d} className="route-ahead" strokeWidth={2} />
              <path d={route.d} className="route-done" strokeWidth={2.5} strokeDasharray={`${pos} 100000`} style={closed ? { stroke: 'var(--fg-4)' } : undefined} />
              {route.pts.map((p, i) => {
                const passed = !closed && i <= idx
                return <circle key={i} cx={p.x} cy={p.y} r={i === target && !closed ? 0 : 4.5} fill={passed ? ink : 'var(--surface)'} stroke={passed ? ink : 'var(--line-3)'} strokeWidth={1.5} />
              })}
              {boat && (
                <g transform={`translate(${boat.x} ${boat.y})`}>
                  <circle r={13} fill={closed ? 'var(--fg-4)' : 'var(--deep)'} opacity={0.14} />
                  <g transform={`rotate(${boat.angle})`}>
                    <circle r={9} fill={closed ? 'var(--fg-4)' : 'var(--deep)'} />
                    <path d="M -3 -3.5 L 3 0 L -3 3.5" fill="none" stroke="var(--on-deep)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </g>
              )}
            </>
          )}
        </svg>
        {/* The stops: each a button to move the record there. */}
        <div className="relative h-9">
          {route?.pts.map((p, i) => {
            const s = stages[i]
            const current = !closed && i === idx
            const done = !closed && i < idx
            // The end labels line up with the route's ends; the rest centre on their stop.
            const place: React.CSSProperties = i === 0 ? { left: 0 } : i === stages.length - 1 ? { right: 0 } : { left: p.x, transform: 'translateX(-50%)' }
            return (
              <button
                key={s.status}
                type="button"
                disabled={disabled}
                onClick={() => onChange(s.status)}
                className="stop group absolute top-0 flex items-center gap-1 text-[12px] leading-tight whitespace-nowrap disabled:cursor-wait"
                style={{ ...place, color: current ? 'var(--fg)' : done ? 'var(--fg-2)' : 'var(--fg-4)', fontWeight: current ? 600 : 500 }}
                title={`Move to ${s.label}`}
              >
                {done && <Check className="w-3 h-3 shrink-0" style={{ color: accent }} />}
                <span className="group-hover:underline underline-offset-4">{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-1.5 self-center">
        {negative.map((s) => {
          const here = s.status === status
          return (
            <button
              key={s.status}
              type="button"
              disabled={disabled}
              onClick={() => onChange(here ? stages[0].status : s.status)}
              className="ws-btn ws-btn-sm"
              style={here ? { color: 'var(--bad)', borderColor: 'var(--bad)' } : { color: 'var(--fg-3)' }}
              title={here ? `${s.label}: click to reopen` : `Mark as ${s.label.toLowerCase()}`}
            >
              {here ? <><X className="w-3.5 h-3.5" /> {s.label}</> : s.label}
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
