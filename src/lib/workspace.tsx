'use client'

// Where the admin is in the CRM: which portal, which event, which edition.
//
// Read from the URL (/{portal}/{event-slug}/{section}?year=YYYY) and, on
// pages outside a workspace (a sponsor profile, the import tool), from the
// last workspace visited — so the sidebar keeps showing the editions and
// sections the admin came from, and "back" always has somewhere to go.

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEventCategories, type EventCategory } from '@/lib/eventCategories'
import {
  PORTALS, type LastWorkspace, type PortalDef, type PortalKey,
  categoryFromSlug, defaultYear, editionYears, eventLook, labelsForEdition, portalForPath,
  readLastWorkspace, writeLastWorkspace, workspaceHref,
} from '@/lib/portals'

export interface WorkspaceView {
  /** True when the URL itself is a workspace route */
  inWorkspace: boolean
  portal: PortalDef | null
  slug: string | null
  category: EventCategory | null
  section: string
  year: string | null
  years: string[]
  /** Raw event labels a query should match for the current edition */
  labels: string[]
  categories: EventCategory[]
  /** Navigate within the workspace, keeping what isn't changed */
  go: (opts: { section?: string; year?: string }) => void
  href: (section?: string, year?: string) => string
}

const WORKSPACE_RX = /^\/(sales|production|marketing)\/([^/]+)(?:\/([^/?#]+))?/

export function useWorkspaceFromUrl(): WorkspaceView {
  const pathname = usePathname()
  const search = useSearchParams()
  const router = useRouter()
  const categories = useEventCategories()
  const yearParam = search.get('year')

  // The remembered workspace lives in localStorage, which the server cannot
  // see. It is read after mount so the first client render matches the
  // server's — otherwise a profile page would hydrate against different
  // sidebar markup and React would throw the whole tree away.
  const [last, setLast] = useState<LastWorkspace | null>(null)
  useEffect(() => {
    setLast(readLastWorkspace())
  }, [pathname])

  const view = useMemo<Omit<WorkspaceView, 'go' | 'href'>>(() => {
    const m = pathname.match(WORKSPACE_RX)
    const portalKey: PortalKey | null =
      (m?.[1] as PortalKey | undefined) ?? portalForPath(pathname) ?? last?.portal ?? null
    const slug = m?.[2] ?? last?.event ?? null
    const section = m?.[3] ?? ''
    const category = slug ? categoryFromSlug(slug, categories) ?? null : null
    const portal = portalKey ? PORTALS[portalKey] : null
    const years = category ? editionYears(category) : []
    let year: string | null = null
    if (category && portal) {
      const remembered = last && last.event === slug ? last.year : undefined
      year = (m ? yearParam : null) ?? remembered ?? defaultYear(portal.key, category)
      if (!years.includes(year)) years.push(year)
    }
    const labels = category && year ? labelsForEdition(category, year) : []
    return { inWorkspace: !!m, portal, slug, category, section, year, years, labels, categories }
  }, [pathname, yearParam, categories, last])

  // Remember the workspace whenever the admin is inside one.
  useEffect(() => {
    if (view.inWorkspace && view.portal && view.slug) {
      const next = { portal: view.portal.key, event: view.slug, year: view.year ?? undefined }
      writeLastWorkspace(next)
      setLast(next)
    }
  }, [view.inWorkspace, view.portal, view.slug, view.year])

  const href = (section?: string, year?: string) => {
    if (!view.portal || !view.slug) return '/'
    return workspaceHref(view.portal.key, view.slug, section ?? view.section, year ?? view.year ?? undefined)
  }
  const go = (opts: { section?: string; year?: string }) => router.push(href(opts.section, opts.year))

  return { ...view, go, href }
}

const WorkspaceContext = createContext<WorkspaceView | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const view = useWorkspaceFromUrl()
  // The event's own colour (London blue, Boston pink, Pharma green) becomes
  // the accent while inside its workspace — see [data-event] in globals.css.
  useEffect(() => {
    const key = view.category ? eventLook(view.category.name).key : null
    if (key && key !== 'other') document.documentElement.setAttribute('data-event', key)
    else document.documentElement.removeAttribute('data-event')
    return () => document.documentElement.removeAttribute('data-event')
  }, [view.category?.name])
  return <WorkspaceContext.Provider value={view}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceView {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside a WorkspaceProvider')
  return ctx
}

// ── Theme ────────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark'

export function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function applyTheme(t: Theme) {
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  else document.documentElement.removeAttribute('data-theme')
  try {
    localStorage.setItem('crm.theme', t)
  } catch {
    /* ignore */
  }
}
