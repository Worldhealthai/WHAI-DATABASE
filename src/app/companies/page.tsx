'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, Download, SlidersHorizontal, Building2, Users, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { Pagination } from '@/components/search/Pagination'
import { FilterChips } from '@/components/search/FilterChips'
import type { CompanyFilters, CompanyType, OwnershipStatus } from '@/types'
import {
  COMPANY_TYPE_LABELS, OWNERSHIP_LABELS, EMPLOYEE_RANGE_LABELS, REVENUE_RANGE_LABELS,
} from '@/types'
import { cn } from '@/lib/utils'

async function fetchCompanies(filters: CompanyFilters, page: number, pageSize: number, sortBy: string, sortDir: string) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  params.set('sortBy', sortBy)
  params.set('sortDir', sortDir)

  if (filters.query) params.set('query', filters.query)
  filters.companyTypes?.forEach((ct) => params.append('companyTypes', ct))
  filters.ownershipStatus?.forEach((os) => params.append('ownershipStatus', os))
  filters.verticalIds?.forEach((id) => params.append('verticalIds', id))
  filters.therapeuticAreaIds?.forEach((id) => params.append('therapeuticAreaIds', id))
  filters.countries?.forEach((c) => params.append('countries', c))
  filters.employeeRanges?.forEach((r) => params.append('employeeRanges', r))
  filters.revenueRanges?.forEach((r) => params.append('revenueRanges', r))
  if (filters.foundedYearMin !== undefined) params.set('foundedYearMin', String(filters.foundedYearMin))
  if (filters.foundedYearMax !== undefined) params.set('foundedYearMax', String(filters.foundedYearMax))
  if (filters.hasContacts) params.set('hasContacts', 'true')

  const res = await fetch(`/api/companies?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

async function fetchTaxonomy() {
  const res = await fetch('/api/taxonomy')
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

function FilterSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="filter-section">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors mb-2">
        {title}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  )
}

function MultiCheck<T extends string>({ options, selected, onChange }: { options: { value: T; label: string }[]; selected: T[]; onChange: (v: T[]) => void }) {
  return (
    <>
      {options.map(({ value, label }) => (
        <label key={value} className="flex items-center gap-2 cursor-pointer py-0.5 group">
          <input
            type="checkbox"
            checked={selected.includes(value)}
            onChange={() => onChange(selected.includes(value) ? selected.filter((s) => s !== value) : [...selected, value])}
            className="w-3.5 h-3.5 rounded border-slate-600 accent-[#00B4D8] cursor-pointer"
          />
          <span className={cn('text-sm transition-colors', selected.includes(value) ? 'text-[#00B4D8]' : 'text-slate-300 group-hover:text-white')}>
            {label}
          </span>
        </label>
      ))}
    </>
  )
}

export default function CompaniesPage() {
  const [filters, setFilters] = useState<CompanyFilters>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const { data: taxonomy } = useQuery({ queryKey: ['taxonomy'], queryFn: fetchTaxonomy })
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['companies', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchCompanies(filters, page, pageSize, sortBy, sortDir),
    placeholderData: (prev) => prev,
  })

  useEffect(() => { setPage(1) }, [filters])

  const update = (partial: Partial<CompanyFilters>) => setFilters((prev) => ({ ...prev, ...partial }))

  const TYPE_COLOR: Record<string, string> = {
    PHARMA: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    BIOTECH: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    MEDTECH: 'text-green-400 bg-green-400/10 border-green-400/20',
    HEALTH_IT: 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
    INVESTOR: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    PROVIDER: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    CONSULTING: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    CRO: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
    default: 'text-slate-300 bg-slate-700/50 border-slate-600',
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#0A1628] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors',
              sidebarOpen ? 'bg-[#00B4D8]/15 text-[#00B4D8]' : 'bg-[#112850] text-slate-300 hover:text-white')}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
          </button>
          {data && (
            <span className="text-sm text-slate-400">
              <span className={cn('font-semibold text-white', isFetching && 'opacity-50')}>
                {data.total.toLocaleString()}
              </span>{' '}companies
            </span>
          )}
        </div>
        <button
          onClick={() => {
            if (!data?.data) return
            const rows = data.data.map((c: any) => [c.name, c.company_type, c.headquarters_country, c.headquarters_city, c.ownership_status ?? '', c.employee_count_range ?? '', c._count?.contacts ?? 0])
            const csv = [['Name', 'Type', 'Country', 'City', 'Ownership', 'Employees', 'Contacts'], ...rows].map((r: any[]) => r.map((v) => `"${v}"`).join(',')).join('\n')
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'whai-companies.csv'; a.click()
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#112850] text-slate-300 hover:text-white text-sm transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4 bg-[#0A1628]">
            {/* Search */}
            <div className="filter-section">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={filters.query ?? ''}
                  onChange={(e) => update({ query: e.target.value || undefined })}
                  placeholder="Search companies..."
                  className="w-full pl-8 pr-3 py-2 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]"
                />
              </div>
            </div>

            <FilterSection title="Company Type">
              <MultiCheck
                options={(Object.keys(COMPANY_TYPE_LABELS) as CompanyType[]).map((k) => ({ value: k, label: COMPANY_TYPE_LABELS[k] }))}
                selected={filters.companyTypes ?? []}
                onChange={(v) => update({ companyTypes: v.length ? v : undefined })}
              />
            </FilterSection>

            <FilterSection title="Ownership" defaultOpen={false}>
              <MultiCheck
                options={(Object.keys(OWNERSHIP_LABELS) as OwnershipStatus[]).map((k) => ({ value: k, label: OWNERSHIP_LABELS[k] }))}
                selected={filters.ownershipStatus ?? []}
                onChange={(v) => update({ ownershipStatus: v.length ? v : undefined })}
              />
            </FilterSection>

            <FilterSection title="Employee Size" defaultOpen={false}>
              <MultiCheck
                options={Object.entries(EMPLOYEE_RANGE_LABELS).map(([k, v]) => ({ value: k as any, label: v }))}
                selected={filters.employeeRanges ?? []}
                onChange={(v) => update({ employeeRanges: v.length ? v : undefined })}
              />
            </FilterSection>

            <FilterSection title="Revenue Range" defaultOpen={false}>
              <MultiCheck
                options={Object.entries(REVENUE_RANGE_LABELS).map(([k, v]) => ({ value: k as any, label: v }))}
                selected={filters.revenueRanges ?? []}
                onChange={(v) => update({ revenueRanges: v.length ? v : undefined })}
              />
            </FilterSection>

            {taxonomy?.verticals && (
              <FilterSection title="Healthcare Vertical" defaultOpen={false}>
                {taxonomy.verticals.map((parent: any) => (
                  <div key={parent.id}>
                    <div className="text-xs font-medium text-slate-500 mt-2 mb-1 uppercase tracking-wide">{parent.name}</div>
                    {parent.children?.map((child: any) => (
                      <label key={child.id} className="flex items-center gap-2 cursor-pointer py-0.5 pl-2 group">
                        <input
                          type="checkbox"
                          checked={(filters.verticalIds ?? []).includes(child.id)}
                          onChange={() => {
                            const current = filters.verticalIds ?? []
                            update({ verticalIds: current.includes(child.id) ? current.filter((id) => id !== child.id) : [...current, child.id] })
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-600 accent-[#00B4D8]"
                        />
                        <span className={cn('text-sm', (filters.verticalIds ?? []).includes(child.id) ? 'text-[#00B4D8]' : 'text-slate-300 group-hover:text-white')}>
                          {child.name}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </FilterSection>
            )}

            <div className="filter-section">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => update({ hasContacts: filters.hasContacts ? undefined : true })}
                  className={cn('w-9 h-5 rounded-full relative transition-colors cursor-pointer', filters.hasContacts ? 'bg-[#00B4D8]' : 'bg-[#1a3a5c]')}
                >
                  <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', filters.hasContacts ? 'translate-x-4' : 'translate-x-0.5')} />
                </div>
                <span className="text-sm text-slate-300">Has Contacts in DB</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="whai-card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Loading…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Company', 'Type', 'Verticals', 'HQ', 'Employees', 'Revenue', 'Ownership', 'Contacts', 'Deals'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data?.data ?? []).map((company: any) => (
                      <tr key={company.id} className="hover:bg-[#112850]/50 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Link href={`/companies/${company.id}`} className="font-medium text-white hover:text-[#00B4D8] transition-colors">
                            {company.name}
                          </Link>
                          {company.headquarters_city && <div className="text-xs text-slate-500">{company.website}</div>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('whai-badge border text-xs', TYPE_COLOR[company.company_type] ?? TYPE_COLOR.default)}>
                            {COMPANY_TYPE_LABELS[company.company_type as CompanyType] ?? company.company_type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            {company.verticals?.slice(0, 2).map((cv: any) => (
                              <span key={cv.vertical.id} className="text-xs px-1.5 py-0.5 rounded bg-[#112850] text-slate-300 border border-[#1a3a5c] truncate max-w-[100px]">
                                {cv.vertical.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-400">
                          {[company.headquarters_city, company.headquarters_country].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-400">
                          {company.employee_count_range ? EMPLOYEE_RANGE_LABELS[company.employee_count_range as any] : '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-400">
                          {company.annual_revenue_range ? REVENUE_RANGE_LABELS[company.annual_revenue_range as any] : '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-400">
                          {company.ownership_status ? OWNERSHIP_LABELS[company.ownership_status as OwnershipStatus] : '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="flex items-center gap-1 text-xs text-slate-300">
                            <Users className="w-3 h-3 text-slate-500" /> {company._count?.contacts ?? 0}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="flex items-center gap-1 text-xs text-slate-300">
                            <TrendingUp className="w-3 h-3 text-slate-500" />
                            {(company._count?.deals_as_acquirer ?? 0) + (company._count?.deals_as_target ?? 0)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data?.data ?? []).length === 0 && (
                  <div className="text-center py-16 text-slate-500 text-sm">No companies match your filters.</div>
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
