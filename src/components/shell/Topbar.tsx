'use client'

import Link from 'next/link'
import { ChevronRight, Menu } from 'lucide-react'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import { eventLook, workspaceHref } from '@/lib/portals'
import type { WorkspaceView } from '@/lib/workspace'

export function Topbar({ view, title, onMenu }: { view: WorkspaceView; title?: string; onMenu: () => void }) {
  const { portal, category, slug, year, section, inWorkspace } = view
  const look = category ? eventLook(category.name) : null
  const sectionDef = portal?.sections.find((s) => s.path === (section || ''))

  const crumbs: { label: string; href?: string; dot?: string }[] = []
  if (portal) crumbs.push({ label: portal.name, href: `/?portal=${portal.key}` })
  if (portal && slug && look) crumbs.push({ label: `${look.series} ${look.city}`, href: workspaceHref(portal.key, slug, '', year ?? undefined), dot: look.accent })
  if (portal && slug && year) crumbs.push({ label: year, href: workspaceHref(portal.key, slug, '', year) })
  if (inWorkspace && sectionDef) crumbs.push({ label: sectionDef.label })
  else if (title) crumbs.push({ label: title })

  return (
    <header
      className="sticky top-0 z-40 h-14 shrink-0 flex items-center gap-3 px-4 lg:px-6"
      style={{ background: 'color-mix(in srgb, var(--surface) 88%, transparent)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line)' }}
    >
      <button onClick={onMenu} className="ws-btn ws-btn-ghost ws-btn-sm lg:hidden -ml-1" aria-label="Open menu">
        <Menu className="w-5 h-5" />
      </button>

      <nav className="flex items-center gap-1 min-w-0 text-[13px]" aria-label="Breadcrumb">
        {crumbs.length === 0 && <span style={{ color: 'var(--fg-3)' }}>Nexus CRM</span>}
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--fg-4)' }} />}
              {c.dot && <span className="w-2 h-2 rounded-full shrink-0 mr-0.5" style={{ background: c.dot }} />}
              {c.href && !last ? (
                <Link href={c.href} className="truncate hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
                  {c.label}
                </Link>
              ) : (
                <span className="truncate font-semibold" style={{ color: 'var(--fg)' }}>{c.label}</span>
              )}
            </span>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
      </div>
    </header>
  )
}
