'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Search, Users } from 'lucide-react'
import { ContactsTable } from '@/components/contacts/ContactsTable'
import { FilterChips } from '@/components/search/FilterChips'
import { Pagination } from '@/components/search/Pagination'
import type { ContactFilters } from '@/types'
import {
  SENIORITY_OPTIONS,
  DEPARTMENT_OPTIONS,
  COMPANY_TYPE_OPTIONS,
} from '@/types'
import { cn } from '@/lib/utils'

const COUNTRY_OPTIONS = [
  'United States', 'United Kingdom', 'Germany', 'Switzerland', 'Ireland',
]

const TAG_OPTIONS = [
  'executive', 'pharma', 'biotech', 'medtech', 'oncology', 'clinical',
  'AI', 'data', 'analytics', 'data-science', 'cloud', 'telehealth',
  'mRNA', 'product', 'R&D',
]

async function fetchContacts(filters: ContactFilters, page: number, pageSize: number, sortBy: string, sortDir: string) {
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

// ── Pill selector component ──────────────────────────────────────────────────

function PillSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter((s) => s !== val))
    else onChange([...selected, val])
  }
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt)
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                active
                  ? 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/40'
                  : 'bg-[#112850]/60 text-slate-400 border-[#1a3a5c] hover:text-white hover:border-slate-500',
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  // Staged filters (user builds these before searching)
  const [staged, setStaged] = useState<ContactFilters>({})
  // Active filters (submitted to the API)
  const [filters, setFilters] = useState<ContactFilters | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('lastName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const hasSearched = filters !== null

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['contacts', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchContacts(filters ?? {}, page, pageSize, sortBy, sortDir),
    enabled: hasSearched,
    placeholderData: (prev) => prev,
    retry: 2,
  })

  useEffect(() => { setPage(1) }, [filters])

  const handleSearch = () => {
    setFilters({ ...staged })
    setPage(1)
  }

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const updateStaged = (partial: Partial<ContactFilters>) =>
    setStaged((prev) => ({ ...prev, ...partial }))

  const chips = filters ? buildChips(filters) : []

  const removeChip = (key: string, value: string) => {
    setFilters((prev) => {
      if (!prev) return prev
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

  const clearAll = () => {
    setFilters(null)
    setStaged({})
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

  const stagedCount =
    (staged.seniorities?.length ?? 0) +
    (staged.departments?.length ?? 0) +
    (staged.companyTypes?.length ?? 0) +
    (staged.countries?.length ?? 0) +
    (staged.tags?.length ?? 0) +
    (staged.query ? 1 : 0)

  // ── Search-first screen ──────────────────────────────────────────────────

  if (!hasSearched) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00B4D8]/10 border border-[#00B4D8]/20 text-[#00B4D8] text-xs font-medium">
            <Users className="w-3 h-3" /> Contact Screener
          </div>
          <h1 className="text-3xl font-bold text-white">
            Who are you looking for?
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            Select your search criteria below, then hit search to find matching healthcare contacts.
          </p>
        </div>

        {/* Search form card */}
        <div className="whai-card p-6 space-y-6">
          {/* Keyword */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Keyword Search
            </label>
            <input
              value={staged.query ?? ''}
              onChange={(e) => updateStaged({ query: e.target.value || undefined })}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Name, job title, company..."
              className="w-full px-4 py-2.5 bg-[#112850] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8] transition-colors"
            />
          </div>

          {/* Seniority */}
          <PillSelect
            label="Seniority Level"
            options={SENIORITY_OPTIONS}
            selected={staged.seniorities ?? []}
            onChange={(seniorities) => updateStaged({ seniorities: seniorities.length ? seniorities : undefined })}
          />

          {/* Department */}
          <PillSelect
            label="Department"
            options={DEPARTMENT_OPTIONS}
            selected={staged.departments ?? []}
            onChange={(departments) => updateStaged({ departments: departments.length ? departments : undefined })}
          />

          {/* Company Type */}
          <PillSelect
            label="Company Type"
            options={COMPANY_TYPE_OPTIONS}
            selected={staged.companyTypes ?? []}
            onChange={(companyTypes) => updateStaged({ companyTypes: companyTypes.length ? companyTypes : undefined })}
          />

          {/* Country */}
          <PillSelect
            label="Country"
            options={COUNTRY_OPTIONS}
            selected={staged.countries ?? []}
            onChange={(countries) => updateStaged({ countries: countries.length ? countries : undefined })}
          />

          {/* Tags */}
          <PillSelect
            label="Tags"
            options={TAG_OPTIONS}
            selected={staged.tags ?? []}
            onChange={(tags) => updateStaged({ tags: tags.length ? tags : undefined })}
          />

          {/* Search button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              {stagedCount > 0
                ? `${stagedCount} filter${stagedCount > 1 ? 's' : ''} selected`
                : 'No filters — will return all contacts'}
            </span>
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#00B4D8] text-white font-semibold text-sm hover:bg-[#00B4D8]/90 transition-colors"
            >
              <Search className="w-4 h-4" />
              Search Contacts
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Results screen ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#0A1628] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm bg-[#112850] text-slate-300 hover:text-white transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            New Search
          </button>

          {data && (
            <span className="text-sm text-slate-400">
              <span className={cn('font-semibold text-white', isFetching && 'opacity-50')}>
                {data.total.toLocaleString()}
              </span>{' '}
              contacts found
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

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Filter chips */}
        {chips.length > 0 && (
          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAll} />
        )}

        {/* Table */}
        <div className="whai-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
              Searching contacts...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 text-red-400 text-sm">
              <p>Failed to load contacts. Please try refreshing.</p>
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
  )
}

function buildChips(filters: ContactFilters) {
  const chips: { key: string; label: string; value: string; displayValue: string }[] = []

  if (filters.query) {
    chips.push({ key: 'query', label: 'Search', value: filters.query, displayValue: filters.query })
  }

  filters.seniorities?.forEach((s) =>
    chips.push({ key: 'seniorities', label: 'Seniority', value: s, displayValue: s })
  )

  filters.departments?.forEach((d) =>
    chips.push({ key: 'departments', label: 'Department', value: d, displayValue: d })
  )

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
