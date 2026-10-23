'use client'

// The entrance: every portal's events at once, as trees (series → city),
// so any event is one click away; years are switched inside it. Every event has its own colour
// (London blue, Boston reddish pink, Pharma teal green). The event worked in
// last is a button at the top.

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, LogOut } from 'lucide-react'
import { useEventCategories } from '@/lib/eventCategories'
import {
  PORTALS, type EventLook, type EventSeries, type PortalKey,
  defaultYear, eventLook, eventSlug, groupSeries, readLastWorkspace, workspaceHref,
} from '@/lib/portals'
import { Logo } from '@/components/shell/Sidebar'
import { ThemeToggle } from '@/components/shell/ThemeToggle'

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }) } finally { window.location.assign('/login') }
}

// A branch of the tree: the trunk down the left (stopping at the last item)
// and a tick across to the item, `at` px from the item's top.
function Branch({ last, at, className, children }: { last: boolean; at: number; className: string; children: ReactNode }) {
  return (
    <li className={`relative pl-6 ${className}`}>
      <span aria-hidden className="absolute left-0 top-0 w-px" style={{ background: 'var(--line-2)', height: last ? at : '100%' }} />
      <span aria-hidden className="absolute left-0 w-5 h-px" style={{ background: 'var(--line-2)', top: at }} />
      {children}
    </li>
  )
}

// One portal as a tree: the portal card is the root, the series and their
// events branch out below it. A city opens the portal's usual edition
// (Sales: next year); the years are switched inside.
function PortalTree({ portal, series }: { portal: PortalKey; series: EventSeries[] }) {
  const def = PORTALS[portal]
  return (
    <section>
      <div className="ws-card overflow-hidden">
        <div className="h-1" style={{ background: def.accent.fill }} />
        <div className="px-5 py-4 flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-[15px] font-bold shrink-0" style={{ background: def.accent.soft, color: def.accent.fill }}>{def.short[0]}</span>
          <span className="min-w-0">
            <span className="block text-[17px] font-semibold leading-tight" style={{ color: 'var(--fg)' }}>{def.name}</span>
            <span className="block text-[12.5px] truncate" style={{ color: 'var(--fg-3)' }}>{def.tagline}</span>
          </span>
        </div>
      </div>
      <ul className="ml-7">
        {series.map((s, i) => (
          <Branch key={s.name} last={i === series.length - 1} at={26} className="pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] leading-5" style={{ color: 'var(--fg-4)' }}>{s.name}</p>
            <ul className="ml-3">
              {s.events.map((c, j) => {
                const look = eventLook(c.name)
                return (
                  <Branch key={c.name} last={j === s.events.length - 1} at={38} className="pt-2.5">
                    <Link
                      href={workspaceHref(portal, eventSlug(c.name), '', defaultYear(portal, c))}
                      className="group flex items-center gap-3 h-14 px-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm transition-colors hover:border-[var(--acc)] hover:bg-[var(--acc-soft)]"
                      style={{ ['--acc' as string]: look.accentLine, ['--acc-soft' as string]: look.accentSoft }}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: look.accent }} />
                      <span className="text-[16px] font-semibold" style={{ color: 'var(--fg)' }}>{look.city}</span>
                      <ArrowRight className="w-5 h-5 ml-auto shrink-0 transition-transform group-hover:translate-x-1" style={{ color: look.accent }} />
                    </Link>
                  </Branch>
                )
              })}
            </ul>
          </Branch>
        ))}
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
            <p className="text-[14px] mt-1" style={{ color: 'var(--fg-3)' }}>Click an event to go straight in.</p>
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
            <PortalTree key={key} portal={key} series={series} />
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
