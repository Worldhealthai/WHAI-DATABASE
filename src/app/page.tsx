'use client'

// The entrance: the two series as glass panels over the sea-colour field,
// each with its events inside as rows, so any event is one click away, and
// its editions as chips that open that year directly. Every event has its
// own colour (London blue, Boston reddish pink, Pharma teal green). The
// event worked in last is a pill at the top.

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, LogOut } from 'lucide-react'
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

// One series: a glass panel with its mark, then each event as a row (opens
// its current edition) with the editions as chips (open that year).
function SeriesPanel({ series }: { series: EventSeries }) {
  const now = new Date().getFullYear()
  return (
    <section className="ent-panel" style={{ ['--acc' as string]: series.look.accent }}>
      <div className="flex items-center gap-4 px-6 pt-6 pb-5">
        <span className="ent-mark" style={{ color: series.look.accentInk, background: series.look.accentSoft }}>{series.short}</span>
        <span className="min-w-0">
          <span className="block text-[20px] font-semibold leading-tight" style={{ color: 'var(--fg)', letterSpacing: '-0.015em' }}>{series.name}</span>
          {series.blurb && <span className="block text-[13px] mt-0.5" style={{ color: 'var(--fg-3)' }}>{series.blurb}</span>}
        </span>
      </div>
      <ul className="flex flex-col gap-2 px-3 pb-3">
        {series.events.map((c) => {
          const look = eventLook(c.name)
          const current = defaultYear('event', c)
          const years = editionYears(c).slice().sort()
          const slug = eventSlug(c.name)
          return (
            <li key={c.name} className="ent-row" style={{ ['--acc' as string]: look.accent, ['--acc-soft' as string]: look.accentSoft }}>
              <Link href={workspaceHref('event', slug, '', current)} className="group flex items-center gap-3 px-4 pt-3.5 pb-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: look.accent, boxShadow: `0 0 0 4px ${look.accentSoft}` }} />
                <span className="min-w-0">
                  <span className="block text-[17px] font-semibold leading-tight" style={{ color: 'var(--fg)' }}>{look.city}</span>
                  {look.country && <span className="block text-[12px]" style={{ color: 'var(--fg-4)' }}>{look.country}</span>}
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: look.accentInk }}>
                  Open {current}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
              <div className="flex flex-wrap gap-1.5 px-4 pb-3.5 pl-[42px]">
                {years.map((y) => (
                  <Link
                    key={y}
                    href={workspaceHref('event', slug, '', y)}
                    className="ent-year"
                    data-current={y === current}
                    title={Number(y) < now ? 'Past edition' : Number(y) === now ? 'This year' : 'Upcoming edition'}
                  >
                    {y}
                  </Link>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
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
    setLast({ href: workspaceHref(l.portal, l.event, '', year), label: `${c.name} · ${year}`, look: eventLook(c.name) })
  }, [categories])

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* The colour the glass is seen through, as inside the app */}
      <div className="crm-field" aria-hidden="true" />
      <header className="relative z-[1] flex items-center justify-between px-6 lg:px-10 h-16">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={logout} className="ws-btn ws-btn-ghost ws-btn-sm" title="Log out"><LogOut className="w-4 h-4" /> Log out</button>
        </div>
      </header>

      <main className="relative z-[1] flex-1 w-full max-w-5xl mx-auto px-5 lg:px-10 pt-8 sm:pt-14 pb-20 flex flex-col items-center">
        <p className="text-[11.5px] font-semibold tracking-[0.18em] uppercase" style={{ color: 'var(--fg-3)' }}>World Nexus Group CRM</p>
        <h1 className="text-[30px] sm:text-[40px] leading-[1.1] mt-2 font-semibold text-center" style={{ color: 'var(--fg)', letterSpacing: '-0.03em' }}>
          Which event are you working on?
        </h1>
        <p className="text-[14.5px] mt-3 text-center max-w-xl" style={{ color: 'var(--fg-3)' }}>
          Everything for it is in one place: sales, speakers, the agenda, registrations and marketing.
        </p>
        {last && (
          <Link href={last.href} className="ent-continue mt-6">
            <span className="w-2 h-2 rounded-full" style={{ background: last.look.accent }} />
            <span style={{ color: 'var(--fg-3)' }}>Continue</span>
            <span className="font-semibold" style={{ color: 'var(--fg)' }}>{last.label}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}

        <div className="grid md:grid-cols-2 gap-5 mt-10 w-full items-start">
          {series.map((s) => <SeriesPanel key={s.name} series={s} />)}
        </div>
      </main>
    </div>
  )
}

export default function EntrancePage() {
  return (
    <Suspense fallback={<div className="min-h-screen"><div className="crm-field" aria-hidden="true" /></div>}>
      <Entrance />
    </Suspense>
  )
}
