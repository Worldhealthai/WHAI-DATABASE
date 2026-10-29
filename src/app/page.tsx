'use client'

// The entrance: every event in one list, by series, so any event is one
// click away, with its editions beside it to open a year directly. Every
// event keeps its colour as a dot (London blue, Boston reddish pink, Pharma
// teal green). The event worked in last is a link above the list.

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { useEventCategories } from '@/lib/eventCategories'
import {
  type EventLook, type EventSeries,
  defaultYear, editionYears, eventLook, eventSlug, groupSeries, readLastWorkspace, workspaceHref,
} from '@/lib/portals'
import { Logo } from '@/components/shell/Sidebar'
import { ThemeToggle } from '@/components/shell/ThemeToggle'

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }) } finally { window.location.assign('/login') }
}

// The events, by series, as one list: each row is the event (opens its
// current edition) and its editions (open that year).
function EventList({ series }: { series: EventSeries[] }) {
  const now = new Date().getFullYear()
  return (
    <div className="ent-list">
      {series.map((s) => (
        <section key={s.name}>
          <h2 className="ent-series">{s.name}</h2>
          <ul>
            {s.events.map((c) => {
              const look = eventLook(c.name)
              const current = defaultYear('event', c)
              const slug = eventSlug(c.name)
              const years = editionYears(c).slice().sort()
              return (
                <li key={c.name} className="ent-row" style={{ ['--acc' as string]: look.accent }}>
                  <Link href={workspaceHref('event', slug, '', current)} className="flex items-center gap-3 min-w-0">
                    <span className="ent-dot" />
                    <span className="text-[15px] font-medium" style={{ color: 'var(--fg)' }}>{look.city}</span>
                    {look.country && <span className="text-[13px] truncate" style={{ color: 'var(--fg-4)' }}>{look.country}</span>}
                  </Link>
                  <nav className="ent-years" aria-label={`${s.name} ${look.city} editions`}>
                    {years.map((y) => (
                      <Link
                        key={y}
                        href={workspaceHref('event', slug, '', y)}
                        data-current={y === current}
                        title={Number(y) < now ? 'Past edition' : Number(y) === now ? 'This year' : 'Upcoming edition'}
                      >
                        {y}
                      </Link>
                    ))}
                  </nav>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Entrance() {
  const categories = useEventCategories()
  const series = groupSeries(categories)
  // Back to the event worked in last, in one click.
  const [last, setLast] = useState<{ href: string; label: string; look: EventLook } | null>(null)
  useEffect(() => {
    const l = readLastWorkspace()
    if (!l) return
    const c = categories.find((x) => eventSlug(x.name) === l.event)
    if (!c) return
    const year = l.year || defaultYear(l.portal, c)
    setLast({ href: workspaceHref(l.portal, l.event, '', year), label: `${c.name} ${year}`, look: eventLook(c.name) })
  }, [categories])

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="crm-field" aria-hidden="true" />
      <header className="crm-top relative z-[1] flex items-center justify-between px-6 lg:px-10 h-16">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={logout} className="ws-btn ws-btn-ghost ws-btn-sm" title="Log out"><LogOut className="w-4 h-4" /> Log out</button>
        </div>
      </header>

      <main className="relative z-[1] flex-1 w-full max-w-3xl mx-auto px-5 lg:px-0 pt-10 sm:pt-14 pb-20">
        <h1 className="text-[24px] leading-tight font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>Choose an event</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--fg-3)' }}>Opens on its current edition. Pick a year to go straight to it.</p>
        {last && (
          <Link href={last.href} className="ws-btn mt-5">
            <span className="w-2 h-2 rounded-full" style={{ background: last.look.accent }} />
            <span style={{ color: 'var(--fg-3)' }}>Last open</span>
            <span className="font-semibold" style={{ color: 'var(--fg)' }}>{last.label}</span>
          </Link>
        )}
        <div className="mt-6">
          <EventList series={series} />
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
