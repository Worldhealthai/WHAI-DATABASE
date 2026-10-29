'use client'

// The bar over every screen: the areas as pill tabs, search; then which
// event and edition is open (the one place either is chosen) and the open
// area's own tabs. On phones the sections are in the drawer.

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { BookUser, Check, ChevronDown, LayoutGrid, LogOut, Menu } from 'lucide-react'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import { DIRECTORY_PATH, LIST_OF, TOOLS, defaultYear, eventLook, eventSlug, workspaceHref, type PortalSection } from '@/lib/portals'
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
// A list view counts as its board (LIST_OF).
function activeSection(view: WorkspaceView, pathname: string): string | null {
  const section = view.inWorkspace ? view.section || '' : pathname.match(/^\/(sponsors|partners|speakers|delegates)(\/|$)/)?.[1] ?? null
  return section !== null ? LIST_OF[section] ?? section : null
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

// The areas as pills on a frosted track, with one glass pill that slides to
// the open area (measured from the links, so it fits each label).
function AreaPills({ items }: { items: { key: string; label: string; href: string; active: boolean }[] }) {
  const nav = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  const [ready, setReady] = useState(false)
  // The area clicked moves the pill at once, before its page has loaded.
  const [clicked, setClicked] = useState<{ key: string; from: string | null } | null>(null)
  const current = items.find((i) => i.active)?.key ?? null
  const activeKey = clicked && clicked.from === current ? clicked.key : current
  useLayoutEffect(() => {
    const place = () => {
      const el = nav.current?.querySelector<HTMLElement>(`a[data-key="${activeKey}"]`)
      setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [activeKey])
  // Slide only after the first placement, so it does not fly in on load.
  useEffect(() => { if (pill && !ready) requestAnimationFrame(() => setReady(true)) }, [pill, ready])
  return (
    <nav ref={nav} className="crm-pills hidden lg:flex relative" aria-label="Areas">
      {pill && <span className="crm-pill-glass" data-ready={ready} aria-hidden="true" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />}
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          data-key={i.key}
          data-active={i.key === activeKey}
          aria-current={i.active ? 'page' : undefined}
          onClick={() => setClicked({ key: i.key, from: current })}
        >
          <span className="relative">{i.label}</span>
        </Link>
      ))}
    </nav>
  )
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
      {/* Logo | the areas, centred | search */}
      <div className="h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 px-3 lg:px-6">
        <div className="flex items-center gap-2">
          <button onClick={onMenu} className="ws-btn ws-btn-ghost ws-btn-sm lg:hidden -ml-1" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <Logo compact />
        </div>
        {portal && slug ? (
          <AreaPills
            items={groups.map((g) => ({ key: g.key, label: g.label, href: href(g.sections[0]), active: g === activeGroup }))}
          />
        ) : <span />}
        <div className="flex items-center justify-end gap-1.5">
          {portal && slug && (
            <Link
              href={workspaceHref(portal.key, slug, DIRECTORY_PATH, year ?? undefined)}
              className="crm-dir"
              data-active={current === DIRECTORY_PATH}
              aria-current={current === DIRECTORY_PATH ? 'page' : undefined}
              title="Every company in every event"
            >
              <BookUser className="w-4 h-4" /> <span className="hidden sm:inline">Directory</span>
            </Link>
          )}
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
