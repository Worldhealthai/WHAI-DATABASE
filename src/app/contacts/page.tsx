'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Download, Save, SlidersHorizontal, X } from 'lucide-react'
import { ContactFilterSidebar } from '@/components/contacts/ContactFilters'
import { ContactsTable } from '@/components/contacts/ContactsTable'
import { FilterChips } from '@/components/search/FilterChips'
import { Pagination } from '@/components/search/Pagination'
import type { ContactFilters } from '@/types'
import { cn } from '@/lib/utils'

async function fetchContacts(filters: ContactFilters, page: number, pageSize: number, sortBy: string, sortDir: string) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  params.set('sortBy', sortBy)
  params.set('sortDir', sortDir)

  if (filters.query) params.set('query', filters.query)
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

export default function ContactsPage() {
  const [filters, setFilters] = useState<ContactFilters>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('lastName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['contacts', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchContacts(filters, page, pageSize, sortBy, sortDir),
    placeholderData: (prev) => prev,
  })

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [filters])

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  // Build filter chips
  const chips = buildChips(filters)

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

  const clearAll = () => setFilters({})

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

  const hasActiveFilters = chips.length > 0

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#0A1628] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors',
              sidebarOpen
                ? 'bg-[#00B4D8]/15 text-[#00B4D8]'
                : 'bg-[#112850] text-slate-300 hover:text-white',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#00B4D8] text-[#0A1628] text-[10px] font-bold">
                {chips.length}
              </span>
            )}
          </button>

          {data && (
            <span className="text-sm text-slate-400">
              <span className={cn('font-semibold text-white', isFetching && 'opacity-50')}>
                {data.total.toLocaleString()}
              </span>{' '}
              contacts
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#112850] text-slate-300 hover:text-white text-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        {sidebarOpen && (
          <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4 bg-[#0A1628]">
            <ContactFilterSidebar
              filters={filters}
              taxonomy={undefined}
              onChange={setFilters}
            />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Filter chips */}
          {hasActiveFilters && (
            <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAll} />
          )}

          {/* Table */}
          <div className="whai-card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
                Loading contacts…
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
        </div>
      </div>
    </div>
  )
}

function buildChips(filters: ContactFilters) {
  const chips: { key: string; label: string; value: string; displayValue: string }[] = []

  if (filters.query) {
    chips.push({ key: 'query', label: 'Search', value: filters.query, displayValue: filters.query })
  }

  filters.companyTypes?.forEach((t) =>
    chips.push({ key: 'companyTypes', label: 'Company Type', value: t, displayValue: t })
  )

  filters.verticalSlugs?.forEach((v) =>
    chips.push({ key: 'verticalSlugs', label: 'Vertical', value: v, displayValue: v })
  )

  filters.therapeuticAreas?.forEach((t) =>
    chips.push({ key: 'therapeuticAreas', label: 'Therapeutic Area', value: t, displayValue: t })
  )

  filters.countries?.forEach((c) =>
    chips.push({ key: 'countries', label: 'Country', value: c, displayValue: c })
  )

  filters.cities?.forEach((c) =>
    chips.push({ key: 'cities', label: 'City', value: c, displayValue: c })
  )

  filters.tags?.forEach((t) =>
    chips.push({ key: 'tags', label: 'Tag', value: t, displayValue: t })
  )

  if (filters.engagementMin !== undefined) {
    chips.push({ key: 'engagementMin', label: 'Engagement', value: String(filters.engagementMin), displayValue: `>= ${filters.engagementMin}` })
  }

  return chips
}
