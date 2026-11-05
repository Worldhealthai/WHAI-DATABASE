'use client'

// The pieces a record's page is built from, shared by the company pages
// (CompanyProfile) and the people pages (PersonProfile): the stage bar, a
// fact, the events the record is in as tabs, and the page's back/next nav.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus, Undo2, X } from 'lucide-react'
import { EventPicker } from '@/components/crm/EventPicker'
import { KINDS, type RecordKind } from '@/lib/recordKinds'
import { eventLook } from '@/lib/portals'
import { useWorkspaceFromUrl } from '@/lib/workspace'
import { useRouter } from 'next/navigation'
import { stepsBack } from '@/components/layout/NavMemory'
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

// A profile in two columns on a desk: the main column, and a sticky sidebar
// of about 336px (under the 112px top bar). On a phone both are `contents`,
// so every card stacks in one column by its order-* class; the sidebar's
// cards come after the team (order-5 on a company's page).
export const PROFILE_GRID = 'flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start'
export const PROFILE_MAIN = 'contents lg:flex lg:flex-col lg:gap-4 lg:min-w-0'
const PROFILE_SIDE = 'contents lg:flex lg:flex-col lg:gap-4'
const SIDE_TOP = 128

// The sidebar: sticky only while it fits under the top bar, so nothing in
// it is ever out of reach; taller than the window, it scrolls with the page.
export function ProfileSide({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const [fits, setFits] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setFits(el.offsetHeight <= window.innerHeight - SIDE_TOP - 16)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('resize', check)
    return () => { ro.disconnect(); window.removeEventListener('resize', check) }
  }, [])
  return <aside ref={ref} className={`${PROFILE_SIDE} ${fits ? 'lg:sticky' : ''}`} style={fits ? { top: SIDE_TOP } : undefined}>{children}</aside>
}

export interface NavItem { id: string; name: string }
export interface ProfileNav { prev: NavItem | null; next: NavItem | null; index: number; total: number }

// ── Where the page sits: the trail back ──────────────────────────────────────

// Back goes to the page the profile was opened from, exactly as it was
// (NavMemory), past any profiles stepped through with Previous/Next; else to
// the link's own place.
export function useBack() {
  const router = useRouter()
  return (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const n = stepsBack()
    if (n > 0) { e.preventDefault(); if (n === 1) router.back(); else window.history.go(-n) }
  }
}

export interface Crumb { label: string; href?: string }

// "← Companies › Aidoc": the first crumb is the way back (with its arrow),
// the last is this page. On a phone the middle ones give way first.
export function Crumbs({ items, current, after }: { items: Crumb[]; current: string; after?: React.ReactNode }) {
  const back = useBack()
  return (
    <ol className="flex items-center gap-1 min-w-0 text-[13px]" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <li key={`${c.label}-${i}`} className={`flex items-center gap-1 min-w-0 ${i > 0 ? 'max-sm:hidden' : 'shrink-0'}`}>
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--fg-4)' }} aria-hidden />}
          {c.href ? (
            <Link href={c.href} onClick={i === 0 ? back : undefined} className={`ws-btn ws-btn-ghost ws-btn-sm ws-tap ${i === 0 ? '-ml-2' : '!px-1.5'}`} style={{ color: 'var(--fg-2)' }}>
              {i === 0 && <ArrowLeft className="w-3.5 h-3.5" />} {c.label}
            </Link>
          ) : <span className="px-1.5" style={{ color: 'var(--fg-3)' }}>{c.label}</span>}
        </li>
      ))}
      <li className="flex items-center gap-1 min-w-0" aria-current="page">
        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--fg-4)' }} aria-hidden />
        <span className="px-1.5 font-medium truncate" style={{ color: 'var(--fg)' }}>{current}</span>
        {after}
      </li>
    </ol>
  )
}

// The trail, and the previous/next record in the list the profile came from.
// Without a workspace the trail goes to where the records are worked: the
// event's board for this kind (Sales, Production…), in the event and year
// last open.
const BOARD: Record<RecordKind, { section: string; label: string }> = {
  sponsor: { section: 'pipeline', label: 'Sales' },
  partner: { section: 'partners', label: 'Partners' },
  speaker: { section: 'production', label: 'Production' },
  delegate: { section: 'registrations', label: 'Registrations' },
}
export function useBoard(kind: RecordKind) {
  const ws = useWorkspaceFromUrl()
  const b = BOARD[kind]
  return { ...b, href: ws.portal && ws.slug ? ws.href(b.section) : KINDS[kind].detailPath }
}

export function ProfileNavBar({ kind, nav, name }: { kind: RecordKind; nav: ProfileNav; name: string }) {
  const def = KINDS[kind]
  const list = def.detailPath
  const board = useBoard(kind)
  const step = (item: NavItem | null, dir: 'prev' | 'next') => (
    <Link
      href={item ? `${list}/${item.id}` : '#'}
      aria-disabled={!item}
      aria-label={dir === 'prev' ? `Previous: ${item?.name ?? 'none'}` : `Next: ${item?.name ?? 'none'}`}
      title={item?.name}
      className="ws-btn ws-btn-sm ws-tap"
      style={item ? undefined : { opacity: 0.4, pointerEvents: 'none' }}
    >
      {dir === 'prev' && <ChevronLeft className="w-3.5 h-3.5" />}
      <span className="hidden md:inline max-w-[140px] truncate">{item?.name ?? (dir === 'prev' ? 'Previous' : 'Next')}</span>
      {dir === 'next' && <ChevronRight className="w-3.5 h-3.5" />}
    </Link>
  )
  return (
    <nav className="flex items-center justify-between gap-2 min-h-10">
      <Crumbs
        items={[{ label: board.label, href: board.href }]}
        current={name}
        after={nav.index >= 0 ? <span className="tabular shrink-0 text-[12px] max-sm:hidden" style={{ color: 'var(--fg-4)' }}>{nav.index + 1} of {nav.total}</span> : null}
      />
      <div className="flex items-center gap-1 shrink-0">{step(nav.prev, 'prev')}{step(nav.next, 'next')}</div>
    </nav>
  )
}

// ── Cards ────────────────────────────────────────────────────────────────────

// Every card's head, the same everywhere: the title on the left with its
// count in grey, an optional small line under it, one quiet action on the
// right. `collapse` makes the title a toggle on a phone (the body hides
// with `max-lg:hidden` while shut); on a desk the card is always open.
export function CardHead({ title, count, sub, action, note, side = false, collapse }: {
  title: React.ReactNode; count?: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; note?: string; side?: boolean
  collapse?: { open: boolean; toggle: () => void; id: string }
}) {
  const heading = (
    <span className="flex flex-wrap items-baseline gap-x-1.5 min-w-0">
      <span className={`${side ? 'text-[13.5px]' : 'text-[14px]'} font-semibold`} style={{ color: 'var(--fg)' }} title={note}>{title}</span>
      {count != null && count !== '' && <span className={`${side ? 'text-[12.5px]' : 'text-[13px]'} tabular`} style={{ color: 'var(--fg-4)' }}>{count}</span>}
    </span>
  )
  return (
    <div className={`${side ? 'px-4 pt-3.5' : 'px-4 sm:px-5 pt-4'} pb-2.5 flex items-start justify-between gap-3`}>
      <div className="min-w-0 flex-1">
        {collapse ? (
          <>
            <button type="button" onClick={collapse.toggle} aria-expanded={collapse.open} aria-controls={collapse.id} className="lg:hidden flex items-center gap-1.5 min-h-10 -my-2 w-full text-left">
              {heading}
              <ChevronDown className={`w-4 h-4 ml-auto shrink-0 transition-transform ${collapse.open ? 'rotate-180' : ''}`} style={{ color: 'var(--fg-4)' }} />
            </button>
            <h2 className="max-lg:hidden">{heading}</h2>
          </>
        ) : <h2>{heading}</h2>}
        {sub && <p className={`text-[11.5px] mt-0.5 ${collapse && !collapse.open ? 'max-lg:hidden' : ''}`} style={{ color: 'var(--fg-4)' }}>{sub}</p>}
      </div>
      {action && <div className={`shrink-0 flex items-center gap-1 -my-1 ${collapse && !collapse.open ? 'max-lg:hidden' : ''}`}>{action}</div>}
    </div>
  )
}

// Shut on a phone until tapped; a desk always shows the body.
export function useCollapse(id: string, startOpen = false) {
  const [open, setOpen] = useState(startOpen)
  return { open, toggle: () => setOpen((o) => !o), id, bodyClass: open ? '' : 'max-lg:hidden' }
}

// ── The way on: where we are with them, and what to do next ───────────────────

// A stage's colour: grey before anything has happened, the accent while it
// is in play, green once won, red once lost.
export function stageTone(kind: RecordKind | null, status: string | null | undefined): string {
  if (!kind || !status) return 'var(--line-3)'
  const st = KINDS[kind].stages
  const s = st.find((x) => x.status === status)
  if (!s) return 'var(--fg-4)'
  if (s.negative) return 'var(--bad)'
  const pos = st.filter((x) => !x.negative)
  const i = pos.indexOf(s)
  if (i === pos.length - 1) return 'var(--ok)'
  return i === 0 ? 'var(--line-3)' : 'var(--accent)'
}
export const kindOfTable = (t: string): RecordKind | null => (t === 'sponsors' ? 'sponsor' : t === 'speakers' ? 'speaker' : t === 'delegates' ? 'delegate' : t === 'partners' ? 'partner' : null)
export function StageDot({ tone, className = '' }: { tone: string; className?: string }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${className}`} style={{ background: tone }} aria-hidden />
}
// The stage after this one, or null at the end (or once closed).
export function nextStage(kind: RecordKind, status: string) {
  const pos = KINDS[kind].stages.filter((s) => !s.negative)
  const i = pos.findIndex((s) => s.status === status)
  return i >= 0 && i < pos.length - 1 ? pos[i + 1] : null
}
export const stageLabel = (kind: RecordKind, status: string) => KINDS[kind].stages.find((s) => s.status === status)?.label ?? KINDS[kind].statusLabel(status)

// The band at the foot of a profile's header: where we are (a line with its
// stage dot), the one primary action for that state, and under it the
// events they are in, in one line. On a phone the action takes the width.
export function NextStep({ where, action, events }: { where: React.ReactNode; action?: React.ReactNode; events?: React.ReactNode }) {
  return (
    <div className="px-4 sm:px-5 py-3 flex flex-col gap-2.5" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1 text-[13px]" style={{ color: 'var(--fg-2)' }}>{where}</div>
        {action && <div className="flex items-center gap-2 flex-wrap max-sm:[&>*]:flex-1 sm:shrink-0">{action}</div>}
      </div>
      {events}
    </div>
  )
}

// Moving a record on one stage from the band, with the stage it left kept
// for an Undo until the page moves again.
export function MoveOn({ kind, status, onChange, saving, boardHref, boardLabel }: { kind: RecordKind; status: string; onChange: (s: string) => void; saving: boolean; boardHref: string; boardLabel: string }) {
  const [from, setFrom] = useState<string | null>(null)
  const next = nextStage(kind, status)
  const closed = KINDS[kind].stages.some((s) => s.negative && s.status === status)
  return (
    <>
      {from && from !== status && (
        <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm ws-tap" disabled={saving} onClick={() => { onChange(from); setFrom(null) }} title={`Back to ${stageLabel(kind, from)}`}>
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
      )}
      <Link href={boardHref} className="ws-btn ws-btn-sm ws-tap">{boardLabel} board</Link>
      {next && !closed && (
        <button type="button" className="ws-btn ws-btn-sm ws-btn-primary ws-tap" disabled={saving} onClick={() => { setFrom(status); onChange(next.status) }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />} Move to {next.label.toLowerCase()}
        </button>
      )}
    </>
  )
}

// "In Sales · ● In discussion": the pipeline and the stage, for the band.
export function WhereLine({ label, kind, status, extra }: { label: string; kind: RecordKind | null; status?: string | null; extra?: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 min-w-0 flex-wrap">
      <span className="text-[11.5px] font-medium shrink-0" style={{ color: 'var(--fg-4)' }}>{label}</span>
      {status && kind ? (
        <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: 'var(--fg)' }}><StageDot tone={stageTone(kind, status)} /> {stageLabel(kind, status)}</span>
      ) : null}
      {extra}
    </span>
  )
}

// One compact line of events: "● WPAI London 2027 · In discussion  ● WHAI
// London 2026 · Attended". The one open is marked; the rest are links.
export interface EventItem { key: string; event: string; status?: string | null; tone?: string; href?: string | null; current?: boolean }
export function EventsLine({ items, add }: { items: EventItem[]; add?: React.ReactNode }) {
  if (!items.length && !add) return null
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-[11.5px] font-medium shrink-0 leading-7" style={{ color: 'var(--fg-4)' }}>Events</span>
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0 text-[12.5px]">
        {items.map((e) => {
          const body = (
            <>
              <StageDot tone={e.tone ?? 'var(--line-3)'} />
              <span className={e.current ? 'font-semibold' : 'font-medium'} style={{ color: 'var(--fg)' }}>{shortEventName(e.event)}</span>
              {e.status && <span style={{ color: 'var(--fg-3)' }}>· {e.status}</span>}
            </>
          )
          const cls = 'inline-flex items-center gap-1.5 h-7 px-2 rounded-md whitespace-nowrap'
          return (
            <li key={e.key}>
              {e.current || !e.href
                ? <span className={cls} aria-current={e.current ? 'page' : undefined} style={e.current ? { background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line-2)' } : undefined}>{body}</span>
                : <Link href={e.href} className={`${cls} crm-row-link`} title={`Open ${e.event}`}>{body}</Link>}
            </li>
          )
        })}
        {add && <li>{add}</li>}
      </ul>
    </div>
  )
}
export const shortEventName = (e: string) => e.replace(/^World Health AI/i, 'WHAI').replace(/^World Pharma AI/i, 'WPAI')

// ── The name and the action, kept in view on a phone ──────────────────────────

// Once the header has scrolled under the top bar, a thin bar with the name
// and the primary action sits just below it. Phone only: a desk has the room.
export function MiniHeader({ watch, name, action }: { watch: React.RefObject<HTMLElement | null>; name: string; action?: React.ReactNode }) {
  const [top, setTop] = useState<number | null>(null)
  useEffect(() => {
    const el = watch.current
    if (!el) return
    const bar = () => document.querySelector('header.crm-top')?.getBoundingClientRect().bottom ?? 0
    const check = () => {
      const b = bar()
      setTop(el.getBoundingClientRect().bottom < b + 8 ? b : null)
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [watch])
  if (top == null) return null
  return (
    <div className="lg:hidden fixed inset-x-0 z-30 anim-fade-in" style={{ top, background: 'var(--surface)', borderBottom: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center gap-3 px-4 h-14">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="min-w-0 flex-1 text-left text-[14px] font-semibold truncate" style={{ color: 'var(--fg)' }} title="Back to the top">{name}</button>
        {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
      </div>
    </div>
  )
}

// ── Loading ──────────────────────────────────────────────────────────────────

// The page's own shape while it loads: the trail, the header with its band,
// and the two columns of cards.
export function ProfileSkeleton({ side = true }: { side?: boolean }) {
  const bar = (w: string, h = 'h-3') => <div className={`${h} rounded animate-pulse`} style={{ width: w, background: 'var(--surface-3)' }} />
  const card = (rows: number, key: string, quiet = false) => (
    <div key={key} className={`ws-card ${quiet ? 'ws-card-quiet' : ''} p-4 sm:p-5 flex flex-col gap-3`}>
      {bar('30%', 'h-3.5')}
      {Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-3">{bar(`${70 - i * 8}%`)}</div>)}
    </div>
  )
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-6" aria-busy="true" aria-label="Loading">
      <div className="h-10 flex items-center mb-3">{bar('160px')}</div>
      <div className={PROFILE_GRID}>
        <div className={PROFILE_MAIN}>
          <div className="ws-card overflow-hidden">
            <div className="p-4 sm:p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl animate-pulse shrink-0" style={{ background: 'var(--surface-3)' }} />
              <div className="flex-1 flex flex-col gap-2.5 pt-1">{bar('90px')}{bar('45%', 'h-5')}{bar('60%')}</div>
            </div>
            <div className="px-4 sm:px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>{bar('35%')}<div className="w-32 h-8 rounded-lg animate-pulse" style={{ background: 'var(--surface-3)' }} /></div>
          </div>
          {card(4, 'a')}
          {card(5, 'b')}
        </div>
        {side && <aside className="contents lg:flex lg:flex-col lg:gap-4">{card(5, 'c', true)}{card(3, 'd', true)}</aside>}
      </div>
    </div>
  )
}

// ── Export ───────────────────────────────────────────────────────────────────

// A person as a contact card (.vcf), for a phone's address book.
export function downloadVcard(p: { name: string; jobTitle?: string | null; company?: string | null; email?: string | null; phone?: string | null; url?: string | null }) {
  const esc = (v: string) => v.replace(/[,;\\]/g, (m) => `\\${m}`)
  const [first, ...rest] = p.name.split(/\s+/)
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${esc(rest.join(' '))};${esc(first ?? '')};;;`, `FN:${esc(p.name)}`]
  if (p.company) lines.push(`ORG:${esc(p.company)}`)
  if (p.jobTitle) lines.push(`TITLE:${esc(p.jobTitle)}`)
  if (p.email) lines.push(`EMAIL;TYPE=WORK:${p.email}`)
  if (p.phone) lines.push(`TEL;TYPE=WORK:${p.phone}`)
  if (p.url) lines.push(`URL:${p.url}`)
  lines.push('END:VCARD')
  download(`${p.name.replace(/[^\w ]+/g, '').trim() || 'contact'}.vcf`, 'text/vcard;charset=utf-8', lines.join('\r\n'))
}
function download(filename: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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

// `at` is when the record last moved, said next to a closed stage
// ("Rejected · 4 Nov 2026"); closed, the stops dim and that is the state.
export function StageBar({ kind, status, accent, disabled, onChange, at }: { kind: RecordKind; status: string; accent: string; disabled: boolean; onChange: (s: string) => void; at?: string | null }) {
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
      <div ref={boxRef} className="crm-journey flex-1 min-w-[260px]" style={closed ? { opacity: 0.55 } : undefined} aria-label={closed ? `Closed as ${status}` : undefined}>
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
              className={here ? 'ws-btn ws-btn-sm' : 'ws-btn ws-btn-sm ws-btn-ghost'}
              style={here ? { color: 'var(--bad)', borderColor: 'var(--bad)', fontWeight: 600 } : { color: 'var(--fg-4)' }}
              title={here ? `${s.label}${at ? `, ${fmtDate(at)}` : ''}: click to reopen` : `Mark as ${s.label.toLowerCase()}`}
            >
              {here ? <><X className="w-3.5 h-3.5" /> {s.label}{at && <span className="font-normal" style={{ color: 'var(--fg-3)' }}> · {fmtDate(at)}</span>}</> : `Mark ${s.label.toLowerCase()}`}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// The events the record's company or person is in, in one line (the one
// marked is this record; each other is a link to its own), and adding them
// to more. `addNote` says what adding does.
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
  // The open record is always in the line, even before the list loads.
  const items: EventItem[] = editions.map((e) => ({
    key: e.id, event: String(e.event), status: e.status ? stageLabel(kind, e.status) : null, tone: stageTone(kind, e.status),
    href: `${list}/${e.id}`, current: e.id === id,
  }))

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
    <>
      <EventsLine
        items={items.some((e) => e.current) || !current ? items : [{ key: id, event: current, current: true }, ...items.filter((e) => e.event.toLowerCase() !== current.toLowerCase())]}
        add={options.length > 0 ? (
          <button type="button" onClick={() => setAdding((a) => !a)} className="ws-btn ws-btn-ghost ws-btn-sm ws-tap !h-7" aria-expanded={adding} style={{ color: 'var(--fg-3)' }}>
            <Plus className="w-3.5 h-3.5" /> Add to event
          </button>
        ) : undefined}
      />
      {adding && (
        <div className="pt-1">
          <p className="text-[12px] mb-2" style={{ color: 'var(--fg-3)' }}>{addNote}</p>
          <EventPicker options={options} selected={picked} onToggle={(ev) => setPicked((p) => (p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev]))} />
          <div className="flex items-center gap-2 mt-3">
            <button type="button" onClick={save} disabled={!picked.length || saving} className="ws-btn ws-btn-sm ws-btn-primary ws-tap">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {picked.length ? `Add to ${picked.length} ${picked.length === 1 ? 'event' : 'events'}` : 'Pick events'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setPicked([]) }} className="ws-btn ws-btn-sm ws-btn-ghost ws-tap">Cancel</button>
          </div>
        </div>
      )}
    </>
  )
}

