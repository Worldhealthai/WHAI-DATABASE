'use client'

import { usePathname } from 'next/navigation'
import { Navbar, MobileBottomNav } from './Navbar'
import { AIAssistant } from '@/components/crm/AIAssistant'

// Renders the full app chrome (navbar, bottom nav, AI assistant) around the
// page — except on the login screen, which renders bare.
export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <main className="min-h-screen">{children}</main>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <MobileBottomNav />
      <AIAssistant />
    </div>
  )
}
