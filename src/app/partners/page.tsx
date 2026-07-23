'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, Download, ChevronUp, ChevronDown, ChevronsUpDown,
  Trash2, X, Pencil, Network, LayoutGrid, LayoutList, ArrowRight, CheckCircle2, GripVertical,
} from 'lucide-react'
import { Pagination } from '@/components/search/Pagination'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { SponsorFormModal } from '@/components/crm/SponsorFormModal'
import type { Sponsor, SponsorFilters } from '@/types'
import { EVENT_OPTIONS } from '@/types'
import { cn } from '@/lib/utils'

async function fetchPartners(
  query: string, page: number, pageSize: number, sortBy: string, sortDir: string,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  params.set('sortBy', sortBy)
  params.set('sortDir', sortDir)
  if (query) params.set('query', query)
  const res = await fetch(`/api/partners?${params}`)
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

// ── Kanban card ───────────────────────────────────────────────────────────────

function PartnerCard({ partner, onAdvance, onEdit, advancing, onDragStart, onDragEnd, isDragging }: {
  partner: Sponsor
  onAdvance: (id: string, next: string) => void
  onEdit: (s: Sponsor) => void
  advancing: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const next = nextStage(partner.status)
  const initials = partner.companyName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <Link
      href={`/partners/${partner.id}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group block rounded-xl border border-[#1a3a5c] bg-[#0d2040] p-3.5 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-900/10 transition-all cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-30 scale-95'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-3 h-3 text-slate-700 group-hover:text-slate-500 transition-colors shrink-0" />
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); onEdit(partner) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-emerald-500/15 text-slate-600 hover:text-emerald-400 shrink-0"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
      <div className="font-semibold text-sm text-white mb-0.5 truncate">{partner.companyName}</div>
      {(partner.contactFirstName || partner.contactLastName) && (
        <div className="text-xs text-slate-500 truncate mb-1">
          {[partner.contactFirstName, partner.contactLastName].filter(Boolean).join(' ')}
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        {partner.event && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20 whitespace-nowrap">
            {partner.event}
          </span>
        )}
        {partner.tier && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700 whitespace-nowrap">
            {partner.tier}
          </span>
        )}
      </div>
      {next && (
        <button
          onClick={(e) => { e.preventDefault(); onAdvance(partner.id, next) }}
          disabled={advancing}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 hover:border-emerald-500/40 disabled:opacity-50 transition-all"
        >
          {advancing ? '…' : <><ArrowRight className="w-3 h-3" /> Move to {next}</>}
        </button>
      )}
      {!next && partner.status === 'Confirmed' && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-emerald-400 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
        </div>
      )}
    </Link>
  )
}

// ── Kanban board ──────────────────────────────────────────────────────────────

function KanbanBoard({ partners, onAdvance, onEdit, advancingId }: {
  partners: Sponsor[]
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

  const handleDragStart = (e: React.DragEvent, partner: Sponsor) => {
    e.dataTransfer.setData('cardId', partner.id)
    e.dataTransfer.setData('fromStatus', partner.status)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => setDraggingId(partner.id), 0)
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
      <div ref={boardRef} className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-300px)]">
        {BOARD_COLS.map((col) => {
          const cards = partners.filter((p) => p.status === col.status)
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
                  isOver ? 'border-dashed scale-[1.02] shadow-lg' : 'border-[#1a3a5c]/60'
                )}
                style={{
                  background: isOver ? `${col.hex}14` : `${col.hex}06`,
                  borderColor: isOver ? col.hex : undefined,
                  boxShadow: isOver ? `0 0 0 2px ${col.hex}30` : undefined,
                }}
              >
                {cards.map((p) => (
                  <PartnerCard
                    key={p.id}
                    partner={p}
                    onAdvance={onAdvance}
                    onEdit={onEdit}
                    advancing={advancingId === p.id}
                    onDragStart={(e) => handleDragStart(e, p)}
                    onDragEnd={handleDragEnd}
                    isDragging={draggingId === p.id}
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
                    {isOver ? 'Drop here' : 'No partners'}
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

// ── Page ──────────────────────────────────────────────────────────────────────

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
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['partners', keyword, page, pageSize, sortBy, sortDir],
    queryFn: () => fetchPartners(keyword, page, pageSize, sortBy, sortDir),
    placeholderData: (prev) => prev,
  })

  const { data: boardData, isLoading: boardLoading } = useQuery({
    queryKey: ['partners-board', keyword],
    queryFn: () => fetchPartners(keyword, 1, 500, 'companyName', 'asc'),
    enabled: viewMode === 'board',
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

  const advanceStage = async (id: string, next: string) => {
    setAdvancingId(id)
    try {
      await fetch(`/api/partners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      queryClient.invalidateQueries({ queryKey: ['partners-board'] })
    } finally {
      setAdvancingId(null)
    }
  }

  const rows: Sponsor[] = data?.data ?? []
  const boardPartners: Sponsor[] = boardData?.data ?? []
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
      await Promise.allSettled([...selected].map((id) => fetch(`/api/partners/${id}`, { method: 'DELETE' })))
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['partners'] })
    } finally {
      setBulkDeleting(false)
    }
  }

  // Server-side export — the old client-side CSV only covered the rows on the
  // current page, silently dropping everyone else.
  const exportCSV = (ids?: Set<string>) => {
    const params = new URLSearchParams()
    if (ids && ids.size > 0) params.set('ids', Array.from(ids).join(','))
    else if (keyword) params.set('query', keyword)
    const a = document.createElement('a')
    a.href = `/api/partners/export?${params}`
    a.download = 'partners-export.csv'
    a.click()
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
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-[#1a3a5c] overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                    viewMode === 'table' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-white'
                  )}
                >
                  <LayoutList className="w-3.5 h-3.5" /> List
                </button>
                <div className="w-px h-5 bg-[#1a3a5c]" />
                <button
                  onClick={() => setViewMode('board')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                    viewMode === 'board' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-white'
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Board
                </button>
              </div>
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
      {selected.size > 0 && viewMode === 'table' && (
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
        <div className={cn('max-w-[1400px] mx-auto px-4 sm:px-6 py-3', viewMode === 'board' ? '' : 'space-y-3')}>

          {/* ── Board view ── */}
          {viewMode === 'board' && (
            <div>
              {/* Stage summary strip */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {BOARD_COLS.map((col) => {
                  const cards = boardPartners.filter((p) => p.status === col.status)
                  return (
                    <div key={col.status} className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-lg bg-[#0d2040] border border-[#1a3a5c]">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.hex }} />
                      <span className="text-xs text-slate-400">{col.label}</span>
                      <span className="text-sm font-bold text-white tabular-nums">{cards.length}</span>
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
                        {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-slate-700/20 rounded-xl animate-pulse" />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <KanbanBoard
                  partners={boardPartners}
                  onAdvance={advanceStage}
                  onEdit={setEditingPartner}
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
                            <th className="w-24" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((s) => {
                            const next = nextStage(s.status)
                            return (
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
                                    {next && (
                                      <button
                                        onClick={() => advanceStage(s.id, next)}
                                        disabled={advancingId === s.id}
                                        title={`Move to ${next}`}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/20 disabled:opacity-50 transition-all whitespace-nowrap"
                                      >
                                        {advancingId === s.id ? '…' : <><ArrowRight className="w-3 h-3" />{next}</>}
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.preventDefault(); setEditingPartner(s) }}
                                      className="p-1.5 rounded-md hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-400"
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
            </>
          )}
        </div>
      </div>

      {showModal && (
        <SponsorFormModal
          defaultTier="Media Partner"
          entityLabel="Partner"
          keepTier
          partnerMode
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); refetch() }}
        />
      )}
      {editingPartner && (
        <SponsorFormModal
          sponsor={editingPartner}
          entityLabel="Partner"
          keepTier
          partnerMode
          onClose={() => setEditingPartner(null)}
          onSaved={() => { setEditingPartner(null); refetch(); queryClient.invalidateQueries({ queryKey: ['partners-board'] }) }}
        />
      )}
    </div>
  )
}
