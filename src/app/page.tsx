'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Users, Mic, Award, Upload, Inbox, Plus, ArrowUpRight, ChevronRight, Network } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIAssistant } from '@/components/crm/AIAssistant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectionStats {
  total: number
  byStatus: Record<string, number>
  byEvent: Record<string, number>
}
interface AllStats {
  delegates: SectionStats
  speakers:  SectionStats
  sponsors:  SectionStats
  partners:  SectionStats
}

// ── Pipeline configs ──────────────────────────────────────────────────────────

const DELEGATE_PIPELINE = [
  { status: 'Registered',  hex: '#3b82f6' },
  { status: 'Confirmed',   hex: '#06b6d4' },
  { status: 'Attended',    hex: '#10b981' },
  { status: 'Waitlisted',  hex: '#f59e0b' },
  { status: 'Cancelled',   hex: '#ef4444' },
  { status: 'No-show',     hex: '#64748b' },
  { status: 'Rejected',    hex: '#f43f5e' },
]
const SPEAKER_PIPELINE = [
  { status: 'Not Contacted',      hex: '#64748b' },
  { status: 'Invited',            hex: '#3b82f6' },
  { status: 'Discussing',         hex: '#a855f7' },
  { status: 'Speaking Confirmed', hex: '#10b981' },
  { status: 'Rejected',           hex: '#f43f5e' },
]
const SPONSOR_PIPELINE = [
  { status: 'Not Contacted', hex: '#64748b' },
  { status: 'Emailed',       hex: '#3b82f6' },
  { status: 'In Discussion', hex: '#a855f7' },
  { status: 'Confirmed',     hex: '#10b981' },
  { status: 'Rejected',      hex: '#f43f5e' },
]
const PARTNER_PIPELINE = [
  { status: 'Not Contacted', hex: '#64748b' },
  { status: 'Emailed',       hex: '#3b82f6' },
  { status: 'In Discussion', hex: '#a855f7' },
  { status: 'Confirmed',     hex: '#10b981' },
  { status: 'Rejected',      hex: '#f43f5e' },
]

const EVENTS = ['UK Forum', 'US Forum']
const EVENT_HEX = ['#00B4D8', '#a855f7']

// ── Helpers ───────────────────────────────────────────────────────────────────

function keyMetric(
  pipeline: typeof DELEGATE_PIPELINE,
  byStatus: Record<string, number>,
  total: number,
  positiveKeys?: string[],
) {
  const keys = positiveKeys ?? ['Confirmed', 'Attended', 'Speaking Confirmed']
  const n = pipeline
    .filter(p => keys.includes(p.status))
    .reduce((s, p) => s + (byStatus[p.status] ?? 0), 0)
  return total > 0 ? Math.round((n / total) * 100) : 0
}

// ── Animated counter ──────────────────────────────────────────────────────────

function Counter({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!value) return
    const start = performance.now()
    const duration = 900
    const raf = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 4)
      setDisplay(Math.round(ease * value))
      if (t < 1) requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
  }, [value])
  return <span className={className}>{display.toLocaleString()}</span>
}

// ── SVG Ring chart ────────────────────────────────────────────────────────────

function Ring({ pct, color, size = 88, stroke = 7, animate }: {
  pct: number; color: string; size?: number; stroke?: number; animate: boolean
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <svg width={size} height={size} className="shrink-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a3a5c" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={animate ? offset : circ}
        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
    </svg>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KPICard({
  label, icon: Icon, total, byStatus, byEvent, pipeline,
  color, accentHex, href, animate, loading, positiveKeys, ringLabel,
}: {
  label: string; icon: React.ElementType; total: number
  byStatus: Record<string, number>; byEvent: Record<string, number>
  pipeline: { status: string; hex: string }[]
  color: string; accentHex: string; href: string
  animate: boolean; loading: boolean
  positiveKeys?: string[]
  ringLabel?: string
}) {
  const pct = keyMetric(pipeline, byStatus, total, positiveKeys)
  const top4 = pipeline
    .map(p => ({ ...p, count: byStatus[p.status] ?? 0 }))
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)

  return (
    <Link href={href} className="group block relative overflow-hidden rounded-xl border border-[#1a3a5c] bg-[#0d2040] hover:border-opacity-60 transition-all hover:shadow-lg hover:shadow-black/40 hover:-translate-y-0.5">
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${accentHex}80, ${accentHex}20)` }} />

      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg" style={{ background: `${accentHex}18` }}>
              <Icon className="w-4 h-4" style={{ color: accentHex }} />
            </div>
            <span className="text-sm font-semibold text-slate-300">{label}</span>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 transition-colors" />
        </div>

        <div className="flex items-end justify-between mb-5">
          <div>
            {loading ? (
              <div className="h-10 w-20 bg-slate-700/40 rounded-lg animate-pulse" />
            ) : (
              <Counter value={total} className="text-4xl font-bold text-white tabular-nums" />
            )}
            <div className="text-xs text-slate-500 mt-0.5 font-medium">total records</div>
          </div>
          {!loading && total > 0 && (
            <div className="relative shrink-0">
              <Ring pct={pct} color={accentHex} animate={animate} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{pct}%</span>
              </div>
            </div>
          )}
          {loading && <div className="w-[88px] h-[88px] rounded-full bg-slate-700/30 animate-pulse shrink-0" />}
        </div>

        {ringLabel && !loading && total > 0 && (
          <div className="text-[10px] text-slate-600 -mt-3 mb-3 text-right">{ringLabel}</div>
        )}

        {!loading && (
          <div className="space-y-1.5 mb-4">
            {top4.map(p => (
              <div key={p.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.hex }} />
                  <span className="text-xs text-slate-500">{p.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 bg-[#1a3a5c] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: animate ? `${(p.count / total) * 100}%` : '0%',
                        background: p.hex,
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-600 tabular-nums w-6 text-right">{p.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="space-y-2 mb-4">
            {[1,2,3].map(i => <div key={i} className="h-3 bg-slate-700/30 rounded animate-pulse" />)}
          </div>
        )}

        {!loading && (
          <div className="pt-3 border-t border-[#1a3a5c]/60">
            <div className="flex items-center gap-3">
              {EVENTS.map((ev, i) => (
                <div key={ev} className="flex items-center gap-1.5 flex-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: EVENT_HEX[i] }} />
                  <span className="text-[10px] text-slate-600">{ev}</span>
                  <span className="text-[10px] font-semibold text-slate-400 ml-auto">{byEvent[ev] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Pipeline rows ─────────────────────────────────────────────────────────────

function PipelineSection({
  label, pipeline, byStatus, total, accentHex, href, animate,
}: {
  label: string; pipeline: { status: string; hex: string }[]
  byStatus: Record<string, number>; total: number
  accentHex: string; href: string; animate: boolean
}) {
  const entries = pipeline
    .map(p => ({ ...p, count: byStatus[p.status] ?? 0 }))
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count)

  if (!entries.length) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 rounded-full" style={{ background: accentHex }} />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">{label}</span>
        </div>
        <Link href={href} className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-0.5">
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {entries.map(e => {
          const pct = total > 0 ? (e.count / total) * 100 : 0
          return (
            <div key={e.status} className="flex items-center gap-3 group/row">
              <div className="w-[130px] shrink-0 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.hex }} />
                <span className="text-xs text-slate-400 truncate">{e.status}</span>
              </div>
              <div className="flex-1 h-1.5 bg-[#0A1628] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: animate ? `${pct}%` : '0%', background: e.hex }}
                />
              </div>
              <span className="text-xs tabular-nums text-slate-500 w-7 text-right shrink-0">{e.count}</span>
              <span className="text-[10px] tabular-nums text-slate-700 w-8 text-right shrink-0">{Math.round(pct)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Event comparison ──────────────────────────────────────────────────────────

function EventComparison({ stats, animate }: { stats: AllStats; animate: boolean }) {
  const rows = [
    { label: 'Delegates', data: stats.delegates, color: '#00B4D8' },
    { label: 'Speakers',  data: stats.speakers,  color: '#a855f7' },
    { label: 'Sponsors',  data: stats.sponsors,  color: '#f59e0b' },
    { label: 'Partners',  data: stats.partners,  color: '#10b981' },
  ]

  const maxPerRow = rows.map(r =>
    Math.max(...EVENTS.map(ev => r.data.byEvent[ev] ?? 0))
  )
  const globalMax = Math.max(...maxPerRow, 1)

  return (
    <div className="space-y-4">
      {rows.map((row, ri) => (
        <div key={row.label}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: row.color }} />
            <span className="text-xs font-medium text-slate-400">{row.label}</span>
          </div>
          <div className="space-y-1">
            {EVENTS.map((ev, i) => {
              const count = row.data.byEvent[ev] ?? 0
              const pct = (count / globalMax) * 100
              return (
                <div key={ev} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 w-14 shrink-0">{ev}</span>
                  <div className="flex-1 h-1.5 bg-[#0A1628] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: animate ? `${pct}%` : '0%', background: EVENT_HEX[i] }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-slate-500 w-5 text-right">{count}</span>
                </div>
              )
            })}
          </div>
          {ri < rows.length - 1 && <div className="mt-3 border-t border-[#1a3a5c]/40" />}
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<AllStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [animate, setAnimate] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    setDateStr(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/delegates/stats').then(r => r.ok ? r.json() : { total: 0, byStatus: {}, byEvent: {} }),
      fetch('/api/speakers/stats').then(r => r.ok ? r.json() : { total: 0, byStatus: {}, byEvent: {} }),
      fetch('/api/sponsors/stats').then(r => r.ok ? r.json() : { total: 0, byStatus: {}, byEvent: {} }),
      fetch('/api/partners/stats').then(r => r.ok ? r.json() : { total: 0, byStatus: {}, byEvent: {} }),
    ]).then(([d, sp, sn, pt]) => {
      if (cancelled) return
      setStats({ delegates: d, speakers: sp, sponsors: sn, partners: pt })
      setLoading(false)
      setTimeout(() => setAnimate(true), 100)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0c1f3f 0%, #0A1628 60%)' }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Top bar ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                <span className="text-xs text-slate-500 font-medium tracking-wide">LIVE DATA</span>
              </div>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-600">{dateStr}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{greeting}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Here's your WHAI Events overview</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Link href="/import" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0d2040] border border-[#1a3a5c] text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-all">
              <Upload className="w-3.5 h-3.5" /> Import
            </Link>
            <Link href="/unassigned" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0d2040] border border-[#1a3a5c] text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-all">
              <Inbox className="w-3.5 h-3.5" /> Triage Inbox
            </Link>
          </div>
        </div>

        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Delegates" icon={Users}
            total={stats?.delegates.total ?? 0}
            byStatus={stats?.delegates.byStatus ?? {}}
            byEvent={stats?.delegates.byEvent ?? {}}
            pipeline={DELEGATE_PIPELINE}
            color="text-[#00B4D8]" accentHex="#00B4D8"
            href="/delegates" animate={animate} loading={loading}
          />
          <KPICard
            label="Speaker Leads" icon={Mic}
            total={stats?.speakers.total ?? 0}
            byStatus={stats?.speakers.byStatus ?? {}}
            byEvent={stats?.speakers.byEvent ?? {}}
            pipeline={SPEAKER_PIPELINE}
            color="text-purple-400" accentHex="#a855f7"
            href="/speakers" animate={animate} loading={loading}
          />
          <KPICard
            label="Sponsors" icon={Award}
            total={stats?.sponsors.total ?? 0}
            byStatus={stats?.sponsors.byStatus ?? {}}
            byEvent={stats?.sponsors.byEvent ?? {}}
            pipeline={SPONSOR_PIPELINE}
            positiveKeys={['Emailed', 'In Discussion', 'Confirmed']}
            ringLabel="contacted"
            color="text-amber-400" accentHex="#f59e0b"
            href="/sponsors" animate={animate} loading={loading}
          />
          <KPICard
            label="Partners & Media" icon={Network}
            total={stats?.partners.total ?? 0}
            byStatus={stats?.partners.byStatus ?? {}}
            byEvent={stats?.partners.byEvent ?? {}}
            pipeline={PARTNER_PIPELINE}
            positiveKeys={['Emailed', 'In Discussion', 'Confirmed']}
            ringLabel="contacted"
            color="text-emerald-400" accentHex="#10b981"
            href="/partners" animate={animate} loading={loading}
          />
        </div>

        {/* ── Pulse AI panel ── */}
        <div style={{ height: 540 }}>
          <AIAssistant inline />
        </div>

        {/* ── Pipeline + Event grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pipeline detail — 2/3 width */}
          <div className="lg:col-span-2 rounded-xl border border-[#1a3a5c] bg-[#0d2040] p-5 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Pipeline Breakdown</h2>
              <span className="text-[10px] text-slate-600 uppercase tracking-wider font-medium">Status distribution</span>
            </div>
            {loading ? (
              <div className="space-y-4">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-3 w-28 bg-slate-700/40 rounded animate-pulse" />
                    <div className="h-1.5 flex-1 bg-slate-700/30 rounded animate-pulse" />
                    <div className="h-3 w-6 bg-slate-700/30 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <PipelineSection label="Delegates" pipeline={DELEGATE_PIPELINE} byStatus={stats?.delegates.byStatus ?? {}} total={stats?.delegates.total ?? 0} accentHex="#00B4D8" href="/delegates" animate={animate} />
                <div className="border-t border-[#1a3a5c]/40" />
                <PipelineSection label="Speaker Leads" pipeline={SPEAKER_PIPELINE} byStatus={stats?.speakers.byStatus ?? {}} total={stats?.speakers.total ?? 0} accentHex="#a855f7" href="/speakers" animate={animate} />
                <div className="border-t border-[#1a3a5c]/40" />
                <PipelineSection label="Sponsors" pipeline={SPONSOR_PIPELINE} byStatus={stats?.sponsors.byStatus ?? {}} total={stats?.sponsors.total ?? 0} accentHex="#f59e0b" href="/sponsors" animate={animate} />
                <div className="border-t border-[#1a3a5c]/40" />
                <PipelineSection label="Partners & Media" pipeline={PARTNER_PIPELINE} byStatus={stats?.partners.byStatus ?? {}} total={stats?.partners.total ?? 0} accentHex="#10b981" href="/partners" animate={animate} />
              </div>
            )}
          </div>

          {/* Right column — 1/3 width */}
          <div className="space-y-4">
            {/* Event performance */}
            <div className="rounded-xl border border-[#1a3a5c] bg-[#0d2040] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Event Performance</h2>
                <div className="flex items-center gap-2">
                  {EVENTS.map((ev, i) => (
                    <div key={ev} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: EVENT_HEX[i] }} />
                      <span className="text-[10px] text-slate-600">{ev.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1,2,3,4].map(i => <div key={i} className="h-10 bg-slate-700/30 rounded animate-pulse" />)}
                </div>
              ) : stats ? (
                <EventComparison stats={stats} animate={animate} />
              ) : null}
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-[#1a3a5c] bg-[#0d2040] p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
              <div className="space-y-1.5">
                {[
                  { href: '/delegates', label: 'View Delegates',  icon: Users,    color: '#00B4D8' },
                  { href: '/speakers',  label: 'View Speakers',   icon: Mic,      color: '#a855f7' },
                  { href: '/sponsors',  label: 'View Sponsors',   icon: Award,    color: '#f59e0b' },
                  { href: '/partners',  label: 'View Partners',   icon: Network,  color: '#10b981' },
                  { href: '/import',    label: 'Import CSV',      icon: Upload,   color: '#10b981' },
                  { href: '/unassigned',label: 'Triage Inbox',    icon: Inbox,    color: '#64748b' },
                ].map(item => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#112850] transition-colors"
                    >
                      <div className="p-1 rounded" style={{ background: `${item.color}18` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                      </div>
                      <span className="text-sm text-slate-400 group-hover:text-white transition-colors flex-1">{item.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 transition-colors" />
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer strip ── */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1a3a5c]/30">
          <span className="text-xs text-slate-700">WHAI Events CRM</span>
          <span className="text-xs text-slate-700">All data is live from your Supabase database</span>
        </div>
      </div>
    </div>
  )
}
