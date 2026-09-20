'use client'

// The entrance. Three questions, one after the other, each answered with a
// single click: which portal, which event series, and — for a series with
// more than one city — which city. Every event has its own colour (London
// blue, Boston reddish pink, Pharma teal green); choosing one lets that
// colour flood the page for a beat before the workspace takes over in it.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, ChevronLeft, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { categoriseEvent, useEventCategories, type EventCategory } from '@/lib/eventCategories'
import {
  PORTALS, type EventLook, type EventSeries, type PortalKey,
  defaultYear, editionYears, eventLook, eventSlug, groupSeries, isPortalKey, workspaceHref,
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

// The colour variables a tile paints itself with.
const tileVars = (look: EventLook) =>
  ({ '--tile': look.accent, '--tile-soft': look.accentSoft, '--tile-line': look.accentLine }) as React.CSSProperties

function Crumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <div className="flex items-center justify-center gap-2.5 text-[13px]" style={{ color: 'var(--fg-3)' }}>
      {items.map((c, i) => (
        <span key={c.label} className="flex items-center gap-2.5">
          {i > 0 && <span style={{ color: 'var(--line-3)' }}>/</span>}
          {c.onClick ? (
            <button onClick={c.onClick} className="inline-flex items-center gap-1 hover:underline underline-offset-4">
              {i === 0 && <ChevronLeft className="w-3.5 h-3.5" />}{c.label}
            </button>
          ) : (
            <span className="font-semibold" style={{ color: 'var(--fg)' }}>{c.label}</span>
          )}
        </span>
      ))}
    </div>
  )
}

function Entrance() {
  const router = useRouter()
  const search = useSearchParams()
  const categories = useEventCategories()
  const counts = useCategoryCounts(categories)
  const series = groupSeries(categories)

  const initialPortal = search.get('portal')
  const [portal, setPortal] = useState<PortalKey | null>(isPortalKey(initialPortal) ? initialPortal : null)
  const [seriesName, setSeriesName] = useState<string | null>(() => {
    const s = search.get('series')
    return s ? s : null
  })
  const [leaving, setLeaving] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [wash, setWash] = useState<string | null>(null)

  const step: 'portal' | 'series' | 'city' = !portal ? 'portal' : !seriesName ? 'series' : 'city'
  const def = portal ? PORTALS[portal] : null
  const current = series.find((s) => eventSlug(s.name) === seriesName) ?? null
  const now = new Date().getFullYear()

  // Keep the URL honest so a refresh lands on the same step.
  useEffect(() => {
    const q = new URLSearchParams()
    if (portal) q.set('portal', portal)
    if (portal && seriesName) q.set('series', seriesName)
    const url = q.toString() ? `/?${q}` : '/'
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, '', url)
  }, [portal, seriesName])

  // Leave the current step with a short exit animation, then show the next.
  const transition = (apply: () => void) => {
    setLeaving(true)
    window.setTimeout(() => { apply(); setLeaving(false); setPicked(null) }, 220)
  }

  const openEvent = (c: EventCategory) => {
    if (!portal) return
    const look = eventLook(c.name)
    const href = workspaceHref(portal, eventSlug(c.name), '', defaultYear(portal, c))
    router.prefetch(href)
    setPicked(c.name)
    setWash(look.accentSoft)
    window.setTimeout(() => router.push(href), 460)
  }

  const choosePortal = (key: PortalKey) => {
    setPicked(key)
    transition(() => setPortal(key))
  }
  const chooseSeries = (s: EventSeries) => {
    setPicked(s.name)
    // One city only: straight in.
    if (s.events.length === 1) { openEvent(s.events[0]); return }
    transition(() => setSeriesName(eventSlug(s.name)))
  }
  const backToPortals = () => transition(() => { setPortal(null); setSeriesName(null) })
  const backToSeries = () => transition(() => setSeriesName(null))

  const summaryFor = (c: EventCategory) => {
    const n = counts?.[c.name]
    if (!n) return ''
    return portal === 'sales'
      ? `${plural(n.sponsor, 'sponsor')} · ${plural(n.partner, 'partner')}`
      : portal === 'marketing'
        ? `${plural(n.speaker, 'speaker')} · ${plural(n.sponsor, 'sponsor')}`
        : `${plural(n.speaker, 'speaker')} · ${plural(n.delegate, 'delegate')}`
  }

  const busy = picked !== null && wash !== null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {wash && <div className="ev-wash" style={{ '--wash': wash } as React.CSSProperties} aria-hidden />}

      <header className="flex items-center justify-between px-6 lg:px-10 h-16">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={logout} className="ws-btn ws-btn-ghost ws-btn-sm" title="Log out"><LogOut className="w-4 h-4" /> Log out</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        {/* ── 1. Portal ─────────────────────────────────────────────────── */}
        {step === 'portal' && (
          <section className={cn('w-full max-w-5xl', leaving ? 'anim-zoom-away' : 'anim-rise')}>
            <p className="text-center text-[12px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--fg-4)' }}>World Nexus Group</p>
            <h1 className="text-center text-[34px] leading-tight mt-2 font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>Where are you working today?</h1>
            <p className="text-center text-[14.5px] mt-2" style={{ color: 'var(--fg-3)' }}>Pick a portal. You can switch any time from the sidebar.</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
              {Object.values(PORTALS).map((p, i) => {
                const vars = { '--tile': p.accent.fill, '--tile-soft': p.accent.soft, '--tile-line': p.accent.line } as React.CSSProperties
                return (
                  <button
                    key={p.key}
                    onClick={() => choosePortal(p.key)}
                    disabled={picked !== null}
                    data-picked={picked === p.key}
                    data-dimmed={picked !== null && picked !== p.key}
                    className="ev-tile p-7 anim-rise"
                    style={{ ...vars, animationDelay: `${120 + i * 90}ms` }}
                  >
                    <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-[15px] font-bold" style={{ background: 'var(--tile-soft)', color: 'var(--tile)' }}>
                      {p.short[0]}
                    </span>
                    <h2 className="text-[21px] font-semibold mt-5" style={{ color: 'var(--fg)', letterSpacing: '-0.01em' }}>{p.name}</h2>
                    <p className="text-[14px] mt-0.5" style={{ color: 'var(--fg-3)' }}>{p.tagline}</p>
                    <p className="text-[13.5px] mt-4 leading-relaxed" style={{ color: 'var(--fg-2)' }}>{p.description}</p>
                    <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold mt-6" style={{ color: 'var(--tile)' }}>
                      Open <ArrowRight className="ev-arrow w-4 h-4" />
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 2. Series ─────────────────────────────────────────────────── */}
        {step === 'series' && def && (
          <section className={cn('w-full max-w-3xl', leaving && !wash ? 'anim-zoom-away' : 'anim-rise')}>
            <Crumbs items={[{ label: 'Portals', onClick: backToPortals }, { label: def.name }]} />
            <h1 className="text-center text-[34px] leading-tight mt-3 font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>Which event?</h1>
            <p className="text-center text-[14.5px] mt-2" style={{ color: 'var(--fg-3)' }}>Choose a series, then the city.</p>

            <div className="grid sm:grid-cols-2 gap-5 mt-10">
              {series.map((s, i) => {
                const isPicked = picked === s.name || (s.events.length === 1 && picked === s.events[0].name)
                const total = s.events.reduce((acc, c) => {
                  const n = counts?.[c.name]
                  if (!n) return acc
                  return acc + (portal === 'sales' ? n.sponsor + n.partner : portal === 'marketing' ? n.speaker + n.sponsor : n.speaker + n.delegate)
                }, 0)
                return (
                  <button
                    key={s.name}
                    onClick={() => chooseSeries(s)}
                    disabled={busy}
                    data-picked={isPicked}
                    data-dimmed={picked !== null && !isPicked}
                    className="ev-tile p-7 anim-rise"
                    style={{ ...tileVars(s.look), animationDelay: `${100 + i * 90}ms` }}
                  >
                    <span className="inline-flex items-center h-7 px-2.5 rounded-lg text-[12px] font-bold tracking-wide" style={{ background: 'var(--tile-soft)', color: 'var(--tile)' }}>
                      {s.short}
                    </span>
                    <h2 className="text-[24px] font-semibold mt-5" style={{ color: 'var(--fg)', letterSpacing: '-0.01em' }}>{s.name}</h2>
                    <p className="text-[14px] mt-1" style={{ color: 'var(--fg-3)' }}>{s.blurb}</p>

                    {/* the cities inside, each in its own colour */}
                    <div className="flex flex-wrap gap-2 mt-5">
                      {s.events.map((c) => {
                        const look = eventLook(c.name)
                        return (
                          <span key={c.name} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12.5px] font-medium" style={{ background: look.accentSoft, color: look.accentInk }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: look.accent }} />
                            {look.city}
                          </span>
                        )
                      })}
                    </div>

                    <div className="flex items-center justify-between mt-6">
                      <span className="text-[13px]" style={{ color: 'var(--fg-3)' }}>
                        {counts ? plural(total, portal === 'sales' ? 'company' : portal === 'marketing' ? 'record' : 'person').replace('companys', 'companies').replace('persons', 'people') : ''}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: 'var(--tile)' }}>
                        {s.events.length === 1 ? 'Open' : 'Choose city'} <ArrowRight className="ev-arrow w-4 h-4" />
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 3. City ───────────────────────────────────────────────────── */}
        {step === 'city' && def && current && (
          <section className={cn('w-full max-w-3xl', leaving && !wash ? 'anim-zoom-away' : 'anim-rise')}>
            <Crumbs items={[{ label: 'Portals', onClick: backToPortals }, { label: def.name, onClick: backToSeries }, { label: current.name }]} />
            <h1 className="text-center text-[34px] leading-tight mt-3 font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>Which city?</h1>
            <p className="text-center text-[14.5px] mt-2" style={{ color: 'var(--fg-3)' }}>{current.name} runs in {current.events.map((c) => eventLook(c.name).city).join(' and ')}.</p>

            <div className="grid sm:grid-cols-2 gap-5 mt-10">
              {current.events.map((c, i) => {
                const look = eventLook(c.name)
                const years = editionYears(c).slice().reverse()
                const isPicked = picked === c.name
                return (
                  <button
                    key={c.name}
                    onClick={() => openEvent(c)}
                    disabled={busy}
                    data-picked={isPicked}
                    data-dimmed={picked !== null && !isPicked}
                    className="ev-tile p-7 anim-rise"
                    style={{ ...tileVars(look), animationDelay: `${100 + i * 90}ms` }}
                  >
                    <span className="inline-flex items-center h-7 px-2.5 rounded-lg text-[12px] font-bold tracking-wide" style={{ background: 'var(--tile-soft)', color: 'var(--tile)' }}>
                      {look.short} · {look.city.toUpperCase()}
                    </span>
                    <h2 className="text-[28px] font-semibold mt-5" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>{look.city}</h2>
                    <p className="text-[14px]" style={{ color: 'var(--fg-3)' }}>{look.country}</p>
                    <p className="text-[13.5px] mt-3 leading-relaxed" style={{ color: 'var(--fg-2)' }}>{look.blurb}</p>

                    <div className="flex flex-wrap gap-1.5 mt-5">
                      {years.map((y) => {
                        const next = Number(y) === now + 1
                        return (
                          <span
                            key={y}
                            className="inline-flex items-center h-6 px-2 rounded-md text-[12px] font-medium tabular"
                            style={next ? { background: 'var(--tile-soft)', color: 'var(--tile)' } : { background: 'var(--surface-2)', color: 'var(--fg-3)', border: '1px solid var(--line)' }}
                          >
                            {y}{next ? ' · next' : ''}
                          </span>
                        )
                      })}
                    </div>

                    <div className="flex items-center justify-between mt-6">
                      <span className="text-[13px] min-h-[18px]" style={{ color: 'var(--fg-3)' }}>{summaryFor(c)}</span>
                      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: 'var(--tile)' }}>
                        Open <ArrowRight className="ev-arrow w-4 h-4" />
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

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
