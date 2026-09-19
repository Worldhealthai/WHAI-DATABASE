'use client'

// The entrance. Two questions, one after the other, each answered with a
// single click: which portal, then which event. The answer to the first
// slides away as the second arrives, and choosing an event carries the admin
// straight into that workspace at its default edition.

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Award, ChevronLeft, LogOut, Mic, Network, Users, KanbanSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { categoriseEvent, useEventCategories, type EventCategory } from '@/lib/eventCategories'
import {
  PORTALS, type PortalKey, defaultYear, editionYears, eventLook, eventSlug, isPortalKey, workspaceHref,
} from '@/lib/portals'
import { Logo } from '@/components/shell/Sidebar'
import { ThemeToggle } from '@/components/shell/ThemeToggle'

type Counts = Record<string, { sponsor: number; partner: number; speaker: number; delegate: number }>

// Totals per event category for the tiles ("18 sponsors · 6 partners"), from
// the four small stats endpoints, summed across every raw label that belongs
// to the category.
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

function Entrance() {
  const router = useRouter()
  const search = useSearchParams()
  const categories = useEventCategories()
  const counts = useCategoryCounts(categories)

  const initial = search.get('portal')
  const [portal, setPortal] = useState<PortalKey | null>(isPortalKey(initial) ? initial : null)
  const [leaving, setLeaving] = useState<'portal' | 'event' | null>(null)
  const [chosenEvent, setChosenEvent] = useState<string | null>(null)

  // Keep the URL honest so a refresh lands on the same step.
  useEffect(() => {
    const url = portal ? `/?portal=${portal}` : '/'
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, '', url)
  }, [portal])

  const choosePortal = (key: PortalKey) => {
    setLeaving('portal')
    window.setTimeout(() => { setPortal(key); setLeaving(null) }, 240)
  }
  const back = () => {
    setLeaving('event')
    window.setTimeout(() => { setPortal(null); setLeaving(null) }, 220)
  }
  const chooseEvent = (c: EventCategory) => {
    if (!portal) return
    const slug = eventSlug(c.name)
    const href = workspaceHref(portal, slug, '', defaultYear(portal, c))
    router.prefetch(href)
    setChosenEvent(c.name)
    window.setTimeout(() => router.push(href), 340)
  }

  const def = portal ? PORTALS[portal] : null
  const accentVars = def
    ? ({ '--accent': def.accent.fill, '--accent-ink': def.accent.ink, '--accent-soft': def.accent.soft, '--accent-line': def.accent.line } as React.CSSProperties)
    : undefined

  return (
    <div className="min-h-screen flex flex-col" style={{ ...accentVars, background: 'radial-gradient(1200px 600px at 50% -10%, var(--accent-soft) 0%, transparent 60%), var(--bg)' }}>
      <header className="flex items-center justify-between px-6 lg:px-10 h-16">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={logout} className="ws-btn ws-btn-ghost ws-btn-sm" title="Log out"><LogOut className="w-4 h-4" /> Log out</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        {!portal ? (
          <section className={cn('w-full max-w-4xl', leaving === 'portal' ? 'anim-zoom-away' : 'anim-fade-up')}>
            <p className="text-center text-[11.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--fg-3)' }}>World Nexus Group · CRM</p>
            <h1 className="display text-center text-[34px] sm:text-[40px] leading-tight mt-3" style={{ color: 'var(--fg)', fontWeight: 600 }}>
              Where are you working today?
            </h1>
            <p className="text-center text-[15px] mt-2" style={{ color: 'var(--fg-3)' }}>Pick a portal. You can switch at any time from the sidebar.</p>

            <div className="grid sm:grid-cols-2 gap-5 mt-10">
              {Object.values(PORTALS).map((p, i) => {
                const vars = { '--accent': p.accent.fill, '--accent-ink': p.accent.ink, '--accent-soft': p.accent.soft, '--accent-line': p.accent.line } as React.CSSProperties
                const chips = p.key === 'sales'
                  ? [{ icon: KanbanSquare, label: 'Pipeline' }, { icon: Award, label: 'Sponsors' }, { icon: Network, label: 'Partners & media' }]
                  : [{ icon: Mic, label: 'Speakers' }, { icon: Users, label: 'Delegates' }]
                return (
                  <button
                    key={p.key}
                    onClick={() => choosePortal(p.key)}
                    className="group text-left rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 anim-fade-up"
                    style={{ ...vars, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)', animationDelay: `${120 + i * 90}ms` }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--accent-line)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--line)' }}
                  >
                    <div className="flex items-start justify-between">
                      <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
                        {p.key === 'sales' ? <Award className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </span>
                      <span className="w-9 h-9 rounded-full flex items-center justify-center transition-all group-hover:translate-x-0.5" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                    <h2 className="display text-[22px] mt-5" style={{ color: 'var(--fg)', fontWeight: 600 }}>{p.name}</h2>
                    <p className="text-[14px] mt-1.5 leading-relaxed" style={{ color: 'var(--fg-3)' }}>{p.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-5">
                      {chips.map((c) => (
                        <span key={c.label} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)', border: '1px solid var(--line)' }}>
                          <c.icon className="w-3.5 h-3.5" style={{ color: 'var(--accent-ink)' }} /> {c.label}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ) : (
          <section className={cn('w-full max-w-5xl', leaving === 'event' ? 'anim-slide-out-left' : 'anim-fade-up')}>
            <div className="flex items-center justify-center gap-2">
              <button onClick={back} className="ws-btn ws-btn-sm" title="Choose the other portal"><ChevronLeft className="w-3.5 h-3.5" /> Portal</button>
              <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full text-[12px] font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', border: '1px solid var(--accent-line)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                {def?.name}
              </span>
            </div>
            <h1 className="display text-center text-[34px] sm:text-[40px] leading-tight mt-4" style={{ color: 'var(--fg)', fontWeight: 600 }}>
              Which event?
            </h1>
            <p className="text-center text-[15px] mt-2" style={{ color: 'var(--fg-3)' }}>
              {portal === 'sales' ? 'Every edition’s sponsors and partners, and the pipeline for the next one.' : 'Every edition’s speakers and delegates.'}
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
              {categories.filter((c) => c.name !== 'Other events').map((c, i) => {
                const look = eventLook(c.name)
                const years = editionYears(c).slice().reverse()
                const n = counts?.[c.name]
                const now = new Date().getFullYear()
                const summary = n
                  ? portal === 'sales'
                    ? `${n.sponsor} sponsor${n.sponsor === 1 ? '' : 's'} · ${n.partner} partner${n.partner === 1 ? '' : 's'}`
                    : `${n.speaker} speaker${n.speaker === 1 ? '' : 's'} · ${n.delegate} delegate${n.delegate === 1 ? '' : 's'}`
                  : ' '
                const picked = chosenEvent === c.name
                const dimmed = chosenEvent !== null && !picked
                return (
                  <button
                    key={c.name}
                    onClick={() => chooseEvent(c)}
                    disabled={chosenEvent !== null}
                    className={cn('group text-left rounded-2xl overflow-hidden transition-all duration-300 anim-fade-up', picked && 'scale-[1.03]', dimmed && 'opacity-30 scale-[0.98]')}
                    style={{ background: 'var(--surface)', border: `1px solid ${picked ? 'var(--accent-line)' : 'var(--line)'}`, boxShadow: picked ? 'var(--shadow-lg)' : 'var(--shadow-sm)', animationDelay: `${100 + i * 80}ms` }}
                    onMouseEnter={(e) => { if (!chosenEvent) { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-4px)' } }}
                    onMouseLeave={(e) => { if (!chosenEvent) { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = '' } }}
                  >
                    <div className="h-28 relative" style={{ background: look.gradient }}>
                      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 70% 70%, #fff 0 1px, transparent 1.5px)', backgroundSize: '28px 28px' }} />
                      <div className="absolute left-5 bottom-4 text-white">
                        <p className="display text-[26px] leading-none" style={{ fontWeight: 600 }}>{look.short}</p>
                        <p className="text-[12px] mt-1 opacity-90">{look.city} · {look.country}</p>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-[16px] font-semibold display" style={{ color: 'var(--fg)' }}>{look.series} <span style={{ color: 'var(--fg-3)' }}>·</span> {look.city}</p>
                      <p className="text-[13px] mt-1" style={{ color: 'var(--fg-3)' }}>{look.blurb}</p>
                      <p className="text-[12.5px] mt-3 min-h-[18px] font-medium" style={{ color: 'var(--fg-2)' }}>{summary}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {years.map((y) => (
                          <span key={y} className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11.5px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--fg-3)', border: '1px solid var(--line)' }}>
                            {y}{Number(y) === now + 1 && <span style={{ color: 'var(--accent-ink)' }}>· next</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <p className="text-center text-[12.5px] mt-8" style={{ color: 'var(--fg-4)' }}>
              Looking for something specific? <Link href={portal === 'sales' ? '/sponsors' : '/delegates'} className="underline underline-offset-4 hover:opacity-80" style={{ color: 'var(--fg-3)' }}>Browse every record</Link>
            </p>
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
