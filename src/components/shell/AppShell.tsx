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
import { useWorkspaceFromUrl } from '@/lib/workspace'
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

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const view = useWorkspaceFromUrl()
  const [menuOpen, setMenuOpen] = useState(false)
  const title = TITLES.find(([rx]) => rx.test(pathname))?.[1]

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
