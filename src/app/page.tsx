'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Mic, Award, ArrowRight, Plus, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CRMStats {
  delegates: number
  speakers: number
  sponsors: number
  // Status breakdowns
  delegatesByStatus: Record<string, number>
  speakersByStatus: Record<string, number>
  sponsorsByStatus: Record<string, number>
}

const SECTIONS = [
  {
    href: '/delegates',
    label: 'Delegates',
    description: 'Manage event attendees — registration status, ticket types, dietary requirements, and engagement history.',
    icon: Users,
    color: 'text-[#00B4D8]',
    bg: 'from-[#00B4D8]/10 to-transparent',
    border: 'border-[#00B4D8]/20 hover:border-[#00B4D8]/50',
    addHref: '/delegates',
    addLabel: 'Add Delegate',
    addColor: 'bg-[#00B4D8]/15 text-[#00B4D8] hover:bg-[#00B4D8]/25',
    stat: 'delegates' as const,
    keyStatuses: ['Registered', 'Confirmed', 'Attended'],
    statusKey: 'delegatesByStatus' as const,
  },
  {
    href: '/speakers',
    label: 'Speakers',
    description: 'Track speaker pipelines — from prospecting through to contract signed, session details, fees, and logistics.',
    icon: Mic,
    color: 'text-purple-400',
    bg: 'from-purple-400/10 to-transparent',
    border: 'border-purple-400/20 hover:border-purple-400/50',
    addHref: '/speakers',
    addLabel: 'Add Speaker',
    addColor: 'bg-purple-400/15 text-purple-400 hover:bg-purple-400/25',
    stat: 'speakers' as const,
    keyStatuses: ['Confirmed', 'Contracted', 'Speaking Confirmed'],
    statusKey: 'speakersByStatus' as const,
  },
  {
    href: '/sponsors',
    label: 'Sponsors',
    description: 'Manage sponsorship relationships — tier, pipeline stage, contract status, and sponsorship value tracking.',
    icon: Award,
    color: 'text-amber-400',
    bg: 'from-amber-400/10 to-transparent',
    border: 'border-amber-400/20 hover:border-amber-400/50',
    addHref: '/sponsors',
    addLabel: 'Add Sponsor',
    addColor: 'bg-amber-400/15 text-amber-400 hover:bg-amber-400/25',
    stat: 'sponsors' as const,
    keyStatuses: ['Confirmed', 'Contracted', 'Active'],
    statusKey: 'sponsorsByStatus' as const,
  },
]

const STATUS_COLORS: Record<string, string> = {
  'Registered':         'bg-blue-500/20 text-blue-400',
  'Confirmed':          'bg-cyan-500/20 text-cyan-400',
  'Attended':           'bg-green-500/20 text-green-400',
  'Contracted':         'bg-indigo-500/20 text-indigo-400',
  'Speaking Confirmed': 'bg-green-500/20 text-green-400',
  'Active':             'bg-green-500/20 text-green-400',
  'Prospecting':        'bg-slate-500/20 text-slate-400',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<CRMStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [delegates, speakers, sponsors] = await Promise.all([
          fetch('/api/delegates?pageSize=1').then((r) => r.ok ? r.json() : { total: 0, data: [] }),
          fetch('/api/speakers?pageSize=1').then((r) => r.ok ? r.json() : { total: 0, data: [] }),
          fetch('/api/sponsors?pageSize=1').then((r) => r.ok ? r.json() : { total: 0, data: [] }),
        ])

        // Fetch status breakdowns
        const [delegateStatuses, speakerStatuses, sponsorStatuses] = await Promise.all([
          fetch('/api/delegates/stats').then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/speakers/stats').then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/sponsors/stats').then((r) => r.ok ? r.json() : null).catch(() => null),
        ])

        if (!cancelled) {
          setStats({
            delegates: delegates.total,
            speakers: speakers.total,
            sponsors: sponsors.total,
            delegatesByStatus: delegateStatuses?.byStatus ?? {},
            speakersByStatus: speakerStatuses?.byStatus ?? {},
            sponsorsByStatus: sponsorStatuses?.byStatus ?? {},
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
          WHAI Events CRM
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-xl leading-relaxed">
          Manage delegates, speakers, and sponsors across all World Health AI events — from first contact to post-event follow-up.
        </p>
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 gap-5">
        {SECTIONS.map((section) => {
          const Icon = section.icon
          const count = stats?.[section.stat] ?? 0
          const statusBreakdown = stats?.[section.statusKey] ?? {}

          return (
            <div
              key={section.href}
              className={cn(
                'whai-card p-6 bg-gradient-to-br transition-all',
                section.bg, section.border,
              )}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={cn('p-2.5 rounded-xl bg-current/10 shrink-0', section.color)}>
                    <Icon className={cn('w-5 h-5', section.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className={cn('text-3xl font-bold', section.color)}>
                        {loading ? <span className="inline-block w-12 h-8 rounded bg-slate-700/50 animate-pulse align-middle" /> : count.toLocaleString()}
                      </span>
                      <h2 className="text-lg font-semibold text-white">{section.label}</h2>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed mb-4">{section.description}</p>

                    {/* Status pills */}
                    {!loading && Object.keys(statusBreakdown).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {section.keyStatuses.map((status) => {
                          const n = statusBreakdown[status] ?? 0
                          if (n === 0) return null
                          return (
                            <span
                              key={status}
                              className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', STATUS_COLORS[status] ?? 'bg-slate-500/20 text-slate-400')}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {n} {status}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <Link
                    href={section.href}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1a3a5c] text-slate-300 hover:text-white hover:border-slate-500 text-sm transition-colors whitespace-nowrap"
                  >
                    View All <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick tips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#1a3a5c] pt-8">
        {[
          {
            icon: TrendingUp,
            label: 'Pipeline Tracking',
            desc: 'Every record has a status pipeline. Track progress from first contact through to confirmed attendance or signed contracts.',
          },
          {
            icon: Clock,
            label: 'Activity Timeline',
            desc: 'Log calls, emails, meetings and notes on each record. The full interaction history lives on the contact page.',
          },
          {
            icon: CheckCircle2,
            label: 'CSV Export',
            desc: 'Filter by any combination of status, tier, country or tag, then export the result set as a CSV in one click.',
          },
        ].map((tip) => {
          const Icon = tip.icon
          return (
            <div key={tip.label} className="p-4 rounded-xl bg-[#112850]/40 border border-[#1a3a5c]">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">{tip.label}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{tip.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
