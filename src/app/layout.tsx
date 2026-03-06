import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { QueryProvider } from '@/components/layout/QueryProvider'

export const metadata: Metadata = {
  title: 'WHAI Intelligence Hub',
  description: 'World Health AI Healthcare Intelligence Database — Contacts, Companies, Deals & Insights',
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
            <main className="flex-1">
              {children}
            </main>
          </div>
        </QueryProvider>
      </body>
    </html>
  )
}
