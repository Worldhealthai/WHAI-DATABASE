'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, X } from 'lucide-react'
import { TOOLS, workspaceHref, type PortalSection } from '@/lib/portals'
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
  const { portal, slug, year, section, inWorkspace } = view

  // Navigation only: which event and edition is open lives in the top bar.
  return (
    <aside className="crm-side flex flex-col h-full w-[232px] shrink-0">
      <div className="flex items-center justify-between px-4 h-14 shrink-0">
        <Logo />
        {onClose && (
          <button onClick={onClose} className="ws-btn ws-btn-ghost ws-btn-sm lg:hidden" aria-label="Close menu">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-4 flex flex-col gap-5">
        {/* Sections, under their headings (Sales, People, Programme, Marketing) */}
        {portal && slug ? (
          <nav className="flex flex-col gap-4" aria-label="Sections">
            {groupSections(portal.sections).map(({ group, sections }) => (
              <div key={group ?? 'top'}>
                {group && <p className="crm-side-label">{group}</p>}
                <div className="flex flex-col gap-px">
                  {sections.map((s) => {
                    const active = inWorkspace && (section || '') === s.path
                    const Icon = s.icon
                    return (
                      <Link key={s.key} href={workspaceHref(portal.key, slug, s.path, year ?? undefined)} className="ws-nav-item" data-active={active} aria-current={active ? 'page' : undefined} onClick={onClose}>
                        <Icon className="w-4 h-4 shrink-0" />
                        {s.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        ) : (
          <Link href="/" className="ws-nav-item" onClick={onClose}>Choose an event</Link>
        )}

        {/* Tools — the same for every event */}
        <nav aria-label="Tools">
          <p className="crm-side-label">Tools</p>
          <div className="flex flex-col gap-px">
            {TOOLS.map((t) => {
              const active = pathname.startsWith(t.path)
              const Icon = t.icon
              return (
                <Link key={t.key} href={t.path} className="ws-nav-item" data-active={active} aria-current={active ? 'page' : undefined} onClick={onClose}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {t.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      <div className="px-3 py-3 flex items-center justify-between gap-2 shrink-0">
        <ThemeToggle />
        <button onClick={logout} className="ws-btn ws-btn-ghost ws-btn-sm" title="Log out">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </aside>
  )
}
