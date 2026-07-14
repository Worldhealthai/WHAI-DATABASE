import type { Metadata, Viewport } from 'next'
import './globals.css'
import { QueryProvider } from '@/components/layout/QueryProvider'
import { Chrome } from '@/components/layout/Chrome'

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
          <Chrome>{children}</Chrome>
        </QueryProvider>
      </body>
    </html>
  )
}
