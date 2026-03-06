'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, Lock, BookOpen, BarChart2, Newspaper, TrendingUp, Mic } from 'lucide-react'
import { Pagination } from '@/components/search/Pagination'
import type { InsightFilters, ContentType } from '@/types'
import { CONTENT_TYPE_LABELS } from '@/types'
import { cn, formatDate, truncate } from '@/lib/utils'

async function fetchInsights(filters: InsightFilters, page: number, pageSize: number) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  params.set('sortBy', 'published_at')
  params.set('sortDir', 'desc')
  if (filters.query) params.set('query', filters.query)
  filters.contentTypes?.forEach((t) => params.append('contentTypes', t))
  filters.verticalIds?.forEach((id) => params.append('verticalIds', id))
  if (filters.isPremium !== undefined) params.set('isPremium', String(filters.isPremium))
  const res = await fetch(`/api/insights?${params}`)
  return res.json()
}

async function fetchTaxonomy() {
  const res = await fetch('/api/taxonomy')
  return res.json()
}

const CONTENT_ICONS: Record<string, React.ElementType> = {
  MARKET_REPORT: BarChart2,
  ANALYSIS: TrendingUp,
  NEWS_BRIEF: Newspaper,
  DATA_SNAPSHOT: BarChart2,
  QUARTERLY_REPORT: BookOpen,
  PODCAST_SUMMARY: Mic,
}

const CONTENT_COLORS: Record<string, string> = {
  MARKET_REPORT: 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
  ANALYSIS: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  NEWS_BRIEF: 'text-green-400 bg-green-400/10 border-green-400/20',
  DATA_SNAPSHOT: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  QUARTERLY_REPORT: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  PODCAST_SUMMARY: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
}

export default function InsightsPage() {
  const [filters, setFilters] = useState<InsightFilters>({})
  const [page, setPage] = useState(1)

  const { data: taxonomy } = useQuery({ queryKey: ['taxonomy'], queryFn: fetchTaxonomy })
  const { data, isLoading } = useQuery({
    queryKey: ['insights', filters, page],
    queryFn: () => fetchInsights(filters, page, 12),
    placeholderData: (prev) => prev,
  })

  useEffect(() => { setPage(1) }, [filters])

  const update = (partial: Partial<InsightFilters>) => setFilters((prev) => ({ ...prev, ...partial }))

  const ALL_TYPES = Object.keys(CONTENT_TYPE_LABELS) as ContentType[]

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Insights & Trends</h1>
        <p className="text-sm text-slate-400 mt-1">Healthcare intelligence, market reports and analysis from WHAI researchers</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={filters.query ?? ''}
            onChange={(e) => update({ query: e.target.value || undefined })}
            placeholder="Search insights..."
            className="pl-8 pr-3 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8] w-56"
          />
        </div>

        {/* Content type pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => update({ contentTypes: undefined })}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              !filters.contentTypes?.length
                ? 'bg-[#00B4D8] text-[#0A1628] border-[#00B4D8]'
                : 'border-[#1a3a5c] text-slate-400 hover:text-white hover:border-slate-400',
            )}
          >
            All
          </button>
          {ALL_TYPES.map((t) => {
            const Icon = CONTENT_ICONS[t] ?? BookOpen
            const active = (filters.contentTypes ?? []).includes(t)
            return (
              <button
                key={t}
                onClick={() => {
                  const curr = filters.contentTypes ?? []
                  update({ contentTypes: active ? curr.filter((x) => x !== t) : [...curr, t] })
                }}
                className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  active
                    ? cn(CONTENT_COLORS[t], 'border-current')
                    : 'border-[#1a3a5c] text-slate-400 hover:text-white hover:border-slate-400',
                )}
              >
                <Icon className="w-3 h-3" />
                {CONTENT_TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => update({ isPremium: filters.isPremium ? undefined : true })}
              className={cn('w-9 h-5 rounded-full relative transition-colors cursor-pointer', filters.isPremium ? 'bg-[#00B4D8]' : 'bg-[#1a3a5c]')}
            >
              <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', filters.isPremium ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
            <span className="text-sm text-slate-300">Premium only</span>
          </label>
        </div>
      </div>

      {/* Results count */}
      {data && (
        <p className="text-sm text-slate-400">
          <span className="font-semibold text-white">{data.total}</span> articles
        </p>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Loading insights…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {(data?.data ?? []).map((insight: any) => {
            const Icon = CONTENT_ICONS[insight.content_type] ?? BookOpen
            return (
              <Link key={insight.id} href={`/insights/${insight.slug}`} className="whai-card hover:border-[#00B4D8]/40 transition-all group overflow-hidden flex flex-col">
                {/* Thumbnail / placeholder */}
                <div className="h-36 bg-gradient-to-br from-[#0D1F3C] to-[#1a3a5c] flex items-center justify-center relative overflow-hidden">
                  <Icon className="w-10 h-10 text-[#00B4D8]/20" />
                  {insight.is_premium && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full">
                      <Lock className="w-2.5 h-2.5" /> Premium
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('whai-badge border text-[10px]', CONTENT_COLORS[insight.content_type])}>
                      {CONTENT_TYPE_LABELS[insight.content_type as ContentType]}
                    </span>
                    <span className="text-[10px] text-slate-500">{formatDate(insight.published_at)}</span>
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-[#00B4D8] transition-colors text-sm leading-snug mb-2 line-clamp-2">
                    {insight.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 flex-1">{insight.summary}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {insight.verticals?.slice(0, 2).map((iv: any) => (
                      <span key={iv.vertical.id} className="text-[10px] px-1.5 py-0.5 rounded bg-[#112850] text-slate-400 border border-[#1a3a5c]">
                        {iv.vertical.name}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {(data?.data ?? []).length === 0 && !isLoading && (
        <div className="text-center py-16 text-slate-500 text-sm">No insights match your filters.</div>
      )}

      {data && data.total > 0 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={12} onPage={setPage} onPageSize={() => {}} />
      )}
    </div>
  )
}
