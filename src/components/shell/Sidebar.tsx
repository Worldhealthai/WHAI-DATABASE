'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftRight, ChevronRight, LogOut, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PORTALS, TOOLS, eventLook, workspaceHref } from '@/lib/portals'
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
    <Link href="/" className="flex items-center gap-2.5 group" title="Choose a portal">
      <span
        className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--teal) 0%, #0b3b5c 100%)', boxShadow: 'var(--shadow-sm)' }}
      >
        <Sparkles className="w-4 h-4 text-white" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[14px] font-semibold display" style={{ color: 'var(--fg)' }}>Nexus CRM</span>
          <span className="block text-[10.5px] tracking-wide uppercase" style={{ color: 'var(--fg-4)' }}>World Nexus Group</span>
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
    <aside
      className="flex flex-col h-full w-[264px] shrink-0"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--line)' }}
    >
      <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
        <Logo />
        {onClose && (
          <button onClick={onClose} className="ws-btn ws-btn-ghost ws-btn-sm lg:hidden" aria-label="Close menu">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        {/* Where we are: portal + event, each with a way to change it */}
        {portal ? (
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-ink)' }}>
                  {portal.name}
                </p>
                {look ? (
                  <p className="text-[13.5px] font-semibold leading-snug mt-0.5" style={{ color: 'var(--fg)' }}>
                    {look.series}
                    <span className="block text-[12px] font-medium" style={{ color: 'var(--fg-3)' }}>{look.city} · {look.country}</span>
                  </p>
                ) : (
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--fg-3)' }}>No event chosen</p>
                )}
              </div>
              {look && (
                <span
                  className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: look.gradient }}
                >
                  {look.short}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2.5">
              <Link href={`/?portal=${portal.key}`} className="ws-btn ws-btn-sm flex-1" title="Choose a different event">
                <ArrowLeftRight className="w-3.5 h-3.5" /> Switch event
              </Link>
              <Link href="/" className="ws-btn ws-btn-ghost ws-btn-sm" title="Choose a different portal">
                Portal
              </Link>
            </div>
          </div>
        ) : (
          <Link href="/" className="rounded-xl p-3 block" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }}>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--accent-ink)' }}>Choose a portal</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--fg-3)' }}>Sales or Production, then an event.</p>
          </Link>
        )}

        {/* Editions */}
        {portal && category && slug && years.length > 0 && (
          <nav>
            <p className="ws-label px-2">Editions</p>
            <div className="flex flex-col gap-0.5">
              {years.map((y) => {
                const active = y === year
                const count = (category.labelsByYear[y] ?? []).length
                const upcoming = Number(y) > now
                const href = workspaceHref(portal.key, slug, inWorkspace ? section : '', y)
                return (
                  <Link key={y} href={href} className="ws-nav-item justify-between" data-active={active}>
                    <span className="flex items-center gap-2.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: active ? 'var(--accent)' : upcoming ? 'var(--warn)' : 'var(--line-3)' }}
                      />
                      {y}
                    </span>
                    <span className="text-[10.5px] font-medium" style={{ color: active ? 'var(--accent-ink)' : 'var(--fg-4)' }}>
                      {upcoming ? (y === String(now + 1) ? 'next' : 'planning') : count === 0 ? 'no records' : ''}
                    </span>
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
                  <Link
                    key={s.key}
                    href={workspaceHref(portal.key, slug, s.path, year ?? undefined)}
                    className="ws-nav-item"
                    data-active={active}
                    onClick={onClose}
                  >
                    <Icon className="w-4 h-4 shrink-0" style={{ color: active ? 'var(--accent-ink)' : 'var(--fg-4)' }} />
                    {s.label}
                    {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--accent-ink)' }} />}
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
                  <Icon className="w-4 h-4 shrink-0" style={{ color: active ? 'var(--accent-ink)' : 'var(--fg-4)' }} />
                  {t.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* The other portal, one click away */}
        {portal && (
          <nav>
            <p className="ws-label px-2">Other portal</p>
            {Object.values(PORTALS)
              .filter((p) => p.key !== portal.key)
              .map((p) => (
                <Link key={p.key} href={`/?portal=${p.key}`} className="ws-nav-item" onClick={onClose}>
                  <span className="w-4 h-4 rounded-md shrink-0" style={{ background: p.accent.fill, opacity: 0.85 }} />
                  {p.name}
                </Link>
              ))}
          </nav>
        )}
      </div>

      <div className="px-3 py-3 flex items-center justify-between gap-2 shrink-0" style={{ borderTop: '1px solid var(--line)' }}>
        <ThemeToggle />
        <button onClick={logout} className={cn('ws-btn ws-btn-ghost ws-btn-sm')} title="Log out">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </aside>
  )
}
