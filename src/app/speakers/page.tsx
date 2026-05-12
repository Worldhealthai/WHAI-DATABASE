'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Download, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, X, Calendar, Pencil } from 'lucide-react'
import { FilterDropdown, ActiveFiltersBar } from '@/components/search/FilterDropdown'
import { Pagination } from '@/components/search/Pagination'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { SpeakerFormModal } from '@/components/crm/SpeakerFormModal'
import type { Speaker, SpeakerFilters } from '@/types'
import {
  SPEAKER_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  EVENT_OPTIONS,
  SUBTYPE_OPTIONS,
} from '@/types'
import { cn } from '@/lib/utils'

async function fetchSpeakers(
  filters: SpeakerFilters, page: number, pageSize: number, sortBy: string, sortDir: string,
) {
  const params = new URLSearchParams()
  params.set('page', String(page)); params.set('pageSize', String(pageSize))
  params.set('sortBy', sortBy); params.set('sortDir', sortDir)
  if (filters.query) params.set('query', filters.query)
  filters.statuses?.forEach((s) => params.append('statuses', s))
  filters.events?.forEach((e) => params.append('events', e))
  filters.subTypes?.forEach((t) => params.append('subTypes', t))
  filters.countries?.forEach((c) => params.append('countries', c))
  filters.years?.forEach((y) => params.append('years', String(y)))
  const res = await fetch(`/api/speakers?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: string }) {
  if (sortBy !== col) return <ChevronsUpDown className="w-3 h-3 text-slate-600" />
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-purple-400" /> : <ChevronDown className="w-3 h-3 text-purple-400" />
}

function initials(s: Speaker) {
  return `${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.toUpperCase()
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
          ? 'bg-purple-500 border-purple-500'
          : 'border-slate-600 hover:border-slate-400 bg-transparent'
      )}
    >
      {(checked || indeterminate) && (
        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
          {checked
            ? <path d="M1.5 5L3.8 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            : <path d="M2 5H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          }
        </svg>
      )}
    </button>
  )
}

const YEAR_TABS = [2026, 2027]

const COLS = [
  { key: 'firstName', label: 'Name' },
  { key: 'organization', label: 'Organisation' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'country', label: 'Country' },
  { key: 'status', label: 'Status' },
  { key: 'year', label: 'Year' },
  { key: 'createdAt', label: 'Added' },
]

export default function SpeakersPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<SpeakerFilters>({})
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showModal, setShowModal] = useState(false)
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['speakers', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchSpeakers(filters, page, pageSize, sortBy, sortDir),
    placeholderData: (prev) => prev,
  })

  useEffect(() => { setPage(1) }, [filters])

  const updateFilter = (key: keyof SpeakerFilters, value: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value.length ? value : undefined }))
    setSelected(new Set())
  }

  const handleKeywordChange = (val: string) => {
    setKeyword(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, query: val || undefined }))
      setPage(1)
    }, 350)
  }

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const clearAll = () => { setFilters({}); setKeyword(''); setPage(1); setSelected(new Set()); clearTimeout(debounceRef.current) }

  const activeEventTab = filters.events?.length === 1 ? filters.events[0] : ''
  const setEventTab = (event: string) => {
    setFilters((prev) => ({ ...prev, events: event ? [event] : undefined }))
    setPage(1)
    setSelected(new Set())
  }

  const activeYearTab = filters.years?.length === 1 ? filters.years[0] : 0
  const setYearTab = (year: number) => {
    setFilters((prev) => ({ ...prev, years: year ? [year] : undefined }))
    setPage(1)
    setSelected(new Set())
  }

  const rows: Speaker[] = data?.data ?? []
  const allPageSelected = rows.length > 0 && rows.every((s) => selected.has(s.id))
  const somePageSelected = rows.some((s) => selected.has(s.id))

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) rows.forEach((s) => next.delete(s.id))
      else rows.forEach((s) => next.add(s.id))
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
    if (!confirm(`Permanently delete ${selected.size} speaker${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      await Promise.allSettled([...selected].map((id) =>
        fetch(`/api/speakers/${id}`, { method: 'DELETE' })
      ))
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['speakers'] })
    } finally {
      setBulkDeleting(false)
    }
  }

  const exportCSV = (ids?: Set<string>) => {
    const source = (data?.data as Speaker[]) ?? []
    const out = (ids ? source.filter((s) => ids.has(s.id)) : source).map((s) => [
      s.firstName, s.lastName, s.email ?? '', s.phone ?? '', s.organization ?? '',
      s.jobTitle ?? '', s.country ?? '', s.event ?? '', s.subType ?? '',
      s.status, s.year ? String(s.year) : '', s.notes ?? '',
    ])
    const header = ['First Name', 'Last Name', 'Email', 'Phone', 'Organisation', 'Job Title', 'Country', 'Event', 'Type', 'Status', 'Year', 'Notes']
    const csv = [header, ...out].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'speakers.csv'; a.click()
  }

  const activeFilters: { category: string; key: string; value: string }[] = []
  if (filters.query) activeFilters.push({ category: 'Search', key: 'query', value: filters.query })
  filters.statuses?.forEach((s) => activeFilters.push({ category: 'Status', key: 'statuses', value: s }))
  filters.events?.forEach((e) => activeFilters.push({ category: 'Event', key: 'events', value: e }))
  filters.subTypes?.forEach((t) => activeFilters.push({ category: 'Type', key: 'subTypes', value: t }))
  filters.countries?.forEach((c) => activeFilters.push({ category: 'Country', key: 'countries', value: c }))

  const removeChip = (key: string, value: string) => {
    if (key === 'query') { setKeyword(''); setFilters((p) => { const n = { ...p }; delete n.query; return n }); return }
    setFilters((p) => {
      const n = { ...p } as any
      if (Array.isArray(n[key])) { n[key] = n[key].filter((v: string) => v !== value); if (!n[key].length) delete n[key] }
      return n
    })
  }

  const isYearTab = activeYearTab !== 0

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Header ── */}
      <div className="shrink-0 bg-[#0A1628] border-b border-[#1a3a5c] z-30">
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #a855f780 0%, #a855f730 50%, transparent 100%)' }} />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between pt-4 pb-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Speakers</h1>
              {data && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {data.total.toLocaleString()} records
                  {activeEventTab && <span className="text-purple-400"> · {activeEventTab}</span>}
                  {isYearTab && <span className="text-purple-400"> · {activeYearTab}</span>}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-500/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Speaker
            </button>
          </div>

          {/* Event tabs */}
          <div className="flex items-center gap-1.5 pb-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setEventTab('')}
              className={cn(
                'flex items-center px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 border',
                activeEventTab === ''
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/40'
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
                  activeEventTab === ev
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/40'
                    : 'text-slate-400 hover:text-white border-transparent hover:border-[#1a3a5c] hover:bg-[#112850]/50'
                )}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                {ev}
              </button>
            ))}
          </div>

          {/* Year tabs */}
          <div className="flex items-center gap-1.5 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setYearTab(0)}
              className={cn(
                'flex items-center px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 border',
                activeYearTab === 0
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/40'
                  : 'text-slate-500 hover:text-white border-transparent hover:border-[#1a3a5c] hover:bg-[#112850]/50'
              )}
            >
              All Years
            </button>
            {YEAR_TABS.map((year) => (
              <button
                key={year}
                onClick={() => setYearTab(year)}
                className={cn(
                  'flex items-center px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 border',
                  activeYearTab === year
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/40'
                    : 'text-slate-500 hover:text-white border-transparent hover:border-[#1a3a5c] hover:bg-[#112850]/50'
                )}
              >
                {year}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                value={keyword}
                onChange={(e) => handleKeywordChange(e.target.value)}
                placeholder="Search by name, email, organisation…"
                className="w-full pl-10 pr-10 py-2.5 bg-[#112850] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500/50 transition-colors"
              />
              {keyword && (
                <button onClick={() => handleKeywordChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <FilterDropdown label="Status" options={SPEAKER_STATUS_OPTIONS} selected={filters.statuses ?? []} onChange={(v) => updateFilter('statuses', v)} searchable={false} />
            <FilterDropdown label="Type" options={SUBTYPE_OPTIONS} selected={filters.subTypes ?? []} onChange={(v) => updateFilter('subTypes', v)} searchable={false} />
            <FilterDropdown label="Country" options={COUNTRY_OPTIONS} selected={filters.countries ?? []} onChange={(v) => updateFilter('countries', v)} />
          </div>

          {activeFilters.filter((f) => f.key !== 'events').length > 0 && (
            <ActiveFiltersBar
              filters={activeFilters.filter((f) => f.key !== 'events')}
              onRemove={removeChip}
              onClearAll={clearAll}
            />
          )}
        </div>
      </div>

      {/* ── Bulk actions bar ── */}
      {selected.size > 0 && (
        <div className="shrink-0 bg-[#0d2040] border-b border-purple-500/20 z-20">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-purple-400 shrink-0">{selected.size} selected</span>
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
              {isLoading ? 'Loading…' : (<><span className={cn('font-bold text-white', isFetching && 'opacity-50')}>{(data?.total ?? 0).toLocaleString()}</span> results</>)}
            </span>
            <button onClick={() => exportCSV()} disabled={!rows.length} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#112850] text-slate-300 hover:text-white text-xs font-medium border border-[#1a3a5c] hover:border-slate-500 disabled:opacity-40 transition-colors">
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
                    <div className="h-5 w-24 rounded-full bg-slate-700/30 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="py-16 text-center text-red-400 text-sm">Failed to load. Please refresh.</div>
            ) : !rows.length ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                {activeEventTab ? `No speakers for "${activeEventTab}" yet.` : 'No speaker leads found. Add your first one.'}
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a3a5c] bg-[#0d2040]">
                        <th className="pl-4 pr-2 py-2.5 w-8">
                          <Checkbox
                            checked={allPageSelected}
                            indeterminate={somePageSelected && !allPageSelected}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        {COLS.map((col) => (
                          <th key={col.key} onClick={() => handleSort(col.key)} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap">
                            <div className="flex items-center gap-1">{col.label}<SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} /></div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr key={s.id} className={cn('group/row border-b border-[#1a3a5c]/40 hover:bg-[#112850]/60 transition-colors', selected.has(s.id) && 'bg-purple-500/5 border-purple-500/20')}>
                          <td className="pl-4 pr-2 py-3">
                            <Checkbox checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/speakers/${s.id}`} className="flex items-center gap-3 group">
                              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">
                                {initials(s)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-white group-hover:text-purple-400 transition-colors">{s.firstName} {s.lastName}</div>
                                {s.email && <div className="text-xs text-slate-500 truncate">{s.email}</div>}
                                {s.event && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400/80 border border-purple-500/20 whitespace-nowrap">
                                      {s.event}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{s.organization ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{s.jobTitle ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{s.country ?? '—'}</td>
                          <td className="px-4 py-3">
                            <StatusBadge value={s.status} variant="speaker_status" />
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{s.year ?? <span className="text-slate-600">—</span>}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-3 py-3 w-10">
                            <button
                              onClick={(e) => { e.preventDefault(); setEditingSpeaker(s) }}
                              className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-purple-500/15 text-slate-500 hover:text-purple-400"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-[#1a3a5c]/40">
                  {rows.map((s) => (
                    <div key={s.id} className={cn('flex items-start gap-3 px-4 py-3 transition-colors', selected.has(s.id) ? 'bg-purple-500/5' : 'hover:bg-[#112850]/60')}>
                      <div className="pt-0.5">
                        <Checkbox checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                      </div>
                      <Link href={`/speakers/${s.id}`} className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{initials(s)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white">{s.firstName} {s.lastName}</div>
                          {s.organization && <div className="text-xs text-slate-400">{s.organization}</div>}
                          {s.event && <div className="text-[10px] text-purple-400/70 mt-0.5">{s.event}</div>}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <StatusBadge value={s.status} variant="speaker_status" />
                            {s.year && <span className="text-xs text-slate-500">{s.year}</span>}
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
            <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1) }} />
          )}
        </div>
      </div>

      {showModal && <SpeakerFormModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); refetch() }} />}
      {editingSpeaker && <SpeakerFormModal speaker={editingSpeaker} onClose={() => setEditingSpeaker(null)} onSaved={() => { setEditingSpeaker(null); refetch() }} />}
    </div>
  )
}
