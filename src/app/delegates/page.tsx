'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Download, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, X, Calendar } from 'lucide-react'
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
import { cn } from '@/lib/utils'

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

function Checkbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className={cn(
        'w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
        checked || indeterminate
          ? 'bg-[#00B4D8] border-[#00B4D8]'
          : 'border-slate-600 hover:border-slate-400 bg-transparent'
      )}
    >
      {(checked || indeterminate) && (
        <svg className="w-2.5 h-2.5 text-[#0A1628]" viewBox="0 0 10 10" fill="none">
          {checked
            ? <path d="M1.5 5L3.8 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            : <path d="M2 5H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          }
        </svg>
      )}
    </button>
  )
}

export default function DelegatesPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<DelegateFilters>({})
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['delegates', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchDelegates(filters, page, pageSize, sortBy, sortDir),
    placeholderData: (prev) => prev,
  })

  useEffect(() => { setPage(1) }, [filters])

  const updateFilter = (key: keyof DelegateFilters, value: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value.length ? value : undefined }))
    setSelected(new Set())
  }

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, query: keyword || undefined }))
    setPage(1)
  }

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const clearAll = () => { setFilters({}); setKeyword(''); setPage(1); setSelected(new Set()) }

  // Event / rejected tab helpers
  const isRejectedTab = filters.statuses?.length === 1 && filters.statuses[0] === 'Rejected'
  const activeEventTab = isRejectedTab ? '' : (filters.events?.length === 1 ? filters.events[0] : '')
  const setEventTab = (event: string) => {
    setFilters((prev) => {
      const next = { ...prev, events: event ? [event] : undefined }
      if (next.statuses?.length === 1 && next.statuses[0] === 'Rejected') delete next.statuses
      return next
    })
    setPage(1)
    setSelected(new Set())
  }
  const setRejectedTab = () => {
    setFilters((prev) => ({ ...prev, statuses: ['Rejected'], events: undefined }))
    setPage(1)
    setSelected(new Set())
  }

  // Selection helpers
  const rows: Delegate[] = data?.data ?? []
  const allPageSelected = rows.length > 0 && rows.every((d) => selected.has(d.id))
  const somePageSelected = rows.some((d) => selected.has(d.id))

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) rows.forEach((d) => next.delete(d.id))
      else rows.forEach((d) => next.add(d.id))
      return next
    })
  }

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkDelete = async () => {
    if (!selected.size) return
    if (!confirm(`Permanently delete ${selected.size} delegate${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      await Promise.allSettled([...selected].map((id) =>
        fetch(`/api/delegates/${id}`, { method: 'DELETE' })
      ))
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['delegates'] })
    } finally {
      setBulkDeleting(false)
    }
  }

  const exportCSV = (ids?: Set<string>) => {
    const source = (data?.data as Delegate[]) ?? []
    const rows = ids ? source.filter((d) => ids.has(d.id)) : source
    if (!rows.length) return
    const out = rows.map((d) => [
      d.firstName, d.lastName, d.email ?? '', d.phone ?? '', d.organization ?? '',
      d.jobTitle ?? '', d.country ?? '', d.city ?? '', d.status, d.event ?? '',
      d.subType ?? '', d.ticketType ?? '', d.source ?? '',
    ])
    const header = ['First Name', 'Last Name', 'Email', 'Phone', 'Organisation', 'Job Title', 'Country', 'City', 'Status', 'Event', 'Type', 'Ticket Type', 'Source']
    const csv = [header, ...out].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'delegates.csv'; a.click()
  }

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
      {/* ── Header ── */}
      <div className="shrink-0 bg-[#0A1628] border-b border-[#1a3a5c] z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between pt-4 pb-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Delegates</h1>
              {data && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {data.total.toLocaleString()} {data.total === 1 ? 'record' : 'records'}
                  {isRejectedTab ? <span className="text-rose-400"> · Rejected</span> : activeEventTab && <span className="text-[#00B4D8]"> · {activeEventTab}</span>}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00B4D8] text-[#0A1628] text-sm font-semibold hover:bg-[#00B4D8]/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Delegate
            </button>
          </div>

          {/* Event + Rejected tabs */}
          <div className="flex items-center gap-1.5 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setEventTab('')}
              className={cn(
                'flex items-center px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 border',
                !isRejectedTab && activeEventTab === ''
                  ? 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/40'
                  : 'text-slate-400 hover:text-white border-transparent hover:border-[#1a3a5c] hover:bg-[#112850]/50'
              )}
            >
              All Events
            </button>
            {EVENT_OPTIONS.map((ev) => (
              <button
                key={ev}
                onClick={() => setEventTab(ev)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 border',
                  !isRejectedTab && activeEventTab === ev
                    ? 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/40'
                    : 'text-slate-400 hover:text-white border-transparent hover:border-[#1a3a5c] hover:bg-[#112850]/50'
                )}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                {ev}
              </button>
            ))}
            <div className="w-px h-5 bg-[#1a3a5c] shrink-0 mx-1" />
            <button
              onClick={setRejectedTab}
              className={cn(
                'flex items-center px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 border',
                isRejectedTab
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                  : 'text-slate-400 hover:text-white border-transparent hover:border-[#1a3a5c] hover:bg-[#112850]/50'
              )}
            >
              Rejected
            </button>
          </div>

          {/* Search */}
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
            <FilterDropdown label="Type" options={SUBTYPE_OPTIONS} selected={filters.subTypes ?? []} onChange={(v) => updateFilter('subTypes', v)} searchable={false} />
            <FilterDropdown label="Ticket Type" options={DELEGATE_TICKET_OPTIONS} selected={filters.ticketTypes ?? []} onChange={(v) => updateFilter('ticketTypes', v)} searchable={false} />
            <FilterDropdown label="Country" options={COUNTRY_OPTIONS} selected={filters.countries ?? []} onChange={(v) => updateFilter('countries', v)} />
            <FilterDropdown label="Source" options={DELEGATE_SOURCE_OPTIONS} selected={filters.sources ?? []} onChange={(v) => updateFilter('sources', v)} searchable={false} />
          </div>

          {activeFilters.filter((f) => f.key !== 'events' && !(isRejectedTab && f.key === 'statuses' && f.value === 'Rejected')).length > 0 && (
            <ActiveFiltersBar
              filters={activeFilters.filter((f) => f.key !== 'events' && !(isRejectedTab && f.key === 'statuses' && f.value === 'Rejected'))}
              onRemove={removeChip}
              onClearAll={clearAll}
            />
          )}
        </div>
      </div>

      {/* ── Bulk actions bar ── */}
      {selected.size > 0 && (
        <div className="shrink-0 bg-[#0d2040] border-b border-[#00B4D8]/20 z-20">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-[#00B4D8] shrink-0">
              {selected.size} selected
            </span>
            <button
              onClick={() => exportCSV(selected)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Export selected
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-50',
                bulkDeleting && 'animate-pulse'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkDeleting ? 'Deleting…' : 'Delete selected'}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {isLoading ? 'Loading…' : (
                <><span className={cn('font-bold text-white', isFetching && 'opacity-50')}>{(data?.total ?? 0).toLocaleString()}</span> results</>
              )}
            </span>
            <button
              onClick={() => exportCSV()}
              disabled={!data?.data?.length}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#112850] text-slate-300 hover:text-white text-xs font-medium border border-[#1a3a5c] hover:border-slate-500 disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          <div className="whai-card overflow-hidden">
            {isLoading ? (
              <div>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#1a3a5c]/50">
                    <div className="w-4 h-4 rounded bg-slate-700/50 animate-pulse shrink-0" />
                    <div className="w-8 h-8 rounded-full bg-slate-700/50 animate-pulse shrink-0" />
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
            ) : !rows.length ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                {isRejectedTab ? 'No rejected delegates yet.' : activeEventTab ? `No delegates for "${activeEventTab}" yet.` : 'No delegates found. Add your first one.'}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a3a5c] bg-[#0d2040]">
                        {/* Select all */}
                        <th className="pl-4 pr-2 py-2.5 w-8">
                          <Checkbox
                            checked={allPageSelected}
                            indeterminate={somePageSelected && !allPageSelected}
                            onChange={toggleSelectAll}
                          />
                        </th>
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
                      {rows.map((d) => (
                        <tr
                          key={d.id}
                          className={cn(
                            'border-b border-[#1a3a5c]/40 hover:bg-[#112850]/60 transition-colors',
                            selected.has(d.id) && 'bg-[#00B4D8]/5 border-[#00B4D8]/20'
                          )}
                        >
                          <td className="pl-4 pr-2 py-3">
                            <Checkbox checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} />
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/delegates/${d.id}`} className="flex items-center gap-3 group">
                              <div className="w-8 h-8 rounded-full bg-[#00B4D8]/20 text-[#00B4D8] flex items-center justify-center text-xs font-bold shrink-0">
                                {initials(d)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-white group-hover:text-[#00B4D8] transition-colors">
                                  {d.firstName} {d.lastName}
                                </div>
                                {d.email && <div className="text-xs text-slate-500 truncate">{d.email}</div>}
                                {d.event && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00B4D8]/10 text-[#00B4D8]/80 border border-[#00B4D8]/20 whitespace-nowrap">
                                      {d.event}
                                    </span>
                                    {d.subType && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700">
                                        {d.subType}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{d.organization ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{d.jobTitle ?? '—'}</td>
                          <td className="px-4 py-3"><StatusBadge value={d.status} variant="delegate_status" /></td>
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
                  {rows.map((d) => (
                    <div
                      key={d.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors',
                        selected.has(d.id) ? 'bg-[#00B4D8]/5' : 'hover:bg-[#112850]/60'
                      )}
                    >
                      <div className="pt-0.5">
                        <Checkbox checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} />
                      </div>
                      <Link href={`/delegates/${d.id}`} className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#00B4D8]/20 text-[#00B4D8] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {initials(d)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white">{d.firstName} {d.lastName}</div>
                          {d.organization && <div className="text-xs text-slate-400">{d.organization}</div>}
                          {d.event && <div className="text-[10px] text-[#00B4D8]/70 mt-0.5">{d.event}</div>}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <StatusBadge value={d.status} variant="delegate_status" />
                            {d.ticketType && <StatusBadge value={d.ticketType} variant="ticket_type" />}
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

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
