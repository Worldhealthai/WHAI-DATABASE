'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Mic, Award, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/delegates', label: 'Delegates', icon: Users,          color: 'text-[#00B4D8]', activeColor: 'text-[#00B4D8]', activeBg: 'bg-[#00B4D8]/15' },
  { href: '/speakers',  label: 'Speakers',  icon: Mic,            color: 'text-purple-400', activeColor: 'text-purple-400', activeBg: 'bg-purple-400/15' },
  { href: '/sponsors',  label: 'Sponsors',  icon: Award,          color: 'text-amber-400',  activeColor: 'text-amber-400',  activeBg: 'bg-amber-400/15' },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-[#1a3a5c] bg-[#0A1628]/95 backdrop-blur-sm">
      <div className="flex items-center h-14 px-3 sm:px-5 gap-2 sm:gap-6 max-w-screen-2xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded bg-[#00B4D8] flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-[#0A1628]" />
          </div>
          <span className="font-bold text-sm tracking-wide text-white hidden sm:inline">
            WHAI <span className="text-[#00B4D8]">CRM</span>
          </span>
        </Link>

        {/* Nav tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, activeColor, activeBg }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors',
                  active
                    ? `${activeBg} ${activeColor}`
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#00B4D8]/20 text-[#00B4D8] border border-[#00B4D8]/30 font-medium hidden sm:inline">
            Internal
          </span>
          <div className="w-7 h-7 rounded-full bg-[#1a3a5c] flex items-center justify-center text-xs font-semibold text-white">
            WH
          </div>
        </div>
      </div>
    </header>
  )
}

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-[#1a3a5c] bg-[#0A1628]/95 backdrop-blur-sm safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        <Link href="/" className={cn(
          'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors',
          pathname === '/' ? 'text-[#00B4D8]' : 'text-slate-500'
        )}>
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        {NAV_ITEMS.map(({ href, label, icon: Icon, activeColor }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors',
                active ? activeColor : 'text-slate-500'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
