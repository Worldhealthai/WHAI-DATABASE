'use client'

// The frame around every screen.
//
// Login and the entrance (portal → event) render bare: they are full-screen
// moments, not pages inside the app. Everything else gets the sidebar (where
// you are, the editions, the sections, the tools) and the top bar (the trail
// back out, search). The old-style pages — profiles, import, triage — live
// inside the same frame, with the sidebar still showing the workspace the
// admin came from.

import { Suspense, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AIAssistant } from '@/components/crm/AIAssistant'
import { useRouter } from 'next/navigation'
import { useWorkspaceFromUrl } from '@/lib/workspace'
import { defaultYear, eventSlug, readLastWorkspace, workspaceHref, type PortalKey } from '@/lib/portals'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const BARE = new Set(['/login', '/'])

const TITLES: [RegExp, string][] = [
  [/^\/import/, 'Import'],
  [/^\/unassigned/, 'Triage inbox'],
  [/^\/migrate-prospecting/, 'Migrate prospecting'],
  [/^\/sponsors\/[^/]+/, 'Sponsor'],
  [/^\/partners\/[^/]+/, 'Partner'],
  [/^\/speakers\/[^/]+/, 'Speaker'],
  [/^\/delegates\/[^/]+/, 'Delegate'],
  [/^\/sponsors/, 'All sponsors'],
  [/^\/partners/, 'All partners'],
  [/^\/speakers/, 'All speakers'],
  [/^\/delegates/, 'All delegates'],
]

// The old flat lists live on under these paths (a profile's "back" link,
// the import tool, an old bookmark). They now land in the workspace for the
// event the admin was last in, so the old list never reappears.
const OLD_LISTS: Record<string, { portal: PortalKey; section: string }> = {
  '/sponsors': { portal: 'sales', section: 'sponsors' },
  '/partners': { portal: 'sales', section: 'partners' },
  '/speakers': { portal: 'production', section: 'speakers' },
  '/delegates': { portal: 'production', section: 'delegates' },
}

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const view = useWorkspaceFromUrl()
  const [menuOpen, setMenuOpen] = useState(false)
  const title = TITLES.find(([rx]) => rx.test(pathname))?.[1]

  const oldList = OLD_LISTS[pathname.replace(/\/$/, '')]
  useEffect(() => {
    if (!oldList) return
    const last = readLastWorkspace()
    const category = last ? view.categories.find((c) => eventSlug(c.name) === last.event) : undefined
    const target = category ?? view.categories.find((c) => c.name !== 'Other events')
    if (!target) return
    const year = last && category ? last.year : defaultYear(oldList.portal, target)
    router.replace(workspaceHref(oldList.portal, eventSlug(target.name), oldList.section, year))
  }, [oldList, view.categories, router])

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen">
        <Sidebar view={view} />
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 anim-fade-in" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 anim-fade-in">
            <Sidebar view={view} onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar view={view} title={title} onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <AIAssistant />
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (BARE.has(pathname)) {
    return <main className="min-h-screen">{children}</main>
  }
  return (
    <Suspense fallback={<main className="min-h-screen">{children}</main>}>
      <Frame>{children}</Frame>
    </Suspense>
  )
}
