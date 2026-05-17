'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, Download, ChevronUp, ChevronDown, ChevronsUpDown,
  Trash2, X, Pencil, Network,
} from 'lucide-react'
import { Pagination } from '@/components/search/Pagination'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { SponsorFormModal } from '@/components/crm/SponsorFormModal'
import type { Sponsor, SponsorFilters } from '@/types'
import { EVENT_OPTIONS } from '@/types'
import { cn } from '@/lib/utils'

const PARTNER_TIERS = ['Media Partner', 'Association Partner']

async function fetchPartners(
  query: string, page: number, pageSize: number, sortBy: string, sortDir: string,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  params.set('sortBy', sortBy)
  params.set('sortDir', sortDir)
  PARTNER_TIERS.forEach((t) => params.append('tiers', t))
  if (query) params.set('query', query)
  const res = await fetch(`/api/sponsors?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: string }) {
  if (sortBy !== col) return <ChevronsUpDown className="w-3 h-3 text-slate-600" />
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />
}

function companyInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
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
        checked || indeterminate ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-slate-400 bg-transparent'
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

const COLS = [
  { key: 'companyName', label: 'Company' },
  { key: 'tier',        label: 'Type' },
  { key: 'country',     label: 'Location' },
  { key: 'event',       label: 'Event' },
  { key: 'status',      label: 'Status' },
  { key: 'createdAt',   label: 'Added' },
]

export default function PartnersPage() {
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showModal, setShowModal] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Sponsor | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['partners', keyword, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchPartners(keyword, page, pageSize, sortBy, sortDir),
    placeholderData: (prev) => prev,
  })

  const handleKeywordChange = (val: string) => {
    setKeyword(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1) }, 350)
  }

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const rows: Sponsor[] = data?.data ?? []
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
    if (!confirm(`Permanently delete ${selected.size} partner${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      await Promise.allSettled([...selected].map((id) => fetch(`/api/sponsors/${id}`, { method: 'DELETE' })))
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['partners'] })
    } finally {
      setBulkDeleting(false)
    }
  }

  const exportCSV = (ids?: Set<string>) => {
    const source = (data?.data as Sponsor[]) ?? []
    const list = ids ? source.filter((s) => ids.has(s.id)) : source
    if (!list.length) return
    const out = list.map((s) => [
      s.companyName, s.website ?? '', s.contactFirstName ?? '', s.contactLastName ?? '',
      s.contactEmail ?? '', s.contactPhone ?? '', s.contactJobTitle ?? '',
      s.country ?? '', s.city ?? '', s.event ?? '', s.tier ?? '', s.status,
    ])
    const header = ['Company', 'Website', 'First Name', 'Last Name', 'Email', 'Phone', 'Job Title', 'Country', 'City', 'Event', 'Type', 'Status']
    const csv = [header, ...out].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'partners.csv'; a.click()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Header ── */}
      <div className="shrink-0 bg-[#0A1628] border-b border-[#1a3a5c] z-30">
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #10b98180 0%, #10b98130 50%, transparent 100%)' }} />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between pt-4 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-emerald-400" />
                <h1 className="text-lg sm:text-xl font-bold text-white">Partners & Media</h1>
              </div>
              {data && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {data.total.toLocaleString()} {data.total === 1 ? 'record' : 'records'}
                  <span className="text-slate-600"> · Media Partners & Association Partners</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-[#0A1628] text-sm font-semibold hover:bg-emerald-500/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Partner
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                value={keyword}
                onChange={(e) => handleKeywordChange(e.target.value)}
                placeholder="Search by company name, contact, email…"
                className="w-full pl-10 pr-10 py-2.5 bg-[#112850] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 transition-colors"
              />
              {keyword && (
                <button onClick={() => handleKeywordChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bulk actions bar ── */}
      {selected.size > 0 && (
        <div className="shrink-0 bg-[#0d2040] border-b border-emerald-500/20 z-20">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-emerald-400 shrink-0">{selected.size} selected</span>
            <button onClick={() => exportCSV(selected)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 transition-all">
              <Download className="w-3.5 h-3.5" /> Export selected
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-50', bulkDeleting && 'animate-pulse')}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkDeleting ? 'Deleting…' : 'Delete selected'}
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors">
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
            <button onClick={() => exportCSV()} disabled={!data?.data?.length} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#112850] text-slate-300 hover:text-white text-xs font-medium border border-[#1a3a5c] hover:border-slate-500 disabled:opacity-40 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          <div className="whai-card overflow-hidden">
            {isLoading ? (
              <div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#1a3a5c]/50">
                    <div className="w-4 h-4 rounded bg-slate-700/50 animate-pulse shrink-0" />
                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-40 rounded bg-slate-700/50 animate-pulse" />
                      <div className="h-2.5 w-24 rounded bg-slate-700/30 animate-pulse" />
                    </div>
                    <div className="h-5 w-20 rounded-full bg-slate-700/30 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="py-16 text-center text-red-400 text-sm">Failed to load. Please refresh.</div>
            ) : !rows.length ? (
              <div className="py-16 text-center">
                <Network className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">
                  {keyword ? `No partners match "${keyword}".` : 'No partners yet. Add your first one.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a3a5c] bg-[#0d2040]">
                        <th className="pl-4 pr-2 py-2.5 w-8">
                          <Checkbox checked={allPageSelected} indeterminate={somePageSelected && !allPageSelected} onChange={toggleSelectAll} />
                        </th>
                        {COLS.map((col) => (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap"
                          >
                            <div className="flex items-center gap-1">{col.label}<SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} /></div>
                          </th>
                        ))}
                        <th className="w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr
                          key={s.id}
                          className={cn('group/row border-b border-[#1a3a5c]/40 hover:bg-[#112850]/60 transition-colors', selected.has(s.id) && 'bg-emerald-500/5 border-emerald-500/20')}
                        >
                          <td className="pl-4 pr-2 py-3">
                            <Checkbox checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/partners/${s.id}`} className="flex items-center gap-3 group">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                                {companyInitials(s.companyName)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-white group-hover:text-emerald-400 transition-colors">{s.companyName}</div>
                                {(s.contactFirstName || s.contactLastName) && (
                                  <div className="text-xs text-slate-500">{[s.contactFirstName, s.contactLastName].filter(Boolean).join(' ')}</div>
                                )}
                                {s.contactCount > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700 mt-0.5 inline-block">
                                    {s.contactCount} contact{s.contactCount === 1 ? '' : 's'}
                                  </span>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {s.tier ? <StatusBadge value={s.tier} variant="sponsor_tier" /> : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {[s.city, s.country].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {s.event ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20 text-[10px] whitespace-nowrap">
                                {s.event}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3"><StatusBadge value={s.status} variant="sponsor_status" /></td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="pr-3 py-3">
                            <div className="flex items-center gap-1 justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.preventDefault(); setEditingPartner(s) }}
                                className="p-1.5 rounded-md hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-400"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-[#1a3a5c]/40">
                  {rows.map((s) => (
                    <div key={s.id} className={cn('flex items-start gap-3 px-4 py-3 transition-colors', selected.has(s.id) ? 'bg-emerald-500/5' : 'hover:bg-[#112850]/60')}>
                      <div className="pt-0.5"><Checkbox checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} /></div>
                      <Link href={`/partners/${s.id}`} className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {companyInitials(s.companyName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white">{s.companyName}</div>
                          {(s.contactFirstName || s.contactLastName) && (
                            <div className="text-xs text-slate-400">{[s.contactFirstName, s.contactLastName].filter(Boolean).join(' ')}</div>
                          )}
                          {(s.city || s.country) && (
                            <div className="text-xs text-slate-500 mt-0.5">{[s.city, s.country].filter(Boolean).join(', ')}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {s.tier && <StatusBadge value={s.tier} variant="sponsor_tier" />}
                            <StatusBadge value={s.status} variant="sponsor_status" />
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
        <SponsorFormModal
          defaultTier="Media Partner"
          entityLabel="Partner"
          keepTier
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); refetch() }}
        />
      )}
      {editingPartner && (
        <SponsorFormModal
          sponsor={editingPartner}
          entityLabel="Partner"
          keepTier
          onClose={() => setEditingPartner(null)}
          onSaved={() => { setEditingPartner(null); refetch() }}
        />
      )}
    </div>
  )
}
