'use client'

// The bar over every screen: which event and edition is open (and the way
// to another), then search. It is the one place either is chosen; the
// sidebar is only the sections.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, LayoutGrid, Menu } from 'lucide-react'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import { defaultYear, eventLook, eventSlug, workspaceHref } from '@/lib/portals'
import type { WorkspaceView } from '@/lib/workspace'

function EventSwitcher({ view }: { view: WorkspaceView }) {
  const { portal, category, section, inWorkspace, categories } = view
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  if (!portal || !category) {
    return <Link href="/" className="crm-switch"><LayoutGrid className="w-4 h-4" style={{ color: 'var(--fg-4)' }} /> Choose an event</Link>
  }
  const look = eventLook(category.name)
  const events = categories.filter((c) => c.name !== 'Other events')
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="crm-switch" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: look.accent }} />
        <span className="truncate">{look.series}<span className="hidden sm:inline" style={{ color: 'var(--fg-3)', fontWeight: 500 }}> · {look.city}</span></span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--fg-4)' }} />
      </button>
      {open && (
        <div className="crm-menu anim-fade-in" role="menu">
          {events.map((c) => {
            const l = eventLook(c.name)
            const current = c.name === category.name
            return (
              <Link
                key={c.name}
                role="menuitem"
                href={workspaceHref(portal.key, eventSlug(c.name), inWorkspace ? section : '', defaultYear(portal.key, c))}
                className="crm-menu-item"
                onClick={() => setOpen(false)}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.accent }} />
                <span className="flex-1 min-w-0 truncate">{l.series} <span style={{ color: 'var(--fg-3)' }}>· {l.city}</span></span>
                {current && <Check className="w-3.5 h-3.5" style={{ color: 'var(--fg-3)' }} />}
              </Link>
            )
          })}
          <div className="my-1 h-px" style={{ background: 'var(--line)' }} />
          <Link role="menuitem" href="/" className="crm-menu-item" onClick={() => setOpen(false)} style={{ color: 'var(--fg-3)' }}>
            <LayoutGrid className="w-3.5 h-3.5" /> All events
          </Link>
        </div>
      )}
    </div>
  )
}

function Editions({ view }: { view: WorkspaceView }) {
  const { portal, slug, year, years, section, inWorkspace } = view
  if (!portal || !slug || years.length === 0) return null
  const now = new Date().getFullYear()
  return (
    <nav className="crm-years" aria-label="Edition">
      {[...years].sort().map((y) => (
        <Link
          key={y}
          href={workspaceHref(portal.key, slug, inWorkspace ? section : '', y)}
          data-active={y === year}
          data-past={Number(y) < now}
          aria-current={y === year ? 'page' : undefined}
          title={Number(y) < now ? 'Past edition' : Number(y) === now ? 'This year' : 'Upcoming edition'}
        >
          {y}
        </Link>
      ))}
    </nav>
  )
}

export function Topbar({ view, title, onMenu }: { view: WorkspaceView; title?: string; onMenu: () => void }) {
  return (
    <header className="crm-top sticky top-0 z-40 h-14 shrink-0 flex items-center gap-2 sm:gap-3 px-3 lg:px-6">
      <button onClick={onMenu} className="ws-btn ws-btn-ghost ws-btn-sm lg:hidden -ml-1" aria-label="Open menu">
        <Menu className="w-5 h-5" />
      </button>
      <EventSwitcher view={view} />
      <Editions view={view} />
      {title && !view.inWorkspace && (
        <span className="hidden md:inline text-[13px] truncate" style={{ color: 'var(--fg-3)' }}>/ {title}</span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
      </div>
    </header>
  )
}
