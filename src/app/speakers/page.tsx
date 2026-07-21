'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, Download, ChevronUp, ChevronDown, ChevronsUpDown,
  Trash2, X, Calendar, Pencil, LayoutGrid, LayoutList, Grid3X3, ArrowRight, CheckCircle2, GripVertical,
} from 'lucide-react'
import { FilterDropdown, ActiveFiltersBar } from '@/components/search/FilterDropdown'
import { Pagination } from '@/components/search/Pagination'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { SpeakerFormModal } from '@/components/crm/SpeakerFormModal'
import type { Speaker, SpeakerFilters } from '@/types'
import { SPEAKER_STATUS_OPTIONS, COUNTRY_OPTIONS, SUBTYPE_OPTIONS } from '@/types'
import { cn } from '@/lib/utils'
import { useEventCategories, describeEventSelection } from '@/lib/eventCategories'
import { EventCategoryTabs } from '@/components/search/EventCategoryTabs'

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

// ── Pipeline config ───────────────────────────────────────────────────────────

const BOARD_COLS = [
  { status: 'Not Contacted',      hex: '#64748b', label: 'Not Contacted' },
  { status: 'Invited',            hex: '#3b82f6', label: 'Invited' },
  { status: 'Discussing',         hex: '#a855f7', label: 'Discussing' },
  { status: 'Speaking Confirmed', hex: '#10b981', label: 'Confirmed' },
  { status: 'Cancelled',          hex: '#facc15', label: 'Cancelled' },
  { status: 'Rejected',           hex: '#ef4444', label: 'Rejected' },
]
const PROGRESSION = ['Not Contacted', 'Invited', 'Discussing', 'Speaking Confirmed']

function nextStage(current: string): string | null {
  const i = PROGRESSION.indexOf(current)
  return i >= 0 && i < PROGRESSION.length - 1 ? PROGRESSION[i + 1] : null
}

// ── Kanban board ──────────────────────────────────────────────────────────────

function SpeakerCard({ speaker, onAdvance, onEdit, advancing, onDragStart, onDragEnd, isDragging }: {
  speaker: Speaker
  onAdvance: (id: string, next: string) => void
  onEdit: (s: Speaker) => void
  advancing: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const next = nextStage(speaker.status)
  return (
    <Link
      href={`/speakers/${speaker.id}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group block rounded-xl border border-[#1a3a5c] bg-[#0d2040] p-3.5 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-900/10 transition-all cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-30 scale-95'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-3 h-3 text-slate-700 group-hover:text-slate-500 transition-colors shrink-0" />
          <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">
            {speaker.firstName?.[0]}{speaker.lastName?.[0]}
          </div>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); onEdit(speaker) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-purple-500/15 text-slate-600 hover:text-purple-400 shrink-0"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
      <div className="font-semibold text-sm text-white mb-0.5 truncate">{speaker.firstName} {speaker.lastName}</div>
      {speaker.organization && <div className="text-xs text-slate-500 truncate mb-1.5">{speaker.organization}</div>}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        {speaker.event && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400/80 border border-purple-500/20 whitespace-nowrap">
            {speaker.event}
          </span>
        )}
        {speaker.subType && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700 whitespace-nowrap">
            {speaker.subType}
          </span>
        )}
      </div>
      {next && (
        <button
          onClick={(e) => { e.preventDefault(); onAdvance(speaker.id, next) }}
          disabled={advancing}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 hover:border-purple-500/40 disabled:opacity-50 transition-all"
        >
          {advancing ? '…' : <><ArrowRight className="w-3 h-3" /> Move to {next}</>}
        </button>
      )}
      {!next && speaker.status === 'Speaking Confirmed' && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-green-400 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
        </div>
      )}
    </Link>
  )
}

function KanbanBoard({ speakers, onAdvance, onEdit, advancingId }: {
  speakers: Speaker[]
  onAdvance: (id: string, toStatus: string) => void
  onEdit: (s: Speaker) => void
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

  const handleDragStart = (e: React.DragEvent, speaker: Speaker) => {
    e.dataTransfer.setData('cardId', speaker.id)
    e.dataTransfer.setData('fromStatus', speaker.status)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => setDraggingId(speaker.id), 0)
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
        const cards = speakers.filter((s) => s.status === col.status)
        const isOver = dragOverCol === col.status
        return (
          <div key={col.status} className="flex-none w-64">
            <div className="flex items-center justify-between mb-3 px-0.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col.hex }} />
                <span className="text-xs font-semibold text-slate-300">{col.label}</span>
              </div>
              <span className="text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-[#0d2040] border border-[#1a3a5c] text-slate-500">
                {cards.length}
              </span>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(col.status) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
              onDrop={(e) => handleDrop(e, col.status)}
              className={cn(
                'rounded-xl border p-2 space-y-2 min-h-[120px] transition-all duration-150',
                isOver
                  ? 'border-dashed scale-[1.02] shadow-lg'
                  : 'border-[#1a3a5c]/60'
              )}
              style={{
                background: isOver ? `${col.hex}14` : `${col.hex}06`,
                borderColor: isOver ? col.hex : undefined,
                boxShadow: isOver ? `0 0 0 2px ${col.hex}30` : undefined,
              }}
            >
              {cards.map((s) => (
                <SpeakerCard
                  key={s.id}
                  speaker={s}
                  onAdvance={onAdvance}
                  onEdit={onEdit}
                  advancing={advancingId === s.id}
                  onDragStart={(e) => handleDragStart(e, s)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggingId === s.id}
                />
              ))}
              {cards.length === 0 && (
                <div className={cn(
                  'py-6 text-center text-xs border border-dashed rounded-lg transition-colors',
                  isOver ? 'border-current text-slate-400' : 'border-[#1a3a5c]/40 text-slate-700'
                )}
                  style={isOver ? { borderColor: col.hex, color: col.hex } : {}}
                >
                  {isOver ? 'Drop here' : 'No speakers'}
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
        checked || indeterminate ? 'bg-purple-500 border-purple-500' : 'border-slate-600 hover:border-slate-400 bg-transparent'
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
  { key: 'firstName',    label: 'Name' },
  { key: 'organization', label: 'Organisation' },
  { key: 'jobTitle',     label: 'Job Title' },
  { key: 'country',      label: 'Country' },
  { key: 'status',       label: 'Status' },
  { key: 'year',         label: 'Year' },
  { key: 'createdAt',    label: 'Added' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpeakersPage() {
  const queryClient = useQueryClient()
  const eventCategories = useEventCategories()
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
  const [viewMode, setViewMode] = useState<'table' | 'board' | 'grid'>('table')
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['speakers', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchSpeakers(filters, page, pageSize, sortBy, sortDir),
    placeholderData: (prev) => prev,
  })

  const { data: boardData, isLoading: boardLoading } = useQuery({
    queryKey: ['speakers-board', filters],
    queryFn: () => fetchSpeakers(filters, 1, 500, 'firstName', 'asc'),
    enabled: viewMode === 'board',
    placeholderData: (prev) => prev,
  })

  // Restore list state after back-navigation from a speaker profile
  useEffect(() => {
    const saved = sessionStorage.getItem('speakers-list-state')
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
      sessionStorage.removeItem('speakers-list-state')
    }
  }, [])

  const saveListState = () => sessionStorage.setItem(
    'speakers-list-state',
    JSON.stringify({ filters, keyword, page, pageSize, sortBy, sortDir, viewMode }),
  )

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

  const clearAll = () => {
    setFilters({}); setKeyword(''); setPage(1); setSelected(new Set())
    clearTimeout(debounceRef.current)
  }

  const advanceStage = async (id: string, next: string) => {
    setAdvancingId(id)
    try {
      await fetch(`/api/speakers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      queryClient.invalidateQueries({ queryKey: ['speakers'] })
      queryClient.invalidateQueries({ queryKey: ['speakers-board'] })
    } finally {
      setAdvancingId(null)
    }
  }

  const activeEventTab = describeEventSelection(filters.events ?? [], eventCategories)
  const setEventLabels = (labels: string[] | undefined) => {
    setFilters((prev) => ({ ...prev, events: labels && labels.length ? labels : undefined }))
    setPage(1); setSelected(new Set())
  }

  const activeYearTab = filters.years?.length === 1 ? filters.years[0] : 0
  const setYearTab = (year: number) => {
    setFilters((prev) => ({ ...prev, years: year ? [year] : undefined }))
    setPage(1); setSelected(new Set())
  }

  const rows: Speaker[] = data?.data ?? []
  const boardSpeakers: Speaker[] = boardData?.data ?? []
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
      await Promise.allSettled([...selected].map((id) => fetch(`/api/speakers/${id}`, { method: 'DELETE' })))
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['speakers'] })
    } finally {
      setBulkDeleting(false)
    }
  }

  const exportCSV = (ids?: Set<string>) => {
    const params = new URLSearchParams()
    if (ids && ids.size > 0) {
      params.set('ids', [...ids].join(','))
    } else {
      filters.statuses?.forEach((s) => params.append('statuses', s))
      filters.events?.forEach((e) => params.append('events', e))
      filters.subTypes?.forEach((t) => params.append('subTypes', t))
      filters.countries?.forEach((c) => params.append('countries', c))
      filters.years?.forEach((y) => params.append('years', String(y)))
    }
    const a = document.createElement('a')
    a.href = `/api/speakers/export?${params}`
    a.download = 'speakers-export.csv'
    a.click()
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
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-[#1a3a5c] overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                    viewMode === 'table' ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-white'
                  )}
                >
                  <LayoutList className="w-3.5 h-3.5" /> List
                </button>
                <div className="w-px h-5 bg-[#1a3a5c]" />
                <button
                  onClick={() => setViewMode('board')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                    viewMode === 'board' ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-white'
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Board
                </button>
                <div className="w-px h-5 bg-[#1a3a5c]" />
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                    viewMode === 'grid' ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-white'
                  )}
                >
                  <Grid3X3 className="w-3.5 h-3.5" /> Grid
                </button>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-500/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Speaker
              </button>
            </div>
          </div>

          {/* Event categories (series + city). The year row below narrows the
              edition, so the category tabs skip their own year chips. */}
          <EventCategoryTabs
            selected={filters.events ?? []}
            onChange={setEventLabels}
            accent="purple"
            showYears={false}
          />

          {/* Year tabs */}
          <div className="flex items-center gap-1.5 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {[0, ...YEAR_TABS].map((year) => (
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
                {year === 0 ? 'All Years' : year}
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
            <ActiveFiltersBar filters={activeFilters.filter((f) => f.key !== 'events')} onRemove={removeChip} onClearAll={clearAll} />
          )}
        </div>
      </div>

      {/* ── Bulk actions bar ── */}
      {selected.size > 0 && viewMode !== 'board' && (
        <div className="shrink-0 bg-[#0d2040] border-b border-purple-500/20 z-20">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-purple-400 shrink-0">{selected.size} selected</span>
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
              {/* Pipeline summary strip */}
              <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-1">
                {BOARD_COLS.map((col) => {
                  const count = boardSpeakers.filter((s) => s.status === col.status).length
                  return (
                    <div key={col.status} className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-lg bg-[#0d2040] border border-[#1a3a5c]">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.hex }} />
                      <span className="text-xs text-slate-400">{col.label}</span>
                      <span className="text-sm font-bold text-white tabular-nums">{count}</span>
                    </div>
                  )
                })}
              </div>

              {boardLoading ? (
                <div className="flex gap-3">
                  {BOARD_COLS.map((col) => (
                    <div key={col.status} className="flex-none w-64">
                      <div className="h-5 w-28 bg-slate-700/40 rounded mb-3 animate-pulse" />
                      <div className="space-y-2">
                        {[1,2,3].map((i) => <div key={i} className="h-24 bg-slate-700/20 rounded-xl animate-pulse" />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <KanbanBoard
                  speakers={boardSpeakers}
                  onAdvance={advanceStage}
                  onEdit={setEditingSpeaker}
                  advancingId={advancingId}
                />
              )}
            </div>
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
                              <Checkbox checked={allPageSelected} indeterminate={somePageSelected && !allPageSelected} onChange={toggleSelectAll} />
                            </th>
                            {COLS.map((col) => (
                              <th key={col.key} onClick={() => handleSort(col.key)} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap">
                                <div className="flex items-center gap-1">{col.label}<SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} /></div>
                              </th>
                            ))}
                            <th className="w-20" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((s) => {
                            const next = nextStage(s.status)
                            return (
                              <tr key={s.id} className={cn('group/row border-b border-[#1a3a5c]/40 hover:bg-[#112850]/60 transition-colors', selected.has(s.id) && 'bg-purple-500/5 border-purple-500/20')}>
                                <td className="pl-4 pr-2 py-3">
                                  <Checkbox checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                                </td>
                                <td className="px-4 py-3">
                                  <Link href={`/speakers/${s.id}`} onClick={saveListState} className="flex items-center gap-3 group">
                                    <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">
                                      {initials(s)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-medium text-white group-hover:text-purple-400 transition-colors">{s.firstName} {s.lastName}</div>
                                      {s.email && <div className="text-xs text-slate-500 truncate">{s.email}</div>}
                                      {s.event && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400/80 border border-purple-500/20 whitespace-nowrap mt-0.5 inline-block">
                                          {s.event}
                                        </span>
                                      )}
                                    </div>
                                  </Link>
                                </td>
                                <td className="px-4 py-3 text-slate-300">{s.organization ?? '—'}</td>
                                <td className="px-4 py-3 text-slate-400 text-xs">{s.jobTitle ?? '—'}</td>
                                <td className="px-4 py-3 text-slate-400 text-xs">{s.country ?? '—'}</td>
                                <td className="px-4 py-3"><StatusBadge value={s.status} variant="speaker_status" /></td>
                                <td className="px-4 py-3 text-slate-400 text-xs">{s.year ?? <span className="text-slate-600">—</span>}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">
                                  {new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="pr-3 py-3">
                                  <div className="flex items-center gap-1 justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
                                    {next && (
                                      <button
                                        onClick={() => advanceStage(s.id, next)}
                                        disabled={advancingId === s.id}
                                        title={`Move to ${next}`}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-medium hover:bg-purple-500/20 disabled:opacity-50 transition-all whitespace-nowrap"
                                      >
                                        {advancingId === s.id ? '…' : <><ArrowRight className="w-3 h-3" />{next}</>}
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.preventDefault(); setEditingSpeaker(s) }}
                                      className="p-1.5 rounded-md hover:bg-purple-500/15 text-slate-500 hover:text-purple-400"
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
                        <div key={s.id} className={cn('flex items-start gap-3 px-4 py-3 transition-colors', selected.has(s.id) ? 'bg-purple-500/5' : 'hover:bg-[#112850]/60')}>
                          <div className="pt-0.5"><Checkbox checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} /></div>
                          <Link href={`/speakers/${s.id}`} onClick={saveListState} className="flex items-start gap-3 flex-1 min-w-0">
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
            </>
          )}

          {/* ── Grid view ── */}
          {viewMode === 'grid' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  {isLoading ? 'Loading…' : (<><span className="font-bold text-white">{(data?.total ?? 0).toLocaleString()}</span> results</>)}
                </span>
                <button onClick={() => exportCSV()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#112850] text-slate-300 hover:text-white text-xs font-medium border border-[#1a3a5c] hover:border-slate-500 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export all
                </button>
              </div>
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-[#1a3a5c] bg-[#0d2040] p-4 space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-700/50 animate-pulse mx-auto" />
                      <div className="h-3.5 w-32 rounded bg-slate-700/50 animate-pulse mx-auto" />
                      <div className="h-2.5 w-24 rounded bg-slate-700/30 animate-pulse mx-auto" />
                      <div className="h-5 w-20 rounded-full bg-slate-700/30 animate-pulse mx-auto" />
                    </div>
                  ))}
                </div>
              ) : !rows.length ? (
                <div className="py-16 text-center text-slate-500 text-sm">No speakers found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {rows.map((s) => {
                    const next = nextStage(s.status)
                    return (
                      <div
                        key={s.id}
                        onClick={() => { saveListState(); window.location.href = `/speakers/${s.id}` }}
                        className={cn(
                          'group/card relative rounded-xl border bg-[#0d2040] hover:bg-[#112850] transition-all cursor-pointer p-4 flex flex-col gap-3',
                          selected.has(s.id) ? 'border-purple-500/40 bg-purple-500/5' : 'border-[#1a3a5c] hover:border-purple-500/30',
                        )}
                      >
                        {/* Top row: checkbox + actions */}
                        <div className="flex items-center justify-between">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                            {next && (
                              <button
                                onClick={(e) => { e.stopPropagation(); advanceStage(s.id, next) }}
                                disabled={advancingId === s.id}
                                title={`Move to ${next}`}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-medium hover:bg-purple-500/20 disabled:opacity-50 transition-all whitespace-nowrap"
                              >
                                {advancingId === s.id ? '…' : <><ArrowRight className="w-3 h-3" />{next}</>}
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditingSpeaker(s) }}
                              className="p-1.5 rounded-md hover:bg-purple-500/15 text-slate-500 hover:text-purple-400"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {/* Avatar + name */}
                        <div className="flex flex-col items-center text-center gap-2">
                          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-xl font-bold shrink-0">
                            {initials(s)}
                          </div>
                          <div>
                            <span onClick={(e) => e.stopPropagation()}>
                              <Link href={`/speakers/${s.id}`} onClick={saveListState} className="font-semibold text-white hover:text-purple-400 transition-colors text-sm leading-snug">
                                {[s.firstName, s.lastName].filter(Boolean).join(' ') || '—'}
                              </Link>
                            </span>
                            {(s.organization || s.jobTitle) && (
                              <div className="text-xs text-slate-500 mt-0.5">
                                {s.organization}{s.jobTitle && <span className="text-slate-600"> · {s.jobTitle}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Badges */}
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <StatusBadge value={s.status} variant="speaker_status" />
                          {s.subType && <StatusBadge value={s.subType} variant="delegate_type" />}
                        </div>
                        {/* Meta */}
                        <div className="flex items-center justify-center gap-2 flex-wrap mt-auto">
                          {s.event && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400/70 border border-purple-500/15">{s.event}</span>}
                          {s.country && <span className="text-[10px] text-slate-600">{s.country}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {data && data.total > 0 && (
                <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1) }} />
              )}
            </>
          )}
        </div>
      </div>

      {showModal && <SpeakerFormModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); refetch() }} />}
      {editingSpeaker && <SpeakerFormModal speaker={editingSpeaker} onClose={() => setEditingSpeaker(null)} onSaved={() => { setEditingSpeaker(null); refetch(); queryClient.invalidateQueries({ queryKey: ['speakers-board'] }) }} />}
    </div>
  )
}
