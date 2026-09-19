'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, LogOut, X } from 'lucide-react'
import { TOOLS, eventLook, workspaceHref } from '@/lib/portals'
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
    <Link href="/" className="flex items-center gap-2.5" title="Choose a portal">
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
        {/* Where we are, and the two ways to go somewhere else */}
        {portal ? (
          <div className="px-2">
            <p className="text-[11px] font-medium" style={{ color: 'var(--fg-4)' }}>{portal.name}</p>
            {look ? (
              <p className="text-[14px] font-semibold mt-0.5 leading-snug" style={{ color: 'var(--fg)' }}>
                {look.series}
                <span className="block text-[12.5px] font-normal" style={{ color: 'var(--fg-3)' }}>{look.city}</span>
              </p>
            ) : (
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--fg-3)' }}>No event chosen</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[12px]">
              <Link href={`/?portal=${portal.key}`} className="hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>Change event</Link>
              <Link href="/" className="hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>Change portal</Link>
            </div>
          </div>
        ) : (
          <Link href="/" className="px-2 block">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Choose a portal</p>
            <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--fg-3)' }}>Sales or Production, then an event.</p>
          </Link>
        )}

        {/* Editions */}
        {portal && category && slug && years.length > 0 && (
          <nav>
            <p className="ws-label px-2">Editions</p>
            <div className="flex flex-col gap-0.5">
              {years.map((y) => {
                const active = y === year
                const upcoming = Number(y) > now
                return (
                  <Link key={y} href={workspaceHref(portal.key, slug, inWorkspace ? section : '', y)} className="ws-nav-item justify-between" data-active={active} onClick={onClose}>
                    <span>{y}</span>
                    {upcoming && <span className="text-[11px] font-normal" style={{ color: 'var(--fg-4)' }}>{y === String(now + 1) ? 'next' : 'planning'}</span>}
                  </Link>
                )
              })}
            </div>
          </nav>
        )}

        {/* Sections */}
        {portal && slug && (
          <nav>
            <p className="ws-label px-2">{portal.short}</p>
            <div className="flex flex-col gap-0.5">
              {portal.sections.map((s) => {
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
          </nav>
        )}

        {/* Tools — the same in every portal */}
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
