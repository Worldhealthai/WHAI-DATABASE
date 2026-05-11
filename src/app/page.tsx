'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Users, Mic, Award, ArrowRight, Upload, Inbox, TrendingUp, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectionStats {
  total: number
  byStatus: Record<string, number>
  byEvent: Record<string, number>
}

interface AllStats {
  delegates: SectionStats
  speakers: SectionStats
  sponsors: SectionStats
}

// ── Config ────────────────────────────────────────────────────────────────────

const DELEGATE_PIPELINE = [
  { status: 'Registered',  color: 'bg-blue-500' },
  { status: 'Confirmed',   color: 'bg-cyan-500' },
  { status: 'Attended',    color: 'bg-green-500' },
  { status: 'Waitlisted',  color: 'bg-amber-500' },
  { status: 'Cancelled',   color: 'bg-red-500' },
  { status: 'No-show',     color: 'bg-slate-500' },
  { status: 'Rejected',    color: 'bg-rose-500' },
]

const SPEAKER_PIPELINE = [
  { status: 'Not Contacted',      color: 'bg-slate-500' },
  { status: 'Invited',            color: 'bg-blue-500' },
  { status: 'Discussing',         color: 'bg-purple-500' },
  { status: 'Speaking Confirmed', color: 'bg-green-500' },
  { status: 'Speaking Rejected',  color: 'bg-red-500' },
  { status: 'Rejected',           color: 'bg-rose-500' },
]

const SPONSOR_PIPELINE = [
  { status: 'Not Contacted', color: 'bg-slate-500' },
  { status: 'Emailed',       color: 'bg-blue-500' },
  { status: 'In Discussion', color: 'bg-purple-500' },
  { status: 'Confirmed',     color: 'bg-green-500' },
  { status: 'Rejected',      color: 'bg-rose-500' },
]

const EVENTS = ['UK Forum', 'US Forum']
const EVENT_COLORS = ['bg-[#00B4D8]', 'bg-purple-500']

// ── Animated number ───────────────────────────────────────────────────────────

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number>()
  const startRef = useRef<number>()

  useEffect(() => {
    if (value === 0) return
    const duration = 800
    const start = performance.now()
    startRef.current = start
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value])

  return <span className={className}>{display.toLocaleString()}</span>
}

// ── Pipeline bar ──────────────────────────────────────────────────────────────

function PipelineBar({
  pipeline, byStatus, total, animate,
}: {
  pipeline: { status: string; color: string }[]
  byStatus: Record<string, number>
  total: number
  animate: boolean
}) {
  const entries = pipeline
    .map((p) => ({ ...p, count: byStatus[p.status] ?? 0 }))
    .filter((p) => p.count > 0)

  if (!total || entries.length === 0) {
    return <div className="h-2 rounded-full bg-[#1a3a5c] w-full" />
  }

  return (
    <div className="space-y-2.5">
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px bg-[#0A1628]">
        {entries.map((e) => (
          <div
            key={e.status}
            className={cn('h-full transition-all duration-1000 ease-out rounded-sm', e.color)}
            style={{ width: animate ? `${(e.count / total) * 100}%` : '0%' }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {entries.map((e) => (
          <div key={e.status} className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full shrink-0', e.color)} />
            <span className="text-[11px] text-slate-400">{e.status}</span>
            <span className="text-[11px] text-slate-600">{e.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Event split bars ──────────────────────────────────────────────────────────

function EventSplit({ byEvent, total, animate }: { byEvent: Record<string, number>; total: number; animate: boolean }) {
  return (
    <div className="space-y-1.5">
      {EVENTS.map((ev, i) => {
        const count = byEvent[ev] ?? 0
        const pct = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={ev} className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 w-16 shrink-0">{ev}</span>
            <div className="flex-1 h-1.5 bg-[#1a3a5c] rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-1000 ease-out', EVENT_COLORS[i])}
                style={{ width: animate ? `${pct}%` : '0%' }}
              />
            </div>
            <span className="text-[11px] text-slate-500 w-6 text-right shrink-0">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  label, icon: Icon, total, byStatus, byEvent, pipeline,
  accentColor, accentBg, accentBorder, href, animate, loading,
}: {
  label: string
  icon: React.ElementType
  total: number
  byStatus: Record<string, number>
  byEvent: Record<string, number>
  pipeline: { status: string; color: string }[]
  accentColor: string
  accentBg: string
  accentBorder: string
  href: string
  animate: boolean
  loading: boolean
}) {
  const confirmed = byStatus['Confirmed'] ?? byStatus['Speaking Confirmed'] ?? byStatus['Attended'] ?? 0
  const confirmedPct = total > 0 ? Math.round((confirmed / total) * 100) : 0

  return (
    <Link href={href} className={cn(
      'group block whai-card p-5 border transition-all hover:scale-[1.01]',
      accentBorder,
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-2 rounded-lg', accentBg)}>
          <Icon className={cn('w-4 h-4', accentColor)} />
        </div>
        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>

      <div className="mb-1">
        {loading ? (
          <div className="h-9 w-20 bg-slate-700/50 rounded animate-pulse" />
        ) : (
          <AnimatedNumber value={total} className={cn('text-4xl font-bold tabular-nums', accentColor)} />
        )}
      </div>
      <div className="text-sm font-semibold text-white mb-4">{label}</div>

      {!loading && (
        <div className="space-y-3">
          <PipelineBar pipeline={pipeline} byStatus={byStatus} total={total} animate={animate} />
          <div className="pt-1 border-t border-[#1a3a5c]">
            <EventSplit byEvent={byEvent} total={total} animate={animate} />
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <div className="h-2 bg-slate-700/40 rounded animate-pulse" />
          <div className="h-2 w-3/4 bg-slate-700/30 rounded animate-pulse" />
        </div>
      )}
    </Link>
  )
}

// ── Detailed pipeline rows ────────────────────────────────────────────────────

function PipelineRows({
  pipeline, byStatus, total, animate,
}: {
  pipeline: { status: string; color: string }[]
  byStatus: Record<string, number>
  total: number
  animate: boolean
}) {
  const entries = pipeline
    .map((p) => ({ ...p, count: byStatus[p.status] ?? 0 }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)

  if (!entries.length) return <p className="text-sm text-slate-600 py-2">No data yet.</p>

  return (
    <div className="space-y-2.5">
      {entries.map((e) => {
        const pct = total > 0 ? (e.count / total) * 100 : 0
        return (
          <div key={e.status} className="flex items-center gap-3">
            <div className="flex items-center gap-2 w-40 shrink-0">
              <div className={cn('w-2 h-2 rounded-full shrink-0', e.color)} />
              <span className="text-xs text-slate-400 truncate">{e.status}</span>
            </div>
            <div className="flex-1 h-1.5 bg-[#1a3a5c] rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-1000 ease-out', e.color)}
                style={{ width: animate ? `${pct}%` : '0%' }}
              />
            </div>
            <span className="text-xs text-slate-500 tabular-nums w-8 text-right shrink-0">{e.count}</span>
            <span className="text-xs text-slate-700 tabular-nums w-10 text-right shrink-0">{Math.round(pct)}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<AllStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [animate, setAnimate] = useState(false)
  const [now, setNow] = useState('')

  useEffect(() => {
    setNow(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [d, sp, sn] = await Promise.all([
          fetch('/api/delegates/stats').then((r) => r.ok ? r.json() : { total: 0, byStatus: {}, byEvent: {} }),
          fetch('/api/speakers/stats').then((r) => r.ok ? r.json() : { total: 0, byStatus: {}, byEvent: {} }),
          fetch('/api/sponsors/stats').then((r) => r.ok ? r.json() : { total: 0, byStatus: {}, byEvent: {} }),
        ])
        if (!cancelled) {
          setStats({ delegates: d, speakers: sp, sponsors: sn })
          setLoading(false)
          setTimeout(() => setAnimate(true), 80)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const totalRecords = (stats?.delegates.total ?? 0) + (stats?.speakers.total ?? 0) + (stats?.sponsors.total ?? 0)

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-slate-500 font-medium">Live</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            WHAI Events CRM
          </h1>
          {now && <p className="text-sm text-slate-500 mt-0.5">{now}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/import" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#112850] border border-[#1a3a5c] text-slate-300 hover:text-white text-sm transition-colors">
            <Upload className="w-3.5 h-3.5" /> Import
          </Link>
          <Link href="/unassigned" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#112850] border border-[#1a3a5c] text-slate-300 hover:text-white text-sm transition-colors">
            <Inbox className="w-3.5 h-3.5" /> Triage Inbox
          </Link>
        </div>
      </div>

      {/* ── Total banner ── */}
      <div className="whai-card p-4 flex items-center gap-6 flex-wrap border border-[#1a3a5c]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#00B4D8]/10">
            <Activity className="w-4 h-4 text-[#00B4D8]" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Records</div>
            {loading
              ? <div className="h-6 w-16 bg-slate-700/50 rounded animate-pulse mt-0.5" />
              : <AnimatedNumber value={totalRecords} className="text-xl font-bold text-white" />
            }
          </div>
        </div>
        <div className="h-8 w-px bg-[#1a3a5c] hidden sm:block" />
        {/* Event split summary */}
        {!loading && stats && (
          <div className="flex items-center gap-6">
            {EVENTS.map((ev, i) => {
              const total = (stats.delegates.byEvent[ev] ?? 0) + (stats.speakers.byEvent[ev] ?? 0) + (stats.sponsors.byEvent[ev] ?? 0)
              return (
                <div key={ev} className="flex items-center gap-2">
                  <div className={cn('w-2.5 h-2.5 rounded-full', EVENT_COLORS[i])} />
                  <span className="text-sm text-slate-400">{ev}</span>
                  <span className="text-sm font-bold text-white">{total.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
          <TrendingUp className="w-3.5 h-3.5" />
          Across delegates, speakers &amp; sponsors
        </div>
      </div>

      {/* ── 3 stat tiles ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Delegates"
          icon={Users}
          total={stats?.delegates.total ?? 0}
          byStatus={stats?.delegates.byStatus ?? {}}
          byEvent={stats?.delegates.byEvent ?? {}}
          pipeline={DELEGATE_PIPELINE}
          accentColor="text-[#00B4D8]"
          accentBg="bg-[#00B4D8]/10"
          accentBorder="border-[#00B4D8]/20 hover:border-[#00B4D8]/40"
          href="/delegates"
          animate={animate}
          loading={loading}
        />
        <StatTile
          label="Speaker Leads"
          icon={Mic}
          total={stats?.speakers.total ?? 0}
          byStatus={stats?.speakers.byStatus ?? {}}
          byEvent={stats?.speakers.byEvent ?? {}}
          pipeline={SPEAKER_PIPELINE}
          accentColor="text-purple-400"
          accentBg="bg-purple-500/10"
          accentBorder="border-purple-500/20 hover:border-purple-500/40"
          href="/speakers"
          animate={animate}
          loading={loading}
        />
        <StatTile
          label="Sponsors"
          icon={Award}
          total={stats?.sponsors.total ?? 0}
          byStatus={stats?.sponsors.byStatus ?? {}}
          byEvent={stats?.sponsors.byEvent ?? {}}
          pipeline={SPONSOR_PIPELINE}
          accentColor="text-amber-400"
          accentBg="bg-amber-500/10"
          accentBorder="border-amber-500/20 hover:border-amber-500/40"
          href="/sponsors"
          animate={animate}
          loading={loading}
        />
      </div>

      {/* ── Pipeline breakdown ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Delegate Pipeline',
            color: 'text-[#00B4D8]',
            border: 'border-[#00B4D8]/10',
            pipeline: DELEGATE_PIPELINE,
            data: stats?.delegates,
            href: '/delegates',
          },
          {
            label: 'Speaker Pipeline',
            color: 'text-purple-400',
            border: 'border-purple-500/10',
            pipeline: SPEAKER_PIPELINE,
            data: stats?.speakers,
            href: '/speakers',
          },
          {
            label: 'Sponsor Pipeline',
            color: 'text-amber-400',
            border: 'border-amber-500/10',
            pipeline: SPONSOR_PIPELINE,
            data: stats?.sponsors,
            href: '/sponsors',
          },
        ].map((section) => (
          <div key={section.label} className={cn('whai-card p-5 border', section.border)}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn('text-xs font-semibold uppercase tracking-wider', section.color)}>
                {section.label}
              </h2>
              <Link href={section.href} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                View →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[100, 75, 55, 40].map((w) => (
                  <div key={w} className="flex items-center gap-3">
                    <div className="h-2.5 w-28 bg-slate-700/40 rounded animate-pulse" />
                    <div className={`h-1.5 bg-slate-700/30 rounded animate-pulse`} style={{ width: `${w}%` }} />
                    <div className="h-2.5 w-6 bg-slate-700/30 rounded animate-pulse ml-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <PipelineRows
                pipeline={section.pipeline}
                byStatus={section.data?.byStatus ?? {}}
                total={section.data?.total ?? 0}
                animate={animate}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Quick navigation ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/delegates', label: 'Delegates', sub: 'Manage attendees', icon: Users, color: 'text-[#00B4D8]', bg: 'hover:border-[#00B4D8]/30' },
          { href: '/speakers', label: 'Speakers', sub: 'Manage leads', icon: Mic, color: 'text-purple-400', bg: 'hover:border-purple-500/30' },
          { href: '/sponsors', label: 'Sponsors', sub: 'Manage companies', icon: Award, color: 'text-amber-400', bg: 'hover:border-amber-500/30' },
          { href: '/import', label: 'Import CSV', sub: 'Bulk upload data', icon: Upload, color: 'text-green-400', bg: 'hover:border-green-500/30' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group whai-card p-4 border border-[#1a3a5c] transition-all hover:scale-[1.02]',
                item.bg
              )}
            >
              <Icon className={cn('w-5 h-5 mb-2', item.color)} />
              <div className="text-sm font-semibold text-white">{item.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{item.sub}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
