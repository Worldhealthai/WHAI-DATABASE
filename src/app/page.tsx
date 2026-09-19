'use client'

// The entrance. Two questions, one after the other, each answered with a
// single click: which portal, then which event. Choosing an event carries
// the admin straight into that workspace at its default edition.

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, ChevronLeft, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { categoriseEvent, useEventCategories, type EventCategory } from '@/lib/eventCategories'
import { PORTALS, type PortalKey, defaultYear, editionYears, eventLook, eventSlug, isPortalKey, workspaceHref } from '@/lib/portals'
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
    window.setTimeout(() => { setPortal(key); setLeaving(null) }, 220)
  }
  const back = () => {
    setLeaving('event')
    window.setTimeout(() => { setPortal(null); setLeaving(null) }, 200)
  }
  const chooseEvent = (c: EventCategory) => {
    if (!portal) return
    const href = workspaceHref(portal, eventSlug(c.name), '', defaultYear(portal, c))
    router.prefetch(href)
    setChosenEvent(c.name)
    window.setTimeout(() => router.push(href), 300)
  }

  const def = portal ? PORTALS[portal] : null
  const now = new Date().getFullYear()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <header className="flex items-center justify-between px-6 lg:px-10 h-16">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={logout} className="ws-btn ws-btn-ghost ws-btn-sm" title="Log out"><LogOut className="w-4 h-4" /> Log out</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {!portal ? (
          <section className={cn('w-full max-w-3xl', leaving === 'portal' ? 'anim-zoom-away' : 'anim-fade-up')}>
            <h1 className="text-center text-[30px] leading-tight" style={{ color: 'var(--fg)' }}>Where are you working today?</h1>
            <p className="text-center text-[14px] mt-2" style={{ color: 'var(--fg-3)' }}>Pick a portal. You can change it any time from the sidebar.</p>

            <div className="grid sm:grid-cols-2 gap-4 mt-9">
              {Object.values(PORTALS).map((p, i) => (
                <button
                  key={p.key}
                  onClick={() => choosePortal(p.key)}
                  className="group text-left rounded-xl p-6 transition-all duration-150 anim-fade-up"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)', animationDelay: `${100 + i * 70}ms` }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--line-3)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
                >
                  <h2 className="text-[20px]" style={{ color: 'var(--fg)' }}>{p.name}</h2>
                  <p className="text-[14px] mt-1" style={{ color: 'var(--fg-3)' }}>{p.tagline}</p>
                  <p className="text-[13.5px] mt-4 leading-relaxed" style={{ color: 'var(--fg-2)' }}>{p.description}</p>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium mt-5" style={{ color: 'var(--accent-ink)' }}>
                    Open <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className={cn('w-full max-w-4xl', leaving === 'event' ? 'anim-slide-out-left' : 'anim-fade-up')}>
            <div className="flex items-center justify-center gap-3 text-[13px]" style={{ color: 'var(--fg-3)' }}>
              <button onClick={back} className="inline-flex items-center gap-1 hover:underline underline-offset-4"><ChevronLeft className="w-3.5 h-3.5" /> Portals</button>
              <span>·</span>
              <span className="font-medium" style={{ color: 'var(--fg)' }}>{def?.name}</span>
            </div>
            <h1 className="text-center text-[30px] leading-tight mt-3" style={{ color: 'var(--fg)' }}>Which event?</h1>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-9">
              {categories.filter((c) => c.name !== 'Other events').map((c, i) => {
                const look = eventLook(c.name)
                const years = editionYears(c).slice().reverse()
                const n = counts?.[c.name]
                const summary = n
                  ? portal === 'sales' ? `${plural(n.sponsor, 'sponsor')} · ${plural(n.partner, 'partner')}` : `${plural(n.speaker, 'speaker')} · ${plural(n.delegate, 'delegate')}`
                  : ''
                const picked = chosenEvent === c.name
                const dimmed = chosenEvent !== null && !picked
                return (
                  <button
                    key={c.name}
                    onClick={() => chooseEvent(c)}
                    disabled={chosenEvent !== null}
                    className={cn('group text-left rounded-xl p-5 transition-all duration-200 anim-fade-up', dimmed && 'opacity-40')}
                    style={{ background: 'var(--surface)', border: `1px solid ${picked ? 'var(--line-3)' : 'var(--line)'}`, boxShadow: picked ? 'var(--shadow-md)' : 'var(--shadow-sm)', animationDelay: `${80 + i * 60}ms` }}
                    onMouseEnter={(e) => { if (!chosenEvent) { e.currentTarget.style.borderColor = 'var(--line-3)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' } }}
                    onMouseLeave={(e) => { if (!chosenEvent) { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' } }}
                  >
                    <p className="text-[12px] font-medium" style={{ color: 'var(--fg-4)' }}>{look.short}</p>
                    <p className="text-[17px] font-semibold mt-1" style={{ color: 'var(--fg)' }}>{look.series}</p>
                    <p className="text-[14px]" style={{ color: 'var(--fg-3)' }}>{look.city}, {look.country}</p>
                    <p className="text-[13px] mt-4 min-h-[18px]" style={{ color: 'var(--fg-2)' }}>{summary}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[12.5px]" style={{ color: 'var(--fg-3)' }}>
                      {years.map((y) => <span key={y}>{y}{Number(y) === now + 1 ? ' (next)' : ''}</span>)}
                    </div>
                  </button>
                )
              })}
            </div>

            <p className="text-center text-[12.5px] mt-8" style={{ color: 'var(--fg-4)' }}>
              <Link href={portal === 'sales' ? '/sponsors' : '/delegates'} className="hover:underline underline-offset-4">Browse every record instead</Link>
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
