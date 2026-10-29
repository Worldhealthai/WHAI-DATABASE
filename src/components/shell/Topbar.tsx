'use client'

// The bar over every screen: the areas as pill tabs, search; then which
// event and edition is open (the one place either is chosen) and the open
// area's own tabs. On phones the sections are in the drawer.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ChevronDown, LayoutGrid, LogOut, Menu } from 'lucide-react'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import { TOOLS, defaultYear, eventLook, eventSlug, workspaceHref, type PortalSection } from '@/lib/portals'
import type { WorkspaceView } from '@/lib/workspace'
import { Logo } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

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

// Which section a page belongs to: the workspace's own, or for a profile
// (/sponsors/…) the section its list lives in.
function activeSection(view: WorkspaceView, pathname: string): string | null {
  if (view.inWorkspace) return view.section || ''
  const m = pathname.match(/^\/(sponsors|partners|speakers|delegates)(\/|$)/)
  return m ? m[1] : null
}

// The groups, in order: Overview on its own, then Directory, Sales, Event,
// Marketing (from the portal's sections), then the tools.
function groupsOf(view: WorkspaceView) {
  const out: { key: string; label: string; sections: PortalSection[] }[] = []
  for (const s of view.portal?.sections ?? []) {
    const key = s.group ?? s.label
    const last = out[out.length - 1]
    if (last && last.key === key) last.sections.push(s)
    else out.push({ key, label: key, sections: [s] })
  }
  out.push({ key: 'Tools', label: 'Tools', sections: TOOLS })
  return out
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    window.location.assign('/login')
  }
}

// Two rows, like a booking dashboard: the groups as pill tabs with search
// beside them, then the open event and edition with the group's own tabs.
// Phones keep the drawer (<Sidebar>) for the sections.
export function Topbar({ view, title, onMenu }: { view: WorkspaceView; title?: string; onMenu: () => void }) {
  const pathname = usePathname()
  const { portal, slug, year } = view
  const current = activeSection(view, pathname)
  const groups = groupsOf(view)
  const isTool = TOOLS.some((t) => pathname.startsWith(t.path))
  const activeGroup = groups.find((g) => (g.key === 'Tools' ? isTool : !isTool && g.sections.some((s) => s.path === current)))
  const href = (s: PortalSection) => (TOOLS.includes(s) ? s.path : portal && slug ? workspaceHref(portal.key, slug, s.path, year ?? undefined) : '/')

  return (
    <header className="crm-top sticky top-0 z-40 shrink-0">
      <div className="h-14 flex items-center gap-2 sm:gap-3 px-3 lg:px-6">
        <button onClick={onMenu} className="ws-btn ws-btn-ghost ws-btn-sm lg:hidden -ml-1" aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </button>
        <Logo compact />
        {portal && slug && (
          <nav className="crm-pills hidden lg:flex" aria-label="Areas">
            {groups.map((g) => {
              const active = g === activeGroup
              return (
                <Link key={g.key} href={href(g.sections[0])} data-active={active} aria-current={active ? 'page' : undefined}>
                  {active && <span className="crm-pill-bg" aria-hidden="true" />}
                  <span className="relative">{g.label}</span>
                </Link>
              )
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <GlobalSearch />
          <span className="hidden lg:inline-flex"><ThemeToggle /></span>
          <button onClick={logout} className="ws-btn ws-btn-ghost ws-btn-sm hidden lg:inline-flex" title="Log out" aria-label="Log out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="crm-context h-12 flex items-center gap-2 sm:gap-3 px-3 lg:px-6">
        <EventSwitcher view={view} />
        <Editions view={view} />
        {activeGroup && activeGroup.sections.length > 1 ? (
          <nav className="crm-tabs hidden lg:flex" aria-label={activeGroup.label}>
            {activeGroup.sections.map((s) => {
              const active = TOOLS.includes(s) ? pathname.startsWith(s.path) : s.path === current
              return (
                <Link key={s.key} href={href(s)} data-active={active} aria-current={active ? 'page' : undefined}>{s.label}</Link>
              )
            })}
          </nav>
        ) : null}
        {title && !view.inWorkspace && (
          <span className="hidden md:inline text-[13px] truncate ml-auto" style={{ color: 'var(--fg-3)' }}>{activeGroup ? `${activeGroup.label} · ` : ''}{title}</span>
        )}
      </div>
    </header>
  )
}
