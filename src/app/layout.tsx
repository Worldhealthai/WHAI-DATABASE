import type { Metadata, Viewport } from 'next'
import './globals.css'
import { QueryProvider } from '@/components/layout/QueryProvider'
import { AppShell } from '@/components/shell/AppShell'

export const metadata: Metadata = {
  title: 'Nexus CRM',
  icons: { icon: '/wng-icon-192.png', apple: '/apple-icon.png' },
  description: 'World Nexus Group CRM — sales pipeline, sponsors, partners, speakers and delegates for every event.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

// Apply the saved theme before the first paint so a dark-mode user never
// sees a white flash. `?theme=dark|light` on the URL wins and is remembered —
// that is how the admin panel's embed keeps the CRM in step with its own mode.
const themeBoot = `(function(){try{var q=new URLSearchParams(location.search).get('theme');var t=localStorage.getItem('crm.theme');if(q==='dark'||q==='light'){t=q;localStorage.setItem('crm.theme',t)}if(t==='dark'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-screen antialiased">
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  )
}
