'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Download, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { FilterDropdown, ActiveFiltersBar } from '@/components/search/FilterDropdown'
import { Pagination } from '@/components/search/Pagination'
import { StatusBadge } from '@/components/crm/StatusBadge'
import type { Delegate, DelegateFilters } from '@/types'
import {
  DELEGATE_STATUS_OPTIONS,
  DELEGATE_TICKET_OPTIONS,
  DELEGATE_SOURCE_OPTIONS,
  COUNTRY_OPTIONS,
  EVENT_OPTIONS,
  SUBTYPE_OPTIONS,
} from '@/types'
import { DelegateFormModal } from '@/components/crm/DelegateFormModal'

async function fetchDelegates(
  filters: DelegateFilters, page: number, pageSize: number, sortBy: string, sortDir: string,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  params.set('sortBy', sortBy)
  params.set('sortDir', sortDir)
  if (filters.query) params.set('query', filters.query)
  filters.statuses?.forEach((s) => params.append('statuses', s))
  filters.events?.forEach((e) => params.append('events', e))
  filters.subTypes?.forEach((t) => params.append('subTypes', t))
  filters.ticketTypes?.forEach((t) => params.append('ticketTypes', t))
  filters.countries?.forEach((c) => params.append('countries', c))
  filters.sources?.forEach((s) => params.append('sources', s))
  filters.tags?.forEach((t) => params.append('tags', t))
  const res = await fetch(`/api/delegates?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: string }) {
  if (sortBy !== col) return <ChevronsUpDown className="w-3 h-3 text-slate-600" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-[#00B4D8]" />
    : <ChevronDown className="w-3 h-3 text-[#00B4D8]" />
}

function initials(d: Delegate) {
  return `${d.firstName?.[0] ?? ''}${d.lastName?.[0] ?? ''}`.toUpperCase()
}

export default function DelegatesPage() {
  const [filters, setFilters] = useState<DelegateFilters>({})
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['delegates', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchDelegates(filters, page, pageSize, sortBy, sortDir),
    placeholderData: (prev) => prev,
  })

  useEffect(() => { setPage(1) }, [filters])

  const updateFilter = (key: keyof DelegateFilters, value: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value.length ? value : undefined }))
  }

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, query: keyword || undefined }))
    setPage(1)
  }

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const clearAll = () => { setFilters({}); setKeyword(''); setPage(1) }

  const activeFilters: { category: string; key: string; value: string }[] = []
  if (filters.query) activeFilters.push({ category: 'Search', key: 'query', value: filters.query })
  filters.statuses?.forEach((s) => activeFilters.push({ category: 'Status', key: 'statuses', value: s }))
  filters.events?.forEach((e) => activeFilters.push({ category: 'Event', key: 'events', value: e }))
  filters.subTypes?.forEach((t) => activeFilters.push({ category: 'Type', key: 'subTypes', value: t }))
  filters.ticketTypes?.forEach((t) => activeFilters.push({ category: 'Ticket', key: 'ticketTypes', value: t }))
  filters.countries?.forEach((c) => activeFilters.push({ category: 'Country', key: 'countries', value: c }))
  filters.sources?.forEach((s) => activeFilters.push({ category: 'Source', key: 'sources', value: s }))
  filters.tags?.forEach((t) => activeFilters.push({ category: 'Tag', key: 'tags', value: t }))

  const removeChip = (key: string, value: string) => {
    if (key === 'query') { setKeyword(''); setFilters((p) => { const n = { ...p }; delete n.query; return n }); return }
    setFilters((p) => {
      const n = { ...p } as any
      if (Array.isArray(n[key])) {
        n[key] = n[key].filter((v: string) => v !== value)
        if (!n[key].length) delete n[key]
      }
      return n
    })
  }

  const exportCSV = () => {
    if (!data?.data) return
    const rows = (data.data as Delegate[]).map((d) => [
      d.firstName, d.lastName, d.email ?? '', d.phone ?? '', d.organization ?? '',
      d.jobTitle ?? '', d.country ?? '', d.city ?? '', d.status, d.ticketType ?? '', d.source ?? '',
    ])
    const header = ['First Name', 'Last Name', 'Email', 'Phone', 'Organisation', 'Job Title', 'Country', 'City', 'Status', 'Ticket Type', 'Source']
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'delegates.csv'; a.click()
  }

  const COLS = [
    { key: 'firstName', label: 'Name' },
    { key: 'organization', label: 'Organisation' },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'status', label: 'Status' },
    { key: 'ticketType', label: 'Ticket' },
    { key: 'country', label: 'Country' },
    { key: 'createdAt', label: 'Added' },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="shrink-0 bg-[#0A1628] border-b border-[#1a3a5c] z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between pt-4 pb-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Delegates</h1>
              {data && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {data.total.toLocaleString()} {data.total === 1 ? 'record' : 'records'}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00B4D8] text-[#0A1628] text-sm font-semibold hover:bg-[#00B4D8]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Delegate
            </button>
          </div>

          {/* Search bar */}
          <div className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name, email, organisation..."
                className="w-full pl-10 pr-24 py-2.5 bg-[#112850] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50 transition-colors"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-[#00B4D8] text-[#0A1628] text-xs font-semibold hover:bg-[#00B4D8]/90 transition-colors"
              >
                Search
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <FilterDropdown label="Status" options={DELEGATE_STATUS_OPTIONS} selected={filters.statuses ?? []} onChange={(v) => updateFilter('statuses', v)} searchable={false} />
            <FilterDropdown label="Event" options={EVENT_OPTIONS} selected={filters.events ?? []} onChange={(v) => updateFilter('events', v)} searchable={false} />
            <FilterDropdown label="Type" options={SUBTYPE_OPTIONS} selected={filters.subTypes ?? []} onChange={(v) => updateFilter('subTypes', v)} searchable={false} />
            <FilterDropdown label="Ticket Type" options={DELEGATE_TICKET_OPTIONS} selected={filters.ticketTypes ?? []} onChange={(v) => updateFilter('ticketTypes', v)} searchable={false} />
            <FilterDropdown label="Country" options={COUNTRY_OPTIONS} selected={filters.countries ?? []} onChange={(v) => updateFilter('countries', v)} />
            <FilterDropdown label="Source" options={DELEGATE_SOURCE_OPTIONS} selected={filters.sources ?? []} onChange={(v) => updateFilter('sources', v)} searchable={false} />
          </div>

          {activeFilters.length > 0 && (
            <ActiveFiltersBar filters={activeFilters} onRemove={removeChip} onClearAll={clearAll} />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {isLoading ? 'Loading…' : (
                <>
                  <span className={`font-bold text-white ${isFetching ? 'opacity-50' : ''}`}>
                    {(data?.total ?? 0).toLocaleString()}
                  </span>{' '}results
                </>
              )}
            </span>
            <button
              onClick={exportCSV}
              disabled={!data?.data?.length}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#112850] text-slate-300 hover:text-white text-xs font-medium border border-[#1a3a5c] hover:border-slate-500 disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>

          {/* Table */}
          <div className="whai-card overflow-hidden">
            {isLoading ? (
              <div className="space-y-0">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#1a3a5c]/50">
                    <div className="w-8 h-8 rounded-full bg-slate-700/50 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-36 rounded bg-slate-700/50 animate-pulse" />
                      <div className="h-2.5 w-24 rounded bg-slate-700/30 animate-pulse" />
                    </div>
                    <div className="h-5 w-20 rounded-full bg-slate-700/30 animate-pulse" />
                    <div className="h-3 w-16 rounded bg-slate-700/30 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="py-16 text-center text-red-400 text-sm">Failed to load. Please refresh.</div>
            ) : !data?.data?.length ? (
              <div className="py-16 text-center text-slate-500 text-sm">No delegates found. Add your first one.</div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a3a5c] bg-[#0d2040]">
                        {COLS.map((col) => (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap"
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              <SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(data.data as Delegate[]).map((d) => (
                        <tr
                          key={d.id}
                          className="border-b border-[#1a3a5c]/40 hover:bg-[#112850]/60 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <Link href={`/delegates/${d.id}`} className="flex items-center gap-3 group">
                              <div className="w-8 h-8 rounded-full bg-[#00B4D8]/20 text-[#00B4D8] flex items-center justify-center text-xs font-bold shrink-0">
                                {initials(d)}
                              </div>
                              <div>
                                <div className="font-medium text-white group-hover:text-[#00B4D8] transition-colors">
                                  {d.firstName} {d.lastName}
                                </div>
                                {d.email && <div className="text-xs text-slate-500">{d.email}</div>}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{d.organization ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{d.jobTitle ?? '—'}</td>
                          <td className="px-4 py-3">
                            <StatusBadge value={d.status} variant="delegate_status" />
                          </td>
                          <td className="px-4 py-3">
                            {d.ticketType ? <StatusBadge value={d.ticketType} variant="ticket_type" /> : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{d.country ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {new Date(d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-[#1a3a5c]/40">
                  {(data.data as Delegate[]).map((d) => (
                    <Link key={d.id} href={`/delegates/${d.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-[#112850]/60 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-[#00B4D8]/20 text-[#00B4D8] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {initials(d)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white">{d.firstName} {d.lastName}</div>
                        {d.organization && <div className="text-xs text-slate-400">{d.organization}</div>}
                        {d.email && <div className="text-xs text-slate-500 truncate">{d.email}</div>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <StatusBadge value={d.status} variant="delegate_status" />
                          {d.ticketType && <StatusBadge value={d.ticketType} variant="ticket_type" />}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Pagination */}
          {data && data.total > 0 && (
            <Pagination
              page={page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={(s) => { setPageSize(s); setPage(1) }}
            />
          )}
        </div>
      </div>

      {showModal && (
        <DelegateFormModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); refetch() }}
        />
      )}
    </div>
  )
}
