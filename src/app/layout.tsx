import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Navbar, MobileBottomNav } from '@/components/layout/Navbar'
import { QueryProvider } from '@/components/layout/QueryProvider'
import { AIAssistant } from '@/components/crm/AIAssistant'

export const metadata: Metadata = {
  title: 'WHAI CRM',
  description: 'World Health AI Events CRM — Delegates, Speakers & Sponsors',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0A1628] text-white antialiased">
        <QueryProvider>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 pb-16 md:pb-0">
              {children}
            </main>
            <MobileBottomNav />
            <AIAssistant />
          </div>
        </QueryProvider>
      </body>
    </html>
  )
}
