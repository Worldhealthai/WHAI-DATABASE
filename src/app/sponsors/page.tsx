'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, Download, ChevronUp, ChevronDown, ChevronsUpDown,
  Trash2, X, Calendar, Pencil, LayoutGrid, LayoutList, Rows, ArrowRight, CheckCircle2, DollarSign, GripVertical,
} from 'lucide-react'
import { FilterDropdown, ActiveFiltersBar } from '@/components/search/FilterDropdown'
import { Pagination } from '@/components/search/Pagination'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { SponsorFormModal } from '@/components/crm/SponsorFormModal'
import type { Sponsor, SponsorFilters } from '@/types'
import { SPONSOR_STATUS_OPTIONS, SPONSOR_TIER_OPTIONS, COUNTRY_OPTIONS, EVENT_OPTIONS } from '@/types'
import { cn } from '@/lib/utils'

const PARTNER_TIERS = ['Media Partner', 'Association Partner']

async function fetchSponsors(
  filters: SponsorFilters, page: number, pageSize: number, sortBy: string, sortDir: string,
) {
  const params = new URLSearchParams()
  params.set('page', String(page)); params.set('pageSize', String(pageSize))
  params.set('sortBy', sortBy); params.set('sortDir', sortDir)
  if (filters.query) params.set('query', filters.query)
  filters.statuses?.forEach((s) => params.append('statuses', s))
  filters.events?.forEach((e) => params.append('events', e))
  filters.tiers?.forEach((t) => params.append('tiers', t))
  filters.countries?.forEach((c) => params.append('countries', c))
  PARTNER_TIERS.forEach((t) => params.append('excludeTiers', t))
  const res = await fetch(`/api/sponsors?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

// ── Pipeline config ───────────────────────────────────────────────────────────

const BOARD_COLS = [
  { status: 'Not Contacted', hex: '#64748b', label: 'Not Contacted' },
  { status: 'Emailed',       hex: '#3b82f6', label: 'Emailed' },
  { status: 'In Discussion', hex: '#a855f7', label: 'In Discussion' },
  { status: 'Confirmed',     hex: '#10b981', label: 'Confirmed' },
  { status: 'Rejected',      hex: '#ef4444', label: 'Rejected' },
]
const PROGRESSION = ['Not Contacted', 'Emailed', 'In Discussion', 'Confirmed']

function nextStage(current: string): string | null {
  const i = PROGRESSION.indexOf(current)
  return i >= 0 && i < PROGRESSION.length - 1 ? PROGRESSION[i + 1] : null
}

function formatValue(amount: number | null | undefined, currency = 'GBP') {
  if (!amount) return null
  return `${currency} ${Number(amount).toLocaleString()}`
}

// ── Kanban board ──────────────────────────────────────────────────────────────

function SponsorCard({ sponsor, onAdvance, onEdit, advancing, onDragStart, onDragEnd, isDragging }: {
  sponsor: Sponsor
  onAdvance: (id: string, next: string) => void
  onEdit: (s: Sponsor) => void
  advancing: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const next = nextStage(sponsor.status)
  const initials = sponsor.companyName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const value = formatValue(sponsor.valueAmount, sponsor.valueCurrency ?? 'GBP')

  return (
    <Link
      href={`/sponsors/${sponsor.id}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group block rounded-xl border border-[#1a3a5c] bg-[#0d2040] p-3.5 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-900/10 transition-all cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-30 scale-95'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-3 h-3 text-slate-700 group-hover:text-slate-500 transition-colors shrink-0" />
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); onEdit(sponsor) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-amber-500/15 text-slate-600 hover:text-amber-400 shrink-0"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
      <div className="font-semibold text-sm text-white mb-0.5 truncate">{sponsor.companyName}</div>
      {(sponsor.contactFirstName || sponsor.contactLastName) && (
        <div className="text-xs text-slate-500 truncate mb-1">
          {[sponsor.contactFirstName, sponsor.contactLastName].filter(Boolean).join(' ')}
        </div>
      )}
      {value && (
        <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold mb-1.5">
          <DollarSign className="w-3 h-3" /> {value}
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        {sponsor.event && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/20 whitespace-nowrap">
            {sponsor.event}
          </span>
        )}
        {sponsor.tier && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700 whitespace-nowrap">
            {sponsor.tier}
          </span>
        )}
      </div>
      {next && (
        <button
          onClick={(e) => { e.preventDefault(); onAdvance(sponsor.id, next) }}
          disabled={advancing}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 hover:border-amber-500/40 disabled:opacity-50 transition-all"
        >
          {advancing ? '…' : <><ArrowRight className="w-3 h-3" /> Move to {next}</>}
        </button>
      )}
      {!next && sponsor.status === 'Confirmed' && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-green-400 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
        </div>
      )}
    </Link>
  )
}

function KanbanBoard({ sponsors, onAdvance, onEdit, advancingId }: {
  sponsors: Sponsor[]
  onAdvance: (id: string, toStatus: string) => void
  onEdit: (s: Sponsor) => void
  advancingId: string | null
}) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const mousePos = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!draggingId) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return }
    const EDGE = 100, SPEED = 14
    const onMove = (e: DragEvent) => { mousePos.current = { x: e.clientX, y: e.clientY } }
    const tick = () => {
      const { x, y } = mousePos.current
      if (y < EDGE) window.scrollBy(0, -SPEED * ((EDGE - y) / EDGE))
      else if (y > window.innerHeight - EDGE) window.scrollBy(0, SPEED * ((y - (window.innerHeight - EDGE)) / EDGE))
      if (boardRef.current) {
        const r = boardRef.current.getBoundingClientRect()
        if (x < r.left + EDGE) boardRef.current.scrollLeft -= SPEED * ((EDGE - (x - r.left)) / EDGE)
        else if (x > r.right - EDGE) boardRef.current.scrollLeft += SPEED * ((x - (r.right - EDGE)) / EDGE)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    document.addEventListener('dragover', onMove)
    rafRef.current = requestAnimationFrame(tick)
    return () => { document.removeEventListener('dragover', onMove); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draggingId])

  const handleDragStart = (e: React.DragEvent, sponsor: Sponsor) => {
    e.dataTransfer.setData('cardId', sponsor.id)
    e.dataTransfer.setData('fromStatus', sponsor.status)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => setDraggingId(sponsor.id), 0)
  }

  const handleDragEnd = () => { setDraggingId(null); setDragOverCol(null) }

  const handleDrop = (e: React.DragEvent, toStatus: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('cardId')
    const from = e.dataTransfer.getData('fromStatus')
    setDragOverCol(null); setDraggingId(null)
    if (id && from !== toStatus) onAdvance(id, toStatus)
  }

  return (
    <>
    {draggingId && (
      <div className="fixed top-16 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
        <div className="flex gap-2 bg-[#0A1628]/95 backdrop-blur-sm border border-[#1a3a5c] rounded-2xl p-2 shadow-2xl pointer-events-auto">
          <span className="flex items-center px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Drop in</span>
          {BOARD_COLS.map((col) => {
            const isTarget = dragOverCol === col.status
            return (
              <div
                key={col.status}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(col.status) }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
                onDrop={(e) => handleDrop(e, col.status)}
                className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 select-none', isTarget ? 'scale-110' : 'opacity-60')}
                style={{
                  background: isTarget ? `${col.hex}28` : `${col.hex}10`,
                  border: `1px solid ${isTarget ? col.hex : col.hex + '40'}`,
                  color: col.hex,
                  boxShadow: isTarget ? `0 0 16px ${col.hex}50` : undefined,
                }}
              >
                {col.label}
              </div>
            )
          })}
        </div>
      </div>
    )}
    <div ref={boardRef} className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-340px)]">
      {BOARD_COLS.map((col) => {
        const cards = sponsors.filter((s) => s.status === col.status)
        const totalValue = cards.reduce((sum, s) => sum + (Number(s.valueAmount) || 0), 0)
        const isOver = dragOverCol === col.status
        return (
          <div key={col.status} className="flex-none w-64">
            <div className="flex items-center justify-between mb-1 px-0.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col.hex }} />
                <span className="text-xs font-semibold text-slate-300">{col.label}</span>
              </div>
              <span className="text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-[#0d2040] border border-[#1a3a5c] text-slate-500">
                {cards.length}
              </span>
            </div>
            {totalValue > 0 && (
              <div className="flex items-center gap-1 mb-3 px-0.5">
                <DollarSign className="w-3 h-3 text-amber-400/60" />
                <span className="text-[10px] text-amber-400/60 font-semibold">
                  GBP {totalValue.toLocaleString()}
                </span>
              </div>
            )}
            {totalValue === 0 && <div className="mb-3" />}
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(col.status) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
              onDrop={(e) => handleDrop(e, col.status)}
              className={cn(
                'rounded-xl border p-2 space-y-2 min-h-[120px] transition-all duration-150',
                isOver ? 'border-dashed scale-[1.02] shadow-lg' : 'border-[#1a3a5c]/60'
              )}
              style={{
                background: isOver ? `${col.hex}14` : `${col.hex}06`,
                borderColor: isOver ? col.hex : undefined,
                boxShadow: isOver ? `0 0 0 2px ${col.hex}30` : undefined,
              }}
            >
              {cards.map((s) => (
                <SponsorCard
                  key={s.id}
                  sponsor={s}
                  onAdvance={onAdvance}
                  onEdit={onEdit}
                  advancing={advancingId === s.id}
                  onDragStart={(e) => handleDragStart(e, s)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggingId === s.id}
                />
              ))}
              {cards.length === 0 && (
                <div
                  className={cn(
                    'py-6 text-center text-xs border border-dashed rounded-lg transition-colors',
                    isOver ? 'border-current text-slate-400' : 'border-[#1a3a5c]/40 text-slate-700'
                  )}
                  style={isOver ? { borderColor: col.hex, color: col.hex } : {}}
                >
                  {isOver ? 'Drop here' : 'No sponsors'}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
    </>
  )
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: string }) {
  if (sortBy !== col) return <ChevronsUpDown className="w-3 h-3 text-slate-600" />
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-amber-400" /> : <ChevronDown className="w-3 h-3 text-amber-400" />
}

function companyInitials(s: Sponsor) {
  return s.companyName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
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
        checked || indeterminate ? 'bg-amber-500 border-amber-500' : 'border-slate-600 hover:border-slate-400 bg-transparent'
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
  { key: 'status',      label: 'Status' },
  { key: 'tier',        label: 'Tier' },
  { key: 'valueAmount', label: 'Value' },
  { key: 'country',     label: 'Country' },
  { key: 'createdAt',   label: 'Added' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SponsorsPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<SponsorFilters>({})
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showModal, setShowModal] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'board' | 'rows'>('table')
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [sidePanelId, setSidePanelId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Restore list state after back-navigation from a sponsor profile
  useEffect(() => {
    const saved = sessionStorage.getItem('sponsors-list-state')
    if (saved) {
      try {
        const s = JSON.parse(saved)
        if (s.filters) setFilters(s.filters)
        if (s.keyword) setKeyword(s.keyword)
        if (s.page) setPage(s.page)
        if (s.pageSize) setPageSize(s.pageSize)
        if (s.sortBy) setSortBy(s.sortBy)
        if (s.sortDir) setSortDir(s.sortDir)
        if (s.viewMode) setViewMode(s.viewMode)
      } catch {}
      sessionStorage.removeItem('sponsors-list-state')
    }
  }, [])

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['sponsors', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchSponsors(filters, page, pageSize, sortBy, sortDir),
    placeholderData: (prev) => prev,
  })

  const { data: boardData, isLoading: boardLoading } = useQuery({
    queryKey: ['sponsors-board', filters],
    queryFn: () => fetchSponsors(filters, 1, 500, 'companyName', 'asc'),
    enabled: viewMode === 'board',
    placeholderData: (prev) => prev,
  })

  const { data: panelData } = useQuery<Sponsor & { activities: any[] }>({
    queryKey: ['sponsor-detail', sidePanelId],
    queryFn: () => fetch(`/api/sponsors/${sidePanelId}`).then(r => r.json()),
    enabled: !!sidePanelId,
    staleTime: 30_000,
  })

  const updateFilter = (key: keyof SponsorFilters, value: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value.length ? value : undefined }))
    setSelected(new Set()); setPage(1)
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

  const advanceStage = async (id: string, next: string) => {
    setAdvancingId(id)
    try {
      await fetch(`/api/sponsors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      queryClient.invalidateQueries({ queryKey: ['sponsors'] })
      queryClient.invalidateQueries({ queryKey: ['sponsors-board'] })
    } finally {
      setAdvancingId(null)
    }
  }

  const activeEventTab = filters.events?.length === 1 ? filters.events[0] : ''
  const setEventTab = (event: string) => {
    setFilters((prev) => ({ ...prev, events: event ? [event] : undefined }))
    setPage(1); setSelected(new Set())
  }

  const rows: Sponsor[] = data?.data ?? []
  const boardSponsors: Sponsor[] = boardData?.data ?? []
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
    if (!confirm(`Permanently delete ${selected.size} sponsor${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      await Promise.allSettled([...selected].map((id) => fetch(`/api/sponsors/${id}`, { method: 'DELETE' })))
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['sponsors'] })
    } finally {
      setBulkDeleting(false)
    }
  }

  const exportCSV = (ids?: Set<string>) => {
    const PARTNER_TIERS = ['Media Partner', 'Association Partner']
    const params = new URLSearchParams()
    // Exclude partner tiers so only sponsors are exported
    PARTNER_TIERS.forEach((t) => params.append('excludeTiers', t))
    // If specific rows are selected, restrict by ID
    if (ids && ids.size > 0) {
      params.set('ids', [...ids].join(','))
    }
    // Pass current active filters so the export respects them when exporting all
    if (!ids || ids.size === 0) {
      if (filters.query) params.set('query', filters.query)
      filters.events?.forEach((e) => params.append('event', e))
      filters.statuses?.forEach((s) => params.append('status', s))
      filters.tiers?.forEach((t) => params.append('tier', t))
    }
    const a = document.createElement('a')
    a.href = `/api/sponsors/export?${params}`
    a.download = 'sponsors-export.csv'
    a.click()
  }

  const activeFilters: { category: string; key: string; value: string }[] = []
  if (filters.query) activeFilters.push({ category: 'Search', key: 'query', value: filters.query })
  filters.statuses?.forEach((s) => activeFilters.push({ category: 'Status', key: 'statuses', value: s }))
  filters.tiers?.forEach((t) => activeFilters.push({ category: 'Tier', key: 'tiers', value: t }))
  filters.countries?.forEach((c) => activeFilters.push({ category: 'Country', key: 'countries', value: c }))

  const removeChip = (key: string, value: string) => {
    if (key === 'query') { setKeyword(''); setFilters((p) => { const n = { ...p }; delete n.query; return n }); return }
    setFilters((p) => {
      const n = { ...p } as any
      if (Array.isArray(n[key])) { n[key] = n[key].filter((v: string) => v !== value); if (!n[key].length) delete n[key] }
      return n
    })
  }

  // Board value totals
  const confirmedValue = boardSponsors
    .filter((s) => s.status === 'Confirmed')
    .reduce((sum, s) => sum + (Number(s.valueAmount) || 0), 0)
  const pipelineValue = boardSponsors
    .filter((s) => ['Emailed', 'In Discussion'].includes(s.status))
    .reduce((sum, s) => sum + (Number(s.valueAmount) || 0), 0)

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Header ── */}
      <div className="shrink-0 bg-[#0A1628] border-b border-[#1a3a5c] z-30">
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b80 0%, #f59e0b30 50%, transparent 100%)' }} />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between pt-4 pb-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Sponsors</h1>
              {data && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {data.total.toLocaleString()} {data.total === 1 ? 'record' : 'records'}
                  {activeEventTab && <span className="text-amber-400"> · {activeEventTab}</span>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-[#1a3a5c] overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                    viewMode === 'table' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-white'
                  )}
                >
                  <LayoutList className="w-3.5 h-3.5" /> List
                </button>
                <div className="w-px h-5 bg-[#1a3a5c]" />
                <button
                  onClick={() => setViewMode('board')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                    viewMode === 'board' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-white'
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Board
                </button>
                <div className="w-px h-5 bg-[#1a3a5c]" />
                <button
                  onClick={() => setViewMode('rows')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                    viewMode === 'rows' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-white'
                  )}
                >
                  <Rows className="w-3.5 h-3.5" /> Rows
                </button>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-[#0A1628] text-sm font-semibold hover:bg-amber-500/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Sponsor
              </button>
            </div>
          </div>

          {/* Event tabs */}
          <div className="flex items-center gap-1.5 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {['', ...EVENT_OPTIONS].map((ev) => (
              <button
                key={ev || '_all'}
                onClick={() => setEventTab(ev)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 border',
                  activeEventTab === ev
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                    : 'text-slate-400 hover:text-white border-transparent hover:border-[#1a3a5c] hover:bg-[#112850]/50'
                )}
              >
                {ev ? <><Calendar className="w-3.5 h-3.5 shrink-0" />{ev}</> : 'All Events'}
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
                placeholder="Search by company, contact name, email…"
                className="w-full pl-10 pr-10 py-2.5 bg-[#112850] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500/50 transition-colors"
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
            <FilterDropdown label="Status" options={SPONSOR_STATUS_OPTIONS} selected={filters.statuses ?? []} onChange={(v) => updateFilter('statuses', v)} searchable={false} />
            <FilterDropdown label="Tier" options={SPONSOR_TIER_OPTIONS.filter((t) => !PARTNER_TIERS.includes(t))} selected={filters.tiers ?? []} onChange={(v) => updateFilter('tiers', v)} searchable={false} />
            <FilterDropdown label="Country" options={COUNTRY_OPTIONS} selected={filters.countries ?? []} onChange={(v) => updateFilter('countries', v)} />
          </div>

          {activeFilters.length > 0 && <ActiveFiltersBar filters={activeFilters} onRemove={removeChip} onClearAll={clearAll} />}
        </div>
      </div>

      {/* ── Bulk actions bar ── */}
      {selected.size > 0 && viewMode !== 'board' && (
        <div className="shrink-0 bg-[#0d2040] border-b border-amber-500/20 z-20">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-amber-400 shrink-0">{selected.size} selected</span>
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
        <div className={cn('max-w-[1400px] mx-auto px-4 sm:px-6 py-3', viewMode === 'board' ? '' : 'space-y-3')}>

          {/* ── Board view ── */}
          {viewMode === 'board' && (
            <div>
              {/* Revenue summary strip */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {BOARD_COLS.map((col) => {
                  const cards = boardSponsors.filter((s) => s.status === col.status)
                  const colValue = cards.reduce((sum, s) => sum + (Number(s.valueAmount) || 0), 0)
                  return (
                    <div key={col.status} className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-lg bg-[#0d2040] border border-[#1a3a5c]">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.hex }} />
                      <span className="text-xs text-slate-400">{col.label}</span>
                      <span className="text-sm font-bold text-white tabular-nums">{cards.length}</span>
                      {colValue > 0 && (
                        <span className="text-xs text-amber-400/70 font-semibold ml-1">
                          · £{colValue.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )
                })}
                {(confirmedValue > 0 || pipelineValue > 0) && (
                  <div className="ml-auto flex items-center gap-3 shrink-0">
                    {confirmedValue > 0 && (
                      <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Confirmed</div>
                        <div className="text-sm font-bold text-green-400">£{confirmedValue.toLocaleString()}</div>
                      </div>
                    )}
                    {pipelineValue > 0 && (
                      <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Pipeline</div>
                        <div className="text-sm font-bold text-amber-400">£{pipelineValue.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {boardLoading ? (
                <div className="flex gap-3">
                  {BOARD_COLS.map((col) => (
                    <div key={col.status} className="flex-none w-64">
                      <div className="h-5 w-28 bg-slate-700/40 rounded mb-3 animate-pulse" />
                      <div className="space-y-2">
                        {[1,2,3].map((i) => <div key={i} className="h-28 bg-slate-700/20 rounded-xl animate-pulse" />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <KanbanBoard
                  sponsors={boardSponsors}
                  onAdvance={advanceStage}
                  onEdit={setEditingSponsor}
                  advancingId={advancingId}
                />
              )}
            </div>
          )}

          {/* ── Rows view ── */}
          {viewMode === 'rows' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  {isLoading ? 'Loading…' : (<><span className="font-bold text-white">{(data?.total ?? 0).toLocaleString()}</span> results</>)}
                </span>
                <button onClick={() => exportCSV()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#112850] text-slate-300 hover:text-white text-xs font-medium border border-[#1a3a5c] hover:border-slate-500 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export all
                </button>
              </div>
              <div className="whai-card overflow-hidden divide-y divide-[#1a3a5c]/40">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-700/50 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-48 rounded bg-slate-700/50 animate-pulse" />
                        <div className="h-2.5 w-32 rounded bg-slate-700/30 animate-pulse" />
                      </div>
                      <div className="h-5 w-20 rounded-full bg-slate-700/30 animate-pulse" />
                    </div>
                  ))
                ) : !rows.length ? (
                  <div className="py-16 text-center text-slate-500 text-sm">No sponsors found.</div>
                ) : rows.map((s) => {
                  const next = nextStage(s.status)
                  const saveState = () => sessionStorage.setItem('sponsors-list-state', JSON.stringify({ filters, keyword, page, pageSize, sortBy, sortDir, viewMode }))
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSidePanelId(s.id)}
                      className={cn('group/row flex items-center gap-4 px-4 py-3.5 hover:bg-[#112850]/60 transition-colors cursor-pointer', selected.has(s.id) && 'bg-amber-500/5')}
                    >
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                        <Checkbox checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                      </div>
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-bold shrink-0">
                        {companyInitials(s)}
                      </div>
                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span onClick={(e) => e.stopPropagation()}>
                            <Link href={`/sponsors/${s.id}`} onClick={saveState} className="font-semibold text-white hover:text-amber-400 transition-colors text-sm">
                              {s.companyName}
                            </Link>
                          </span>
                          {s.event && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/20">{s.event}</span>}
                          {s.contactCount > 0 && <span className="text-[10px] text-slate-600">{s.contactCount} contact{s.contactCount === 1 ? '' : 's'}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {(s.contactFirstName || s.contactLastName) && (
                            <span className="text-xs text-slate-500">{[s.contactFirstName, s.contactLastName].filter(Boolean).join(' ')}{s.contactJobTitle ? ` · ${s.contactJobTitle}` : ''}</span>
                          )}
                          {s.country && <span className="text-xs text-slate-600">{s.country}</span>}
                          {s.valueAmount && <span className="text-xs text-slate-400 font-medium">{s.valueCurrency ?? 'GBP'} {Number(s.valueAmount).toLocaleString()}</span>}
                        </div>
                      </div>
                      {/* Badges */}
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <StatusBadge value={s.status} variant="sponsor_status" />
                        {s.tier && <StatusBadge value={s.tier} variant="sponsor_tier" />}
                      </div>
                      {/* Date */}
                      <div className="hidden lg:block text-xs text-slate-600 shrink-0 w-24 text-right">
                        {new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        {next && (
                          <button
                            onClick={(e) => { e.stopPropagation(); advanceStage(s.id, next) }}
                            disabled={advancingId === s.id}
                            title={`Move to ${next}`}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium hover:bg-amber-500/20 disabled:opacity-50 transition-all whitespace-nowrap"
                          >
                            {advancingId === s.id ? '…' : <><ArrowRight className="w-3 h-3" />{next}</>}
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditingSponsor(s) }}
                          className="p-1.5 rounded-md hover:bg-amber-500/15 text-slate-500 hover:text-amber-400"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {data && data.total > 0 && (
                <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1) }} />
              )}
            </>
          )}

          {/* ── Table view ── */}
          {viewMode === 'table' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  {isLoading ? 'Loading…' : (<><span className={cn('font-bold text-white', isFetching && 'opacity-50')}>{(data?.total ?? 0).toLocaleString()}</span> results</>)}
                </span>
                <button onClick={() => exportCSV()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#112850] text-slate-300 hover:text-white text-xs font-medium border border-[#1a3a5c] hover:border-slate-500 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export all
                </button>
              </div>

              <div className="whai-card overflow-hidden">
                {isLoading ? (
                  <div>
                    {Array.from({ length: 10 }).map((_, i) => (
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
                  <div className="py-16 text-center text-slate-500 text-sm">
                    {activeEventTab ? `No sponsors for "${activeEventTab}" yet.` : 'No sponsors found. Add your first one.'}
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#1a3a5c] bg-[#0d2040]">
                            <th className="pl-4 pr-2 py-2.5 w-8">
                              <Checkbox checked={allPageSelected} indeterminate={somePageSelected && !allPageSelected} onChange={toggleSelectAll} />
                            </th>
                            {COLS.map((col) => (
                              <th key={col.key} onClick={() => handleSort(col.key)} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap">
                                <div className="flex items-center gap-1">{col.label}<SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} /></div>
                              </th>
                            ))}
                            <th className="w-24" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((s) => {
                            const next = nextStage(s.status)
                            const saveState = () => sessionStorage.setItem('sponsors-list-state', JSON.stringify({ filters, keyword, page, pageSize, sortBy, sortDir, viewMode }))
                            return (
                              <tr
                                key={s.id}
                                onClick={() => setSidePanelId(s.id)}
                                className={cn('group/row border-b border-[#1a3a5c]/40 hover:bg-[#112850]/60 transition-colors cursor-pointer', selected.has(s.id) && 'bg-amber-500/5 border-amber-500/20')}
                              >
                                <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                                </td>
                                <td className="px-4 py-3">
                                  <span onClick={(e) => e.stopPropagation()}>
                                    <Link href={`/sponsors/${s.id}`} onClick={saveState} className="flex items-center gap-3 group">
                                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
                                        {companyInitials(s)}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-medium text-white group-hover:text-amber-400 transition-colors">{s.companyName}</div>
                                        {(s.contactFirstName || s.contactLastName) && (
                                          <div className="text-xs text-slate-500">{[s.contactFirstName, s.contactLastName].filter(Boolean).join(' ')}</div>
                                        )}
                                        {s.event && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/20 whitespace-nowrap mt-0.5 inline-block">
                                            {s.event}
                                          </span>
                                        )}
                                        {s.contactCount > 0 && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700 mt-0.5 inline-block ml-1">
                                            {s.contactCount} contact{s.contactCount === 1 ? '' : 's'}
                                          </span>
                                        )}
                                      </div>
                                    </Link>
                                  </span>
                                </td>
                                <td className="px-4 py-3"><StatusBadge value={s.status} variant="sponsor_status" /></td>
                                <td className="px-4 py-3">
                                  {s.tier ? <StatusBadge value={s.tier} variant="sponsor_tier" /> : <span className="text-slate-600">—</span>}
                                </td>
                                <td className="px-4 py-3 text-slate-300 text-xs font-medium">
                                  {s.valueAmount ? `${s.valueCurrency ?? 'GBP'} ${Number(s.valueAmount).toLocaleString()}` : '—'}
                                </td>
                                <td className="px-4 py-3 text-slate-400 text-xs">{s.country ?? '—'}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">
                                  {new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="pr-3 py-3">
                                  <div className="flex items-center gap-1 justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
                                    {next && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); advanceStage(s.id, next) }}
                                        disabled={advancingId === s.id}
                                        title={`Move to ${next}`}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium hover:bg-amber-500/20 disabled:opacity-50 transition-all whitespace-nowrap"
                                      >
                                        {advancingId === s.id ? '…' : <><ArrowRight className="w-3 h-3" />{next}</>}
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditingSponsor(s) }}
                                      className="p-1.5 rounded-md hover:bg-amber-500/15 text-slate-500 hover:text-amber-400"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden divide-y divide-[#1a3a5c]/40">
                      {rows.map((s) => (
                        <div key={s.id} className={cn('flex items-start gap-3 px-4 py-3 transition-colors', selected.has(s.id) ? 'bg-amber-500/5' : 'hover:bg-[#112850]/60')}>
                          <div className="pt-0.5"><Checkbox checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} /></div>
                          <Link href={`/sponsors/${s.id}`} onClick={() => sessionStorage.setItem('sponsors-list-state', JSON.stringify({ filters, keyword, page, pageSize, sortBy, sortDir, viewMode }))} className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                              {companyInitials(s)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-white">{s.companyName}</div>
                              {(s.contactFirstName || s.contactLastName) && (
                                <div className="text-xs text-slate-400">{[s.contactFirstName, s.contactLastName].filter(Boolean).join(' ')}</div>
                              )}
                              {s.event && <div className="text-[10px] text-amber-400/70 mt-0.5">{s.event}</div>}
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
                <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1) }} />
              )}
            </>
          )}
        </div>
      </div>

      {showModal && (
        <SponsorFormModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); refetch() }} />
      )}
      {editingSponsor && (
        <SponsorFormModal
          sponsor={editingSponsor}
          onClose={() => setEditingSponsor(null)}
          onSaved={() => { setEditingSponsor(null); refetch(); queryClient.invalidateQueries({ queryKey: ['sponsors-board'] }) }}
        />
      )}

      {/* ── Side panel ── */}
      {sidePanelId && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSidePanelId(null)} />
          {/* panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-sm z-50 bg-[#0d2040] border-l border-[#1a3a5c] shadow-2xl flex flex-col overflow-hidden">
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a3a5c] shrink-0">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick View</span>
              <button onClick={() => setSidePanelId(null)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {!panelData ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Company identity */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-bold shrink-0">
                    {panelData.companyName?.split(' ').slice(0,2).map((w:string) => w[0]).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/sponsors/${sidePanelId}`}
                      onClick={() => setSidePanelId(null)}
                      className="font-semibold text-white hover:text-amber-400 transition-colors block truncate"
                    >
                      {panelData.companyName}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <StatusBadge value={panelData.status} variant="sponsor_status" />
                      {panelData.tier && <StatusBadge value={panelData.tier} variant="sponsor_tier" />}
                    </div>
                  </div>
                </div>

                {/* Event */}
                {panelData.event && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Event</p>
                    <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{panelData.event}</span>
                  </div>
                )}

                {/* Primary contact */}
                {(panelData.contactFirstName || panelData.contactLastName || panelData.contactEmail) && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Primary Contact</p>
                    <div className="bg-[#112850] rounded-lg p-3 space-y-1">
                      {(panelData.contactFirstName || panelData.contactLastName) && (
                        <p className="text-sm font-medium text-white">{[panelData.contactFirstName, panelData.contactLastName].filter(Boolean).join(' ')}</p>
                      )}
                      {panelData.contactJobTitle && <p className="text-xs text-slate-400">{panelData.contactJobTitle}</p>}
                      {panelData.contactEmail && <p className="text-xs text-slate-500">{panelData.contactEmail}</p>}
                    </div>
                  </div>
                )}

                {/* Last activity */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Last Activity</p>
                  {panelData.activities && panelData.activities.length > 0 ? (
                    <div className="bg-[#112850] rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700 font-medium">{panelData.activities[0].type}</span>
                        <span className="text-[10px] text-slate-600">{new Date(panelData.activities[0].createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{panelData.activities[0].content}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 italic">No activity logged yet.</p>
                  )}
                </div>

                {/* All activities (up to 5) */}
                {panelData.activities && panelData.activities.length > 1 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Activity</p>
                    <div className="space-y-2">
                      {panelData.activities.slice(1, 5).map((a: any) => (
                        <div key={a.id} className="border-l-2 border-[#1a3a5c] pl-3 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-medium">{a.type}</span>
                            <span className="text-[10px] text-slate-700">{new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{a.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* footer */}
            <div className="shrink-0 px-5 py-4 border-t border-[#1a3a5c]">
              <Link
                href={`/sponsors/${sidePanelId}`}
                onClick={() => setSidePanelId(null)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#0A1628] font-semibold text-sm transition-colors"
              >
                Open Full Profile <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
