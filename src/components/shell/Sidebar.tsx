'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, LogOut, X } from 'lucide-react'
import { TOOLS, eventLook, workspaceHref, type PortalSection } from '@/lib/portals'
import type { WorkspaceView } from '@/lib/workspace'
import { ThemeToggle } from './ThemeToggle'

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    window.location.assign('/login')
  }
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" title="Choose an event">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/wng-emblem.png" alt="World Nexus Group" width={30} height={30} className="shrink-0" />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Nexus CRM</span>
          <span className="block text-[11px]" style={{ color: 'var(--fg-4)' }}>World Nexus Group</span>
        </span>
      )}
    </Link>
  )
}

// The sections in order, each run of the same heading together.
function groupSections(sections: PortalSection[]) {
  const out: { group?: string; sections: PortalSection[] }[] = []
  for (const s of sections) {
    const last = out[out.length - 1]
    if (last && last.group === s.group) last.sections.push(s)
    else out.push({ group: s.group, sections: [s] })
  }
  return out
}

export function Sidebar({ view, onClose }: { view: WorkspaceView; onClose?: () => void }) {
  const pathname = usePathname()
  const { portal, category, slug, year, years, section, inWorkspace } = view
  const look = category ? eventLook(category.name) : null
  const now = new Date().getFullYear()

  return (
    <aside className="flex flex-col h-full w-[256px] shrink-0" style={{ background: 'var(--surface)', borderRight: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
        <Logo />
        {onClose && (
          <button onClick={onClose} className="ws-btn ws-btn-ghost ws-btn-sm lg:hidden" aria-label="Close menu">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
        {/* Where we are, and the way to another event */}
        {portal && look ? (
          <div className="px-2">
            <p className="text-[14px] font-semibold leading-snug pl-3 relative" style={{ color: 'var(--fg)' }}>
              <span className="absolute left-0 top-0.5 bottom-0.5 w-[3px] rounded-full" style={{ background: look.accent }} />
              {look.series}
              <span className="block text-[12.5px] font-medium" style={{ color: look.accentInk }}>{look.city}</span>
            </p>
            <Link href="/" className="inline-block mt-2 text-[12px] hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>Change event</Link>
          </div>
        ) : (
          <Link href="/" className="px-2 block">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Choose an event</p>
            <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--fg-3)' }}>Everything for it is in one place.</p>
          </Link>
        )}

        {/* Editions: a year switch, oldest to newest, and a word on the one open */}
        {portal && category && slug && years.length > 0 && (
          <nav className="px-2">
            <p className="ws-label">Edition</p>
            <div className="ws-seg" role="tablist" aria-label="Edition">
              {[...years].sort().map((y) => (
                <Link
                  key={y}
                  href={workspaceHref(portal.key, slug, inWorkspace ? section : '', y)}
                  className="ws-seg-item"
                  role="tab"
                  aria-selected={y === year}
                  data-active={y === year}
                  data-past={Number(y) < now}
                  onClick={onClose}
                >
                  {y}
                </Link>
              ))}
            </div>
            {year && (
              <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--fg-4)' }}>
                {Number(year) < now ? 'Past edition' : Number(year) === now ? 'This year' : Number(year) === now + 1 ? 'Next edition' : 'Planning ahead'}
              </p>
            )}
          </nav>
        )}

        {/* Sections, under their headings (Sales, People, Programme, Marketing) */}
        {portal && slug && (
          <nav className="flex flex-col gap-4">
            {groupSections(portal.sections).map(({ group, sections }) => (
              <div key={group ?? 'top'}>
                {group && <p className="ws-label px-2">{group}</p>}
                <div className="flex flex-col gap-0.5">
                  {sections.map((s) => {
                    const active = inWorkspace && (section || '') === s.path
                    const Icon = s.icon
                    return (
                      <Link key={s.key} href={workspaceHref(portal.key, slug, s.path, year ?? undefined)} className="ws-nav-item" data-active={active} onClick={onClose}>
                        <Icon className="w-4 h-4 shrink-0" style={{ color: active ? 'var(--fg)' : 'var(--fg-4)' }} />
                        {s.label}
                        {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--fg-4)' }} />}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        )}

        {/* Tools — the same for every event */}
        <nav>
          <p className="ws-label px-2">Tools</p>
          <div className="flex flex-col gap-0.5">
            {TOOLS.map((t) => {
              const active = pathname.startsWith(t.path)
              const Icon = t.icon
              return (
                <Link key={t.key} href={t.path} className="ws-nav-item" data-active={active} onClick={onClose}>
                  <Icon className="w-4 h-4 shrink-0" style={{ color: active ? 'var(--fg)' : 'var(--fg-4)' }} />
                  {t.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      <div className="px-3 py-3 flex items-center justify-between gap-2 shrink-0" style={{ borderTop: '1px solid var(--line)' }}>
        <ThemeToggle />
        <button onClick={logout} className="ws-btn ws-btn-ghost ws-btn-sm" title="Log out">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </aside>
  )
}
