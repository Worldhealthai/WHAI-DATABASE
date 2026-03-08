'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Search, Sparkles, SlidersHorizontal, LayoutGrid, Table2 } from 'lucide-react'
import { ContactsTable } from '@/components/contacts/ContactsTable'
import { FilterDropdown, ActiveFiltersBar } from '@/components/search/FilterDropdown'
import { Pagination } from '@/components/search/Pagination'
import type { ContactFilters } from '@/types'
import {
  SENIORITY_OPTIONS,
  DEPARTMENT_OPTIONS,
  COMPANY_TYPE_OPTIONS,
} from '@/types'
import { cn } from '@/lib/utils'

// ── Static filter options ────────────────────────────────────────────────────

const COUNTRY_OPTIONS = [
  'United States', 'United Kingdom', 'Germany', 'Switzerland', 'Ireland',
  'France', 'Canada', 'Netherlands', 'Singapore', 'Japan',
]

const TAG_OPTIONS = [
  'executive', 'pharma', 'biotech', 'medtech', 'oncology', 'clinical',
  'AI', 'data', 'analytics', 'data-science', 'cloud', 'telehealth',
  'mRNA', 'product', 'R&D',
]

// ── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchContacts(
  filters: ContactFilters, page: number, pageSize: number, sortBy: string, sortDir: string,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  params.set('sortBy', sortBy)
  params.set('sortDir', sortDir)

  if (filters.query) params.set('query', filters.query)
  filters.seniorities?.forEach((s) => params.append('seniorities', s))
  filters.departments?.forEach((d) => params.append('departments', d))
  filters.companyTypes?.forEach((t) => params.append('companyTypes', t))
  filters.verticalSlugs?.forEach((v) => params.append('verticalSlugs', v))
  filters.therapeuticAreas?.forEach((t) => params.append('therapeuticAreas', t))
  filters.countries?.forEach((c) => params.append('countries', c))
  filters.cities?.forEach((c) => params.append('cities', c))
  filters.tags?.forEach((t) => params.append('tags', t))
  if (filters.engagementMin !== undefined) params.set('engagementMin', String(filters.engagementMin))
  if (filters.engagementMax !== undefined) params.set('engagementMax', String(filters.engagementMax))

  const res = await fetch(`/api/contacts?${params}`)
  if (!res.ok) throw new Error('Failed to fetch contacts')
  return res.json()
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [filters, setFilters] = useState<ContactFilters>({})
  const [hasSearched, setHasSearched] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('lastName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [keyword, setKeyword] = useState('')

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['contacts', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchContacts(filters, page, pageSize, sortBy, sortDir),
    enabled: hasSearched,
    placeholderData: (prev) => prev,
    retry: 2,
  })

  useEffect(() => { setPage(1) }, [filters])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const updateFilter = (key: keyof ContactFilters, value: string[]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value.length > 0 ? value : undefined,
    }))
  }

  const handleSearch = () => {
    setFilters((prev) => ({
      ...prev,
      query: keyword || undefined,
    }))
    setHasSearched(true)
    setPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const clearAll = () => {
    setFilters({})
    setKeyword('')
    setHasSearched(false)
    setPage(1)
  }

  // ── Active filters for chips bar ─────────────────────────────────────────

  const activeFilters: { category: string; key: string; value: string }[] = []
  if (filters.query) activeFilters.push({ category: 'Search', key: 'query', value: filters.query })
  filters.seniorities?.forEach((s) => activeFilters.push({ category: 'Seniority', key: 'seniorities', value: s }))
  filters.departments?.forEach((d) => activeFilters.push({ category: 'Department', key: 'departments', value: d }))
  filters.companyTypes?.forEach((t) => activeFilters.push({ category: 'Company Type', key: 'companyTypes', value: t }))
  filters.countries?.forEach((c) => activeFilters.push({ category: 'Location', key: 'countries', value: c }))
  filters.tags?.forEach((t) => activeFilters.push({ category: 'Tags', key: 'tags', value: t }))

  const removeChip = (key: string, value: string) => {
    if (key === 'query') {
      setKeyword('')
      setFilters((prev) => { const n = { ...prev }; delete n.query; return n })
      return
    }
    setFilters((prev) => {
      const next = { ...prev } as any
      if (Array.isArray(next[key])) {
        next[key] = next[key].filter((v: string) => v !== value)
        if (next[key].length === 0) delete next[key]
      }
      return next
    })
  }

  const exportCSV = () => {
    if (!data?.data) return
    const rows = data.data.map((c: any) => [
      c.firstName, c.lastName, c.email ?? '', c.jobTitle,
      c.company?.name ?? '', c.seniority ?? '', c.department ?? '',
      c.city ?? '', c.country ?? '', c.engagementScore,
    ])
    const header = ['First Name', 'Last Name', 'Email', 'Job Title', 'Company', 'Seniority', 'Department', 'City', 'Country', 'Engagement Score']
    const csv = [header, ...rows].map((r) => r.map((v: any) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'whai-contacts.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Header area ─────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0A1628] border-b border-[#1a3a5c] relative z-30 overflow-visible">
        <div className="max-w-[1400px] mx-auto px-5 overflow-visible">
          {/* Title row */}
          <div className="pt-5 pb-4">
            <h1 className="text-xl font-bold text-white">Contacts Advanced Search</h1>
          </div>

          {/* AI-style search bar */}
          <div className="pb-4">
            <div className="relative">
              <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Find healthcare contacts who..."
                className="w-full pl-11 pr-24 py-3 bg-[#112850] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50 transition-colors"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#00B4D8] text-[#0A1628] text-sm font-semibold hover:bg-[#00B4D8]/90 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                Search
              </button>
            </div>
          </div>

          {/* Filter dropdowns row */}
          <div className="flex items-center gap-2 pb-4 overflow-visible">
            <FilterDropdown
              label="Seniority"
              options={SENIORITY_OPTIONS}
              selected={filters.seniorities ?? []}
              onChange={(v) => updateFilter('seniorities', v)}
              searchable={false}
            />
            <FilterDropdown
              label="Department"
              options={DEPARTMENT_OPTIONS}
              selected={filters.departments ?? []}
              onChange={(v) => updateFilter('departments', v)}
              searchable={false}
            />
            <FilterDropdown
              label="Company Type"
              options={COMPANY_TYPE_OPTIONS}
              selected={filters.companyTypes ?? []}
              onChange={(v) => updateFilter('companyTypes', v)}
            />
            <FilterDropdown
              label="Location"
              options={COUNTRY_OPTIONS}
              selected={filters.countries ?? []}
              onChange={(v) => updateFilter('countries', v)}
            />
            <FilterDropdown
              label="Tags"
              options={TAG_OPTIONS}
              selected={filters.tags ?? []}
              onChange={(v) => updateFilter('tags', v)}
            />

            {/* Engagement range */}
            <div className="flex items-center gap-1.5 ml-1 pl-3 border-l border-[#1a3a5c]">
              <span className="text-xs text-slate-500 whitespace-nowrap">Score</span>
              <input
                type="number"
                min={0} max={100}
                value={filters.engagementMin ?? ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    engagementMin: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
                placeholder="Min"
                className="w-16 px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-xs text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50"
              />
              <span className="text-slate-600">–</span>
              <input
                type="number"
                min={0} max={100}
                value={filters.engagementMax ?? ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    engagementMax: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
                placeholder="Max"
                className="w-16 px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-xs text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50"
              />
            </div>

            {/* Keyword search inline */}
            <div className="relative ml-1 pl-3 border-l border-[#1a3a5c]">
              <Search className="absolute left-5.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search keyword and filter"
                className="w-48 pl-8 pr-3 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-xs text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50"
              />
            </div>
          </div>

          {/* Active filter chips (Preqin-style grouped) */}
          {activeFilters.length > 0 && (
            <ActiveFiltersBar
              filters={activeFilters}
              onRemove={removeChip}
              onClearAll={clearAll}
            />
          )}
        </div>
      </div>

      {/* ── Results area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-[1400px] mx-auto px-5 py-4 space-y-3">
          {!hasSearched ? (
            /* Empty state — prompt to search */
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#112850] border border-[#1a3a5c] mb-5">
                <Search className="w-7 h-7 text-slate-500" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Select your search criteria
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                Use the filters above to define who you&apos;re looking for, then click Search to find matching healthcare contacts.
              </p>
              <button
                onClick={handleSearch}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#00B4D8] text-white font-semibold text-sm hover:bg-[#00B4D8]/90 transition-colors"
              >
                <Search className="w-4 h-4" />
                Search All Contacts
              </button>
            </div>
          ) : (
            <>
              {/* Results toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {data && (
                    <span className="text-sm text-slate-300">
                      <span className={cn('font-bold text-white', isFetching && 'opacity-50')}>
                        {data.total.toLocaleString()}
                      </span>{' '}
                      results
                    </span>
                  )}
                  {isLoading && (
                    <span className="text-sm text-slate-500">Searching...</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={exportCSV}
                    disabled={!data?.data?.length}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#112850] text-slate-300 hover:text-white text-xs font-medium border border-[#1a3a5c] hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="whai-card overflow-hidden">
                {isLoading ? (
                  <div className="space-y-0">
                    {/* Skeleton rows */}
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#1a3a5c]/50">
                        <div className="w-7 h-7 rounded-full bg-slate-700/50 animate-pulse" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-40 rounded bg-slate-700/50 animate-pulse" />
                          <div className="h-2.5 w-28 rounded bg-slate-700/30 animate-pulse" />
                        </div>
                        <div className="h-3 w-24 rounded bg-slate-700/30 animate-pulse" />
                        <div className="h-5 w-16 rounded-full bg-slate-700/30 animate-pulse" />
                        <div className="h-3 w-20 rounded bg-slate-700/30 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center py-16 text-red-400 text-sm">
                    Failed to load contacts. Please try refreshing.
                  </div>
                ) : (
                  <ContactsTable
                    contacts={data?.data ?? []}
                    sort={{ sortBy, sortDir }}
                    onSort={handleSort}
                  />
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
                  onPageSize={(size) => { setPageSize(size); setPage(1) }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
