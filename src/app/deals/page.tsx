'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, Download, SlidersHorizontal, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { Pagination } from '@/components/search/Pagination'
import type { DealFilters, DealType, DealStage } from '@/types'
import { DEAL_TYPE_LABELS, DEAL_STAGE_LABELS } from '@/types'
import { cn, formatDate, formatCurrency } from '@/lib/utils'

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
  filters.verticalIds?.forEach((id) => params.append('verticalIds', id))
  const res = await fetch(`/api/deals?${params}`)
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

async function fetchTaxonomy() {
  const res = await fetch('/api/taxonomy')
  return res.json()
}

const STAGE_COLORS: Record<string, string> = {
  COMPLETED: 'text-green-400 bg-green-400/10 border-green-400/20',
  ANNOUNCED: 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
  TERMINATED: 'text-red-400 bg-red-400/10 border-red-400/20',
  RUMOURED: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

function FilterSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="filter-section">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white mb-2">
        {title} {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  )
}

export default function DealsPage() {
  const [filters, setFilters] = useState<DealFilters>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('announced_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const { data: taxonomy } = useQuery({ queryKey: ['taxonomy'], queryFn: fetchTaxonomy })
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['deals', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchDeals(filters, page, pageSize, sortBy, sortDir),
    placeholderData: (prev) => prev,
  })

  useEffect(() => { setPage(1) }, [filters])

  const update = (partial: Partial<DealFilters>) => setFilters((prev) => ({ ...prev, ...partial }))

  const toggleDealType = (t: DealType) => {
    const curr = filters.dealTypes ?? []
    update({ dealTypes: curr.includes(t) ? curr.filter((x) => x !== t) : [...curr, t] })
  }

  const toggleDealStage = (s: DealStage) => {
    const curr = filters.dealStages ?? []
    update({ dealStages: curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s] })
  }

  const totalValue = data?.stats?.totalValueCents
    ? formatCurrency(BigInt(data.stats.totalValueCents))
    : '$0'

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Stats bar */}
      <div className="flex items-center gap-6 px-4 py-2 border-b border-border bg-[#0D1F3C] text-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Total Deals</span>
          <span className={cn('font-semibold text-white', isFetching && 'opacity-50')}>
            {data?.stats?.totalDeals?.toLocaleString() ?? '—'}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Total Disclosed Value</span>
          <span className={cn('font-semibold text-[#00B4D8]', isFetching && 'opacity-50')}>
            {totalValue}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#0A1628] shrink-0">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors',
            sidebarOpen ? 'bg-[#00B4D8]/15 text-[#00B4D8]' : 'bg-[#112850] text-slate-300 hover:text-white')}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4 bg-[#0A1628]">
            <div className="filter-section">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input value={filters.query ?? ''} onChange={(e) => update({ query: e.target.value || undefined })} placeholder="Search deals..." className="w-full pl-8 pr-3 py-2 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]" />
              </div>
            </div>

            <FilterSection title="Deal Type">
              {(Object.keys(DEAL_TYPE_LABELS) as DealType[]).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer py-0.5 group">
                  <input type="checkbox" checked={(filters.dealTypes ?? []).includes(t)} onChange={() => toggleDealType(t)} className="w-3.5 h-3.5 rounded border-slate-600 accent-[#00B4D8]" />
                  <span className={cn('text-sm', (filters.dealTypes ?? []).includes(t) ? 'text-[#00B4D8]' : 'text-slate-300 group-hover:text-white')}>{DEAL_TYPE_LABELS[t]}</span>
                </label>
              ))}
            </FilterSection>

            <FilterSection title="Deal Stage">
              {(Object.keys(DEAL_STAGE_LABELS) as DealStage[]).map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer py-0.5 group">
                  <input type="checkbox" checked={(filters.dealStages ?? []).includes(s)} onChange={() => toggleDealStage(s)} className="w-3.5 h-3.5 rounded border-slate-600 accent-[#00B4D8]" />
                  <span className={cn('text-sm', (filters.dealStages ?? []).includes(s) ? 'text-[#00B4D8]' : 'text-slate-300 group-hover:text-white')}>{DEAL_STAGE_LABELS[s]}</span>
                </label>
              ))}
            </FilterSection>

            <FilterSection title="Date Range" defaultOpen={false}>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">From</label>
                  <input type="date" value={filters.dateFrom ?? ''} onChange={(e) => update({ dateFrom: e.target.value || undefined })} className="w-full px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white outline-none focus:border-[#00B4D8] [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">To</label>
                  <input type="date" value={filters.dateTo ?? ''} onChange={(e) => update({ dateTo: e.target.value || undefined })} className="w-full px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white outline-none focus:border-[#00B4D8] [color-scheme:dark]" />
                </div>
              </div>
            </FilterSection>

            {taxonomy?.verticals && (
              <FilterSection title="Healthcare Vertical" defaultOpen={false}>
                {taxonomy.verticals.map((parent: any) => (
                  <div key={parent.id}>
                    <div className="text-xs font-medium text-slate-500 mt-2 mb-1 uppercase tracking-wide">{parent.name}</div>
                    {parent.children?.map((child: any) => (
                      <label key={child.id} className="flex items-center gap-2 cursor-pointer py-0.5 pl-2 group">
                        <input type="checkbox" checked={(filters.verticalIds ?? []).includes(child.id)}
                          onChange={() => {
                            const curr = filters.verticalIds ?? []
                            update({ verticalIds: curr.includes(child.id) ? curr.filter((id) => id !== child.id) : [...curr, child.id] })
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-600 accent-[#00B4D8]"
                        />
                        <span className={cn('text-sm', (filters.verticalIds ?? []).includes(child.id) ? 'text-[#00B4D8]' : 'text-slate-300 group-hover:text-white')}>{child.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </FilterSection>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="whai-card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Loading deals…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Deal', 'Type', 'Stage', 'Value', 'Acquirer', 'Target', 'Date', 'Verticals'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data?.data ?? []).map((deal: any) => (
                      <tr key={deal.id} className="hover:bg-[#112850]/50 transition-colors">
                        <td className="px-3 py-2.5 max-w-[240px]">
                          <Link href={`/deals/${deal.id}`} className="font-medium text-white hover:text-[#00B4D8] transition-colors line-clamp-2">
                            {deal.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-slate-400">{DEAL_TYPE_LABELS[deal.deal_type as DealType]}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={cn('whai-badge border text-xs', STAGE_COLORS[deal.deal_stage])}>
                            {DEAL_STAGE_LABELS[deal.deal_stage as DealStage]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {deal.deal_value_disclosed && deal.deal_value_usd ? (
                            <span className="text-sm font-semibold text-[#00B4D8]">
                              {formatCurrency(BigInt(deal.deal_value_usd))}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Undisclosed</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {deal.acquirer_company ? (
                            <Link href={`/companies/${deal.acquirer_company.id}`} className="text-slate-300 hover:text-[#00B4D8] text-xs transition-colors">
                              {deal.acquirer_company.name}
                            </Link>
                          ) : <span className="text-slate-500 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {deal.target_company ? (
                            <Link href={`/companies/${deal.target_company.id}`} className="text-slate-300 hover:text-[#00B4D8] text-xs transition-colors">
                              {deal.target_company.name}
                            </Link>
                          ) : <span className="text-slate-500 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-400">
                          {deal.announced_date ? formatDate(deal.announced_date) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {deal.verticals?.slice(0, 2).map((dv: any) => (
                              <span key={dv.vertical.id} className="text-xs px-1.5 py-0.5 rounded bg-[#112850] text-slate-300 border border-[#1a3a5c] truncate max-w-[100px]">
                                {dv.vertical.name}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data?.data ?? []).length === 0 && (
                  <div className="text-center py-16 text-slate-500 text-sm">No deals match your filters.</div>
                )}
              </div>
            )}
          </div>

          {data && data.total > 0 && (
            <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1) }} />
          )}
        </div>
      </div>
    </div>
  )
}
