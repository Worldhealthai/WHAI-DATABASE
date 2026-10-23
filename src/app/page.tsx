'use client'

// The entrance: every portal's events at once, as trees (series → city →
// edition), so any event is one click away. Every event has its own colour
// (London blue, Boston reddish pink, Pharma teal green). The event worked in
// last is a button at the top.

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, LogOut } from 'lucide-react'
import { categoriseEvent, useEventCategories, type EventCategory } from '@/lib/eventCategories'
import {
  PORTALS, type EventLook, type EventSeries, type PortalKey,
  defaultYear, editionYears, eventLook, eventSlug, groupSeries, readLastWorkspace, workspaceHref,
} from '@/lib/portals'
import { Logo } from '@/components/shell/Sidebar'
import { ThemeToggle } from '@/components/shell/ThemeToggle'

type Counts = Record<string, { sponsor: number; partner: number; speaker: number; delegate: number }>

// Totals per event for the tiles ("18 sponsors · 6 partners"), from the four
// small stats endpoints, summed across every raw label the event carries.
function useCategoryCounts(categories: EventCategory[]): Counts | null {
  const [counts, setCounts] = useState<Counts | null>(null)
  useEffect(() => {
    let alive = true
    const get = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : { byEvent: {} })).catch(() => ({ byEvent: {} }))
    Promise.all([get('/api/sponsors/stats'), get('/api/partners/stats'), get('/api/speakers/stats'), get('/api/delegates/stats')]).then(
      ([sp, pt, sk, dl]) => {
        if (!alive) return
        const out: Counts = {}
        const add = (kind: keyof Counts[string], byEvent: Record<string, number>) => {
          for (const [label, n] of Object.entries(byEvent ?? {})) {
            const { category } = categoriseEvent(label)
            out[category] = out[category] ?? { sponsor: 0, partner: 0, speaker: 0, delegate: 0 }
            out[category][kind] += n
          }
        }
        add('sponsor', sp.byEvent); add('partner', pt.byEvent); add('speaker', sk.byEvent); add('delegate', dl.byEvent)
        setCounts(out)
      }
    )
    return () => { alive = false }
  }, [categories.length])
  return counts
}

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }) } finally { window.location.assign('/login') }
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// One portal's events as a tree: series → city → editions. A year opens
// that edition; the city opens the portal's usual one (Sales: next year).
function PortalTree({ portal, series, counts, now }: { portal: PortalKey; series: EventSeries[]; counts: Counts | null; now: number }) {
  const def = PORTALS[portal]
  const summary = (c: EventCategory) => {
    const n = counts?.[c.name]
    if (!n) return ''
    return portal === 'sales'
      ? `${plural(n.sponsor, 'sponsor')} · ${plural(n.partner, 'partner')}`
      : portal === 'marketing'
        ? `${plural(n.speaker, 'speaker')} · ${plural(n.sponsor, 'sponsor')}`
        : `${plural(n.speaker, 'speaker')} · ${plural(n.delegate, 'delegate')}`
  }
  return (
    <section className="ws-card overflow-hidden flex flex-col">
      <div className="h-1" style={{ background: def.accent.fill }} />
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[14px] font-bold shrink-0" style={{ background: def.accent.soft, color: def.accent.fill }}>{def.short[0]}</span>
        <span className="min-w-0">
          <span className="block text-[16px] font-semibold leading-tight" style={{ color: 'var(--fg)' }}>{def.name}</span>
          <span className="block text-[12.5px] truncate" style={{ color: 'var(--fg-3)' }}>{def.tagline}</span>
        </span>
      </div>
      <div className="px-5 pb-5 flex flex-col gap-4">
        {series.map((s) => (
          <div key={s.name}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: 'var(--fg-4)' }}>{s.name}</p>
            <ul className="flex flex-col gap-1.5 pl-3 ml-1" style={{ borderLeft: '1px solid var(--line-2)' }}>
              {s.events.map((c) => {
                const look = eventLook(c.name)
                const slug = eventSlug(c.name)
                const years = editionYears(c).slice().sort()
                const main = defaultYear(portal, c)
                return (
                  <li key={c.name} className="relative">
                    {/* the branch from the series line */}
                    <span aria-hidden className="absolute -left-3 top-[15px] w-2.5" style={{ borderTop: '1px solid var(--line-2)' }} />
                    <div className="rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--surface-2)]">
                      <Link href={workspaceHref(portal, slug, '', main)} className="flex items-center gap-2 group">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: look.accent }} />
                        <span className="text-[14px] font-semibold group-hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{look.city}</span>
                        <span className="text-[12px] truncate" style={{ color: 'var(--fg-4)' }}>{summary(c)}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: look.accent }} />
                      </Link>
                      <div className="flex flex-wrap gap-1 mt-1.5 pl-4">
                        {years.map((y) => {
                          const past = Number(y) < now
                          const isMain = y === main
                          return (
                            <Link
                              key={y}
                              href={workspaceHref(portal, slug, '', y)}
                              className="inline-flex items-center h-6 px-2 rounded-md text-[12px] font-medium tabular transition-colors"
                              style={isMain
                                ? { background: look.accentSoft, color: look.accentInk, border: `1px solid ${look.accentLine}` }
                                : { color: past ? 'var(--fg-4)' : 'var(--fg-2)', border: '1px solid var(--line)', background: 'var(--surface)' }}
                              title={`${def.short}: ${c.name} ${y}`}
                            >
                              {y}{Number(y) === now + 1 ? ' · next' : ''}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function Entrance() {
  const categories = useEventCategories()
  const counts = useCategoryCounts(categories)
  const series = groupSeries(categories)
  const now = new Date().getFullYear()
  // Back to the event worked in last, in one click.
  const [last, setLast] = useState<{ href: string; label: string; look: EventLook } | null>(null)
  useEffect(() => {
    const l = readLastWorkspace()
    if (!l) return
    const c = categories.find((x) => eventSlug(x.name) === l.event)
    if (!c) return
    const year = l.year || defaultYear(l.portal, c)
    setLast({ href: workspaceHref(l.portal, l.event, '', year), label: `${PORTALS[l.portal].short} · ${c.name} · ${year}`, look: eventLook(c.name) })
  }, [categories])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <header className="flex items-center justify-between px-6 lg:px-10 h-16">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={logout} className="ws-btn ws-btn-ghost ws-btn-sm" title="Log out"><LogOut className="w-4 h-4" /> Log out</button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 lg:px-10 pt-6 pb-20">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--fg-4)' }}>World Nexus Group</p>
            <h1 className="text-[28px] leading-tight mt-1 font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>Where are you working today?</h1>
            <p className="text-[14px] mt-1" style={{ color: 'var(--fg-3)' }}>Click an event, or a year, to go straight in.</p>
          </div>
          {last && (
            <Link href={last.href} className="ws-btn" style={{ borderColor: last.look.accentLine }}>
              <span className="w-2 h-2 rounded-full" style={{ background: last.look.accent }} />
              <span style={{ color: 'var(--fg-3)' }}>Continue:</span> {last.label} <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-7 items-start">
          {(Object.keys(PORTALS) as PortalKey[]).map((key) => (
            <PortalTree key={key} portal={key} series={series} counts={counts} now={now} />
          ))}
        </div>
      </main>
    </div>
  )
}

export default function EntrancePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--bg)' }} />}>
      <Entrance />
    </Suspense>
  )
}
