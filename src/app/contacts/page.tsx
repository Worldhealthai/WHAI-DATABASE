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
import { SENIORITY_LABELS, DEPARTMENT_LABELS } from '@/types'
import { cn } from '@/lib/utils'

async function fetchContacts(filters: ContactFilters, page: number, pageSize: number, sortBy: string, sortDir: string) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  params.set('sortBy', sortBy)
  params.set('sortDir', sortDir)

  if (filters.query) params.set('query', filters.query)
  filters.seniority?.forEach((s) => params.append('seniority', s))
  filters.department?.forEach((d) => params.append('department', d))
  filters.jobFunctionIds?.forEach((id) => params.append('jobFunctionIds', id))
  filters.companyTypes?.forEach((ct) => params.append('companyTypes', ct))
  filters.verticalIds?.forEach((id) => params.append('verticalIds', id))
  filters.therapeuticAreaIds?.forEach((id) => params.append('therapeuticAreaIds', id))
  filters.regionIds?.forEach((id) => params.append('regionIds', id))
  filters.countries?.forEach((c) => params.append('countries', c))
  filters.cities?.forEach((c) => params.append('cities', c))
  filters.tags?.forEach((t) => params.append('tags', t))
  if (filters.engagementMin !== undefined) params.set('engagementMin', String(filters.engagementMin))
  if (filters.engagementMax !== undefined) params.set('engagementMax', String(filters.engagementMax))
  if (filters.isVerified !== undefined) params.set('isVerified', String(filters.isVerified))

  const res = await fetch(`/api/contacts?${params}`)
  if (!res.ok) throw new Error('Failed to fetch contacts')
  return res.json()
}

async function fetchTaxonomy() {
  const res = await fetch('/api/taxonomy')
  if (!res.ok) throw new Error('Failed to fetch taxonomy')
  return res.json()
}

export default function ContactsPage() {
  const [filters, setFilters] = useState<ContactFilters>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('last_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const { data: taxonomy } = useQuery({
    queryKey: ['taxonomy'],
    queryFn: fetchTaxonomy,
  })

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
  const chips = buildChips(filters, taxonomy)

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
      c.first_name, c.last_name, c.email ?? '', c.job_title,
      c.company?.name ?? '', c.seniority_level ?? '', c.department ?? '',
      c.city ?? '', c.country ?? '', c.engagement_score,
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
              taxonomy={taxonomy}
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

function buildChips(filters: ContactFilters, taxonomy: any) {
  const chips: { key: string; label: string; value: string; displayValue: string }[] = []

  if (filters.query) {
    chips.push({ key: 'query', label: 'Search', value: filters.query, displayValue: filters.query })
  }

  filters.seniority?.forEach((s) =>
    chips.push({ key: 'seniority', label: 'Seniority', value: s, displayValue: SENIORITY_LABELS[s] ?? s })
  )

  filters.department?.forEach((d) =>
    chips.push({ key: 'department', label: 'Dept', value: d, displayValue: DEPARTMENT_LABELS[d] ?? d })
  )

  filters.jobFunctionIds?.forEach((id) => {
    const jf = taxonomy?.jobFunctions?.find((j: any) => j.id === id)
    chips.push({ key: 'jobFunctionIds', label: 'Function', value: id, displayValue: jf?.name ?? id })
  })

  filters.verticalIds?.forEach((id) => {
    const v = findVertical(taxonomy?.verticals ?? [], id)
    chips.push({ key: 'verticalIds', label: 'Vertical', value: id, displayValue: v?.name ?? id })
  })

  filters.therapeuticAreaIds?.forEach((id) => {
    const ta = taxonomy?.therapeuticAreas?.find((t: any) => t.id === id)
    chips.push({ key: 'therapeuticAreaIds', label: 'Therapy', value: id, displayValue: ta?.name ?? id })
  })

  filters.regionIds?.forEach((id) => {
    const r = findRegion(taxonomy?.regions ?? [], id)
    chips.push({ key: 'regionIds', label: 'Region', value: id, displayValue: r?.name ?? id })
  })

  if (filters.isVerified) {
    chips.push({ key: 'isVerified', label: 'Verified', value: 'true', displayValue: 'Verified Only' })
  }

  if (filters.engagementMin !== undefined) {
    chips.push({ key: 'engagementMin', label: 'Engagement', value: String(filters.engagementMin), displayValue: `≥ ${filters.engagementMin}` })
  }

  return chips
}

function findVertical(verticals: any[], id: string): any {
  for (const v of verticals) {
    if (v.id === id) return v
    if (v.children) {
      const found = findVertical(v.children, id)
      if (found) return found
    }
  }
  return null
}

function findRegion(regions: any[], id: string): any {
  for (const r of regions) {
    if (r.id === id) return r
    if (r.children) {
      const found = findRegion(r.children, id)
      if (found) return found
    }
  }
  return null
}
