'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { Users, Building2, TrendingUp, BookOpen, Database } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/deals', label: 'Deals', icon: TrendingUp },
  { href: '/insights', label: 'Insights', icon: BookOpen },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-[#1a3a5c] bg-[#0A1628]/95 backdrop-blur-sm">
      <div className="flex items-center h-14 px-4 gap-6 max-w-screen-2xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded bg-[#00B4D8] flex items-center justify-center">
            <Database className="w-4 h-4 text-[#0A1628]" />
          </div>
          <span className="font-bold text-sm tracking-wide text-white">
            WHAI<span className="text-[#00B4D8]">.</span>
          </span>
        </Link>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors',
                  active
                    ? 'bg-[#00B4D8]/15 text-[#00B4D8]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Global search */}
        <div className="flex-1 max-w-lg">
          <GlobalSearch />
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#00B4D8]/20 text-[#00B4D8] border border-[#00B4D8]/30 font-medium">
            Pro
          </span>
          <div className="w-7 h-7 rounded-full bg-[#1a3a5c] flex items-center justify-center text-xs font-semibold text-white">
            WH
          </div>
        </div>
      </div>
    </header>
  )
}
