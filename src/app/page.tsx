'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Building2, TrendingUp, BookOpen, ArrowRight, Database } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Stats {
  contacts: number
  companies: number
  deals: number
  insights: number
}

const MODULES = [
  {
    href: '/contacts',
    label: 'Contacts',
    description: 'Healthcare executives, KOLs, and decision-makers with advanced screening by seniority, function, vertical, and engagement.',
    icon: Users,
    color: 'text-[#00B4D8]',
    bg: 'from-[#00B4D8]/10 to-transparent',
    border: 'border-[#00B4D8]/20 hover:border-[#00B4D8]/50',
    stat: 'contacts' as const,
    statLabel: 'contacts',
  },
  {
    href: '/companies',
    label: 'Companies',
    description: 'Pharma, biotech, health IT, CROs, investors and more — with linked contacts, deals, and vertical classifications.',
    icon: Building2,
    color: 'text-purple-400',
    bg: 'from-purple-400/10 to-transparent',
    border: 'border-purple-400/20 hover:border-purple-400/50',
    stat: 'companies' as const,
    statLabel: 'companies',
  },
  {
    href: '/deals',
    label: 'Deals',
    description: 'M&A, VC rounds, PE buyouts, licensing deals and IPOs across the healthcare ecosystem. Track announced and completed transactions.',
    icon: TrendingUp,
    color: 'text-green-400',
    bg: 'from-green-400/10 to-transparent',
    border: 'border-green-400/20 hover:border-green-400/50',
    stat: 'deals' as const,
    statLabel: 'deals',
  },
  {
    href: '/insights',
    label: 'Insights & Trends',
    description: 'Market reports, analysis and data snapshots from WHAI researchers covering digital health, pharma, AI, and more.',
    icon: BookOpen,
    color: 'text-amber-400',
    bg: 'from-amber-400/10 to-transparent',
    border: 'border-amber-400/20 hover:border-amber-400/50',
    stat: 'insights' as const,
    statLabel: 'articles',
  },
]

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const endpoints = [
          '/api/contacts?pageSize=1',
          '/api/companies?pageSize=1',
          '/api/deals?pageSize=1',
          '/api/insights?pageSize=1',
        ]

        const results = await Promise.all(
          endpoints.map(async (url) => {
            try {
              const res = await fetch(url)
              if (!res.ok) return 0
              const json = await res.json()
              return json.total ?? 0
            } catch {
              return 0
            }
          })
        )

        if (!cancelled) {
          setStats({
            contacts: results[0],
            companies: results[1],
            deals: results[2],
            insights: results[3],
          })
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00B4D8]/10 border border-[#00B4D8]/20 text-[#00B4D8] text-xs font-medium mb-2">
          <Database className="w-3 h-3" /> World Health AI Intelligence Hub
        </div>
        <h1 className="text-4xl font-bold text-white leading-tight">
          Healthcare Intelligence,<br />
          <span className="text-[#00B4D8]">Purpose-Built for the Industry</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Advanced screening for healthcare contacts, companies, deals and market insights.
          The intelligence layer for healthcare executives, investors and solution providers.
        </p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {MODULES.map((mod) => {
          const Icon = mod.icon
          const count = stats?.[mod.stat] ?? 0
          return (
            <Link key={mod.href} href={mod.href}
              className={cn(
                'whai-card p-6 group transition-all bg-gradient-to-br',
                mod.bg, mod.border,
              )}
            >
              <div className="flex items-start justify-between">
                <div className={cn('p-2 rounded-lg bg-current/10 mb-4', mod.color)}>
                  <Icon className={cn('w-5 h-5', mod.color)} />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
              </div>
              <div className={cn('text-2xl font-bold mb-0.5', mod.color)}>
                {loading ? (
                  <span className="inline-block w-12 h-7 rounded bg-slate-700/50 animate-pulse" />
                ) : (
                  count.toLocaleString()
                )}
              </div>
              <div className="text-xs text-slate-500 mb-3">{mod.statLabel} in database</div>
              <h2 className="text-lg font-semibold text-white mb-2">{mod.label}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{mod.description}</p>
            </Link>
          )
        })}
      </div>

      {/* Feature callouts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border pt-8">
        {[
          { label: 'Advanced Screening', desc: 'Composable filters with AND/OR logic across seniority, vertical, region, department and more' },
          { label: 'Live Result Counts', desc: 'Dynamic record counts update as you apply filters — no page reloads' },
          { label: 'CSV Export', desc: 'Export any filtered result set to CSV with full contact and company data' },
        ].map((f) => (
          <div key={f.label} className="text-center p-4">
            <div className="text-sm font-semibold text-white mb-1">{f.label}</div>
            <div className="text-xs text-slate-500 leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
