'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Search, Download, Sparkles, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown,
  Building2, ArrowRight,
} from 'lucide-react'
import { FilterDropdown, ActiveFiltersBar } from '@/components/search/FilterDropdown'
import { Pagination } from '@/components/search/Pagination'
import type { DealFilters } from '@/types'
import { DEAL_TYPE_OPTIONS, DEAL_STAGE_OPTIONS } from '@/types'
import { cn, formatDate, formatCurrency } from '@/lib/utils'

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchDeals(filters: DealFilters, page: number, pageSize: number, sortBy: string, sortDir: string) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  params.set('sortBy', sortBy)
  params.set('sortDir', sortDir)
  if (filters.query) params.set('query', filters.query)
  filters.dealTypes?.forEach((t) => params.append('dealTypes', t))
  filters.dealStages?.forEach((s) => params.append('dealStages', s))
  if (filters.valueMin !== undefined) params.set('valueMin', String(filters.valueMin))
  if (filters.valueMax !== undefined) params.set('valueMax', String(filters.valueMax))
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  const res = await fetch(`/api/deals?${params}`)
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

// ── Colours ──────────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  'Completed': 'text-green-400 bg-green-400/10 border-green-400/20',
  'Announced': 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
  'Terminated': 'text-red-400 bg-red-400/10 border-red-400/20',
  'Rumoured': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

const STAGE_DOT: Record<string, string> = {
  'Completed': 'bg-green-400',
  'Announced': 'bg-[#00B4D8]',
  'Terminated': 'bg-red-400',
  'Rumoured': 'bg-amber-400',
}

const TYPE_ICON_COLOR: Record<string, string> = {
  'M&A': 'text-purple-400',
  'Venture Capital': 'text-emerald-400',
  'Private Equity': 'text-amber-400',
  'IPO': 'text-[#00B4D8]',
  'Licensing': 'text-pink-400',
}

function getTypeColor(dealType: string | null) {
  if (!dealType) return 'text-slate-400'
  for (const [key, color] of Object.entries(TYPE_ICON_COLOR)) {
    if (dealType.includes(key)) return color
  }
  return 'text-slate-400'
}

// ── Sortable header ──────────────────────────────────────────────────────────

function SortableHeader({
  label, col, sort, onSort, className,
}: {
  label: string; col: string; sort: { sortBy: string; sortDir: string }; onSort: (col: string) => void; className?: string
}) {
  const active = sort.sortBy === col
  return (
    <th
      className={cn('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-white select-none whitespace-nowrap', className)}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          sort.sortDir === 'asc'
            ? <ArrowUp className="w-3 h-3 text-[#00B4D8]" />
            : <ArrowDown className="w-3 h-3 text-[#00B4D8]" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-600" />
        )}
      </div>
    </th>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const [filters, setFilters] = useState<DealFilters>({})
  const [hasSearched, setHasSearched] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('announcedDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [keyword, setKeyword] = useState('')

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['deals', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchDeals(filters, page, pageSize, sortBy, sortDir),
    enabled: hasSearched,
    placeholderData: (prev) => prev,
    retry: 2,
  })

  useEffect(() => { setPage(1) }, [filters])

  const updateFilter = (key: keyof DealFilters, value: string[]) =>
    setFilters((prev) => ({ ...prev, [key]: value.length ? value : undefined }))

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, query: keyword || undefined }))
    setHasSearched(true)
    setPage(1)
  }

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir(col === 'announcedDate' ? 'desc' : 'asc') }
  }

  const clearAll = () => { setFilters({}); setKeyword(''); setHasSearched(false); setPage(1) }

  // Active filter chips
  const activeFilters: { category: string; key: string; value: string }[] = []
  if (filters.query) activeFilters.push({ category: 'Search', key: 'query', value: filters.query })
  filters.dealTypes?.forEach((t) => activeFilters.push({ category: 'Deal Type', key: 'dealTypes', value: t }))
  filters.dealStages?.forEach((s) => activeFilters.push({ category: 'Stage', key: 'dealStages', value: s }))
  if (filters.dateFrom) activeFilters.push({ category: 'Date', key: 'dateFrom', value: `From ${filters.dateFrom}` })
  if (filters.dateTo) activeFilters.push({ category: 'Date', key: 'dateTo', value: `To ${filters.dateTo}` })

  const removeChip = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev } as any
      if (Array.isArray(next[key])) {
        next[key] = next[key].filter((v: string) => v !== value)
        if (next[key].length === 0) delete next[key]
      } else {
        delete next[key]
      }
      return next
    })
  }

  const totalValue = data?.stats?.totalValueCents
    ? formatCurrency(BigInt(data.stats.totalValueCents))
    : null

  const exportCSV = () => {
    if (!data?.data) return
    const rows = data.data.map((d: any) => [
      d.title, d.dealType ?? '', d.dealStage ?? '', d.sector ?? '',
      d.dealValueUsd ? formatCurrency(BigInt(d.dealValueUsd)) : 'Undisclosed',
      d.acquirerCompany?.name ?? '', d.targetCompany?.name ?? '',
      d.announcedDate ? formatDate(d.announcedDate) : '', d.closedDate ? formatDate(d.closedDate) : '',
      d.financingType ?? '', d.regulatoryStatus ?? '',
    ])
    const header = ['Deal', 'Type', 'Stage', 'Sector', 'Value', 'Acquirer', 'Target', 'Announced', 'Closed', 'Financing', 'Regulatory']
    const csv = [header, ...rows].map((r) => r.map((v: any) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'whai-deals.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0A1628] border-b border-[#1a3a5c] relative z-30 overflow-visible">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 overflow-visible">
          <div className="pt-4 sm:pt-5 pb-3 sm:pb-4">
            <h1 className="text-lg sm:text-xl font-bold text-white">Deals Advanced Search</h1>
          </div>

          {/* Search bar */}
          <div className="pb-3 sm:pb-4">
            <div className="relative">
              <Sparkles className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Find deals involving..."
                className="w-full pl-10 sm:pl-11 pr-20 sm:pr-24 py-2.5 sm:py-3 bg-[#112850] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50 transition-colors"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-md bg-[#00B4D8] text-[#0A1628] text-sm font-semibold hover:bg-[#00B4D8]/90 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 pb-3 sm:pb-4 overflow-x-auto overflow-y-visible scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0 flex-nowrap sm:flex-wrap">
            <FilterDropdown
              label="Deal Type"
              options={DEAL_TYPE_OPTIONS}
              selected={filters.dealTypes ?? []}
              onChange={(v) => updateFilter('dealTypes', v)}
            />
            <FilterDropdown
              label="Stage"
              options={DEAL_STAGE_OPTIONS}
              selected={filters.dealStages ?? []}
              onChange={(v) => updateFilter('dealStages', v)}
              searchable={false}
            />

            {/* Date range */}
            <div className="flex items-center gap-1.5 pl-3 border-l border-[#1a3a5c] shrink-0">
              <span className="text-xs text-slate-500 whitespace-nowrap">Date</span>
              <input
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value || undefined }))}
                className="w-28 sm:w-32 px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-xs text-white outline-none focus:border-[#00B4D8]/50 [color-scheme:dark]"
              />
              <span className="text-slate-600">–</span>
              <input
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value || undefined }))}
                className="w-28 sm:w-32 px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-xs text-white outline-none focus:border-[#00B4D8]/50 [color-scheme:dark]"
              />
            </div>

            {/* Value range */}
            <div className="flex items-center gap-1.5 pl-3 border-l border-[#1a3a5c] shrink-0">
              <span className="text-xs text-slate-500 whitespace-nowrap">Value $</span>
              <input
                type="number"
                value={filters.valueMin ?? ''}
                onChange={(e) => setFilters((p) => ({ ...p, valueMin: e.target.value ? parseInt(e.target.value) : undefined }))}
                placeholder="Min"
                className="w-16 sm:w-20 px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-xs text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50"
              />
              <span className="text-slate-600">–</span>
              <input
                type="number"
                value={filters.valueMax ?? ''}
                onChange={(e) => setFilters((p) => ({ ...p, valueMax: e.target.value ? parseInt(e.target.value) : undefined }))}
                placeholder="Max"
                className="w-16 sm:w-20 px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-xs text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50"
              />
            </div>
          </div>

          {activeFilters.length > 0 && (
            <ActiveFiltersBar filters={activeFilters} onRemove={removeChip} onClearAll={clearAll} />
          )}
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-4">
          {!hasSearched ? (
            <div className="text-center py-12 sm:py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#112850] border border-[#1a3a5c] mb-5">
                <TrendingUp className="w-7 h-7 text-slate-500" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Search Healthcare Deals</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                M&A, venture capital, PE buyouts, licensing deals and IPOs across the healthcare ecosystem.
              </p>
              <button onClick={handleSearch} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#00B4D8] text-white font-semibold text-sm hover:bg-[#00B4D8]/90 transition-colors">
                <Search className="w-4 h-4" /> Browse All Deals
              </button>
            </div>
          ) : (
            <>
              {/* Stats ribbon */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 sm:gap-5">
                  {data && (
                    <>
                      <span className="text-sm text-slate-300">
                        <span className={cn('font-bold text-white', isFetching && 'opacity-50')}>
                          {data.total.toLocaleString()}
                        </span>{' '}deals
                      </span>
                      {totalValue && (
                        <>
                          <div className="h-4 w-px bg-[#1a3a5c]" />
                          <span className="text-sm text-slate-400">
                            Disclosed value{' '}
                            <span className={cn('font-bold text-[#00B4D8]', isFetching && 'opacity-50')}>
                              {totalValue}
                            </span>
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={exportCSV}
                  disabled={!data?.data?.length}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#112850] text-slate-300 hover:text-white text-xs font-medium border border-[#1a3a5c] hover:border-slate-500 transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>

              {/* Table */}
              <div className="whai-card overflow-hidden">
                {isLoading ? (
                  <div className="space-y-0">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-[#1a3a5c]/50">
                        <div className="w-8 h-8 rounded bg-slate-700/50 animate-pulse" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-64 rounded bg-slate-700/50 animate-pulse" />
                          <div className="h-2.5 w-40 rounded bg-slate-700/30 animate-pulse" />
                        </div>
                        <div className="h-5 w-20 rounded-full bg-slate-700/30 animate-pulse" />
                        <div className="h-4 w-24 rounded bg-slate-700/30 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center py-16 text-red-400 text-sm">Failed to load deals.</div>
                ) : (data?.data ?? []).length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-sm">No deals match your criteria.</div>
                ) : (
                  <>
                  {/* Mobile card view */}
                  <div className="md:hidden">
                    {(data?.data ?? []).map((deal: any) => (
                      <Link key={deal.id} href={`/deals/${deal.id}`} className="block px-4 py-3 border-b border-[#1a3a5c]/60 hover:bg-[#112850]/40 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-white text-sm line-clamp-2">{deal.title}</div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={cn('text-[10px] font-medium', getTypeColor(deal.dealType))}>{deal.dealType ?? '—'}</span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', STAGE_COLORS[deal.dealStage] ?? 'text-slate-300 bg-slate-700/50 border-slate-600')}>
                                {deal.dealStage}
                              </span>
                              {deal.announcedDate && <span className="text-[10px] text-slate-500">{formatDate(deal.announcedDate)}</span>}
                            </div>
                            {(deal.acquirerCompany || deal.targetCompany) && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-400">
                                {deal.acquirerCompany && <span className="truncate max-w-[120px]">{deal.acquirerCompany.name}</span>}
                                {deal.acquirerCompany && deal.targetCompany && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />}
                                {deal.targetCompany && <span className="truncate max-w-[120px]">{deal.targetCompany.name}</span>}
                              </div>
                            )}
                          </div>
                          {deal.dealValueUsd && (
                            <span className="text-sm font-bold text-[#00B4D8] shrink-0">{formatCurrency(BigInt(deal.dealValueUsd))}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                  {/* Desktop table view */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#1a3a5c]">
                          <SortableHeader label="Deal" col="title" sort={{ sortBy, sortDir }} onSort={handleSort} className="min-w-[280px]" />
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Parties</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Stage</th>
                          <SortableHeader label="Sector" col="sector" sort={{ sortBy, sortDir }} onSort={handleSort} />
                          <SortableHeader label="Value" col="dealValueUsd" sort={{ sortBy, sortDir }} onSort={handleSort} />
                          <SortableHeader label="Announced" col="announcedDate" sort={{ sortBy, sortDir }} onSort={handleSort} />
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Closed</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a3a5c]/60">
                        {(data?.data ?? []).map((deal: any) => (
                          <tr key={deal.id} className="hover:bg-[#112850]/40 transition-colors group">
                            {/* Deal title + description */}
                            <td className="px-4 py-3.5 max-w-[320px]">
                              <Link href={`/deals/${deal.id}`} className="block group/link">
                                <div className="font-medium text-white group-hover/link:text-[#00B4D8] transition-colors line-clamp-1">
                                  {deal.title}
                                </div>
                                {deal.description && (
                                  <div className="text-xs text-slate-500 line-clamp-1 mt-0.5 max-w-[300px]">
                                    {deal.description}
                                  </div>
                                )}
                              </Link>
                            </td>

                            {/* Parties */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2 text-xs">
                                {deal.acquirerCompany ? (
                                  <Link href={`/companies/${deal.acquirerCompany.id}`} className="flex items-center gap-1 text-slate-300 hover:text-[#00B4D8] transition-colors">
                                    <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span className="truncate max-w-[100px]">{deal.acquirerCompany.name}</span>
                                  </Link>
                                ) : <span className="text-slate-600">—</span>}
                                {deal.acquirerCompany && deal.targetCompany && (
                                  <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                                )}
                                {deal.targetCompany ? (
                                  <Link href={`/companies/${deal.targetCompany.id}`} className="flex items-center gap-1 text-slate-300 hover:text-[#00B4D8] transition-colors">
                                    <span className="truncate max-w-[100px]">{deal.targetCompany.name}</span>
                                  </Link>
                                ) : !deal.acquirerCompany && <span className="text-slate-600">—</span>}
                              </div>
                              {deal.investors?.length > 0 && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  +{deal.investors.length} investor{deal.investors.length > 1 ? 's' : ''}
                                </div>
                              )}
                            </td>

                            {/* Type */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className={cn('text-xs font-medium', getTypeColor(deal.dealType))}>
                                {deal.dealType ?? '—'}
                              </span>
                            </td>

                            {/* Stage */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className={cn('whai-badge border', STAGE_COLORS[deal.dealStage] ?? 'text-slate-300 bg-slate-700/50 border-slate-600')}>
                                <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 inline-block', STAGE_DOT[deal.dealStage] ?? 'bg-slate-500')} />
                                {deal.dealStage}
                              </span>
                            </td>

                            {/* Sector */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              {deal.sector ? (
                                <span className="text-xs text-slate-300">{deal.sector}</span>
                              ) : (
                                <span className="text-xs text-slate-600">—</span>
                              )}
                            </td>

                            {/* Value */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              {deal.dealValueUsd ? (
                                <span className="text-sm font-bold text-[#00B4D8]">
                                  {formatCurrency(BigInt(deal.dealValueUsd))}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-600 italic">Undisclosed</span>
                              )}
                            </td>

                            {/* Announced */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="text-xs text-slate-400">
                                {deal.announcedDate ? formatDate(deal.announcedDate) : '—'}
                              </span>
                            </td>

                            {/* Closed */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="text-xs text-slate-400">
                                {deal.closedDate ? formatDate(deal.closedDate) : '—'}
                              </span>
                            </td>

                            {/* Arrow */}
                            <td className="px-4 py-3.5">
                              <Link href={`/deals/${deal.id}`} className="text-slate-600 group-hover:text-[#00B4D8] transition-colors">
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>

              {data && data.total > 0 && (
                <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1) }} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
