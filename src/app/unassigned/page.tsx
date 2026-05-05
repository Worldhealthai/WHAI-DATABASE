'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users, Mic, Award, SkipForward, Search, Upload, CheckCircle2,
  ChevronLeft, ChevronRight, Mail, Phone, Building2, Briefcase,
  MapPin, Inbox, Trash2, Calendar, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

async function fetchUnassigned(page: number, query: string, batch: string) {
  const params = new URLSearchParams({ status: 'pending', page: String(page), pageSize: '20' })
  if (query) params.set('query', query)
  if (batch) params.set('batch', batch)
  const res = await fetch(`/api/staged-contacts?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

function getSuggestion(contact: any): 'delegate' | 'speaker' | 'sponsor' | null {
  const tags = (contact.tags ?? '').toLowerCase()
  if (tags.includes('speaker')) return 'speaker'
  if (tags.includes('delegate')) return 'delegate'
  return null
}

function initials(c: any) {
  return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase() || '?'
}

const ASSIGN_TYPES = [
  {
    type: 'delegate' as const,
    label: 'Delegate',
    icon: Users,
    color: 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/30 hover:bg-[#00B4D8]/25 hover:border-[#00B4D8]/60',
    activeBg: 'bg-[#00B4D8]/20 border-[#00B4D8]/50',
    bulkColor: 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/40 hover:bg-[#00B4D8]/25',
  },
  {
    type: 'speaker' as const,
    label: 'Speaker',
    icon: Mic,
    color: 'bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25 hover:border-purple-500/60',
    activeBg: 'bg-purple-500/20 border-purple-500/50',
    bulkColor: 'bg-purple-500/15 text-purple-400 border-purple-500/40 hover:bg-purple-500/25',
  },
  {
    type: 'sponsor' as const,
    label: 'Sponsor',
    icon: Award,
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/60',
    activeBg: 'bg-amber-500/20 border-amber-500/50',
    bulkColor: 'bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/25',
  },
]

// Custom checkbox component
function Checkbox({ checked, indeterminate, onChange, disabled }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
        checked || indeterminate
          ? 'bg-[#00B4D8] border-[#00B4D8]'
          : 'border-slate-600 hover:border-slate-400 bg-transparent'
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

export default function UnassignedPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [activeEvent, setActiveEvent] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState<Record<string, string>>({})
  const [justDone, setJustDone] = useState<Record<string, string>>({})
  const [bulkOp, setBulkOp] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['unassigned', page, query, activeEvent],
    queryFn: () => fetchUnassigned(page, query, activeEvent),
    placeholderData: (prev) => prev,
  })

  const contacts = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const batches: string[] = data?.batches ?? []

  // Contacts on this page that are not yet handled
  const actionableIds: string[] = contacts
    .filter((c: any) => !justDone[c.id])
    .map((c: any) => c.id)

  const allPageSelected = actionableIds.length > 0 && actionableIds.every((id) => selected.has(id))
  const somePageSelected = actionableIds.some((id) => selected.has(id))

  const switchEvent = (event: string) => {
    setActiveEvent(event)
    setPage(1)
    setSelected(new Set())
    setJustDone({})
  }

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) actionableIds.forEach((id) => next.delete(id))
      else actionableIds.forEach((id) => next.add(id))
      return next
    })
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAssign = useCallback(async (id: string, assignAs: 'delegate' | 'speaker' | 'sponsor') => {
    setAssigning((p) => ({ ...p, [id]: assignAs }))
    try {
      const res = await fetch(`/api/staged-contacts/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignAs }),
      })
      if (!res.ok) throw new Error('Failed')
      setJustDone((p) => ({ ...p, [id]: assignAs }))
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['unassigned'] }), 800)
    } catch {
      setAssigning((p) => { const n = { ...p }; delete n[id]; return n })
    }
  }, [queryClient])

  const handleSkip = useCallback(async (id: string) => {
    setAssigning((p) => ({ ...p, [id]: 'skipping' }))
    try {
      await fetch(`/api/staged-contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'skipped' }),
      })
      setJustDone((p) => ({ ...p, [id]: 'skipped' }))
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['unassigned'] }), 500)
    } catch {
      setAssigning((p) => { const n = { ...p }; delete n[id]; return n })
    }
  }, [queryClient])

  const handleBulkAssign = async (assignAs: 'delegate' | 'speaker' | 'sponsor') => {
    if (!selected.size) return
    setBulkOp(assignAs)
    const ids = [...selected]
    const CHUNK = 5
    for (let i = 0; i < ids.length; i += CHUNK) {
      await Promise.allSettled(
        ids.slice(i, i + CHUNK).map((id) =>
          fetch(`/api/staged-contacts/${id}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignAs }),
          }).then((r) => {
            if (r.ok) {
              setJustDone((p) => ({ ...p, [id]: assignAs }))
              setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
            }
          })
        )
      )
    }
    setBulkOp(null)
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['unassigned'] }), 600)
  }

  const handleBulkDelete = async () => {
    if (!selected.size) return
    if (!confirm(`Delete ${selected.size} selected contact${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    setBulkOp('delete')
    try {
      await fetch('/api/staged-contacts/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      })
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['unassigned'] })
    } finally {
      setBulkOp(null)
    }
  }

  const handleDeleteEvent = async () => {
    const label = activeEvent ? `all contacts in "${activeEvent}"` : 'all unassigned contacts'
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return
    const url = activeEvent
      ? `/api/staged-contacts?batch=${encodeURIComponent(activeEvent)}`
      : '/api/staged-contacts'
    await fetch(url, { method: 'DELETE' })
    setSelected(new Set())
    queryClient.invalidateQueries({ queryKey: ['unassigned'] })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* ── Header ── */}
      <div className="shrink-0 bg-[#0A1628] border-b border-[#1a3a5c] z-20">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6">

          {/* Title row */}
          <div className="flex items-center justify-between pt-4 pb-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Inbox className="w-5 h-5 text-[#00B4D8]" />
                Unassigned Contacts
              </h1>
              {!isLoading && (
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="text-white font-semibold">{total.toLocaleString()}</span> pending
                  {activeEvent && <span className="text-[#00B4D8]"> · {activeEvent}</span>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {total > 0 && (
                <button
                  onClick={handleDeleteEvent}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{activeEvent ? 'Delete event' : 'Delete all'}</span>
                </button>
              )}
              <Link
                href="/import"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1a3a5c] text-slate-300 hover:text-white hover:border-slate-500 text-sm transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Import CSV</span>
              </Link>
            </div>
          </div>

          {/* Event tabs */}
          {batches.length > 0 && (
            <div className="flex items-center gap-1.5 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              <button
                onClick={() => switchEvent('')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 border',
                  activeEvent === ''
                    ? 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/40'
                    : 'text-slate-400 hover:text-white border-transparent hover:border-[#1a3a5c] hover:bg-[#112850]/50'
                )}
              >
                All events
              </button>
              {batches.map((b) => (
                <button
                  key={b}
                  onClick={() => switchEvent(b)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 border',
                    activeEvent === b
                      ? 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/40'
                      : 'text-slate-400 hover:text-white border-transparent hover:border-[#1a3a5c] hover:bg-[#112850]/50'
                  )}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(searchInput); setPage(1) } }}
                placeholder="Search by name, email, organisation..."
                className="w-full pl-9 pr-4 py-2 bg-[#112850] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bulk actions bar ── */}
      {selected.size > 0 && (
        <div className="shrink-0 bg-[#0d2040] border-b border-[#00B4D8]/20 z-10">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-sm font-semibold text-[#00B4D8] shrink-0 mr-1">
              {selected.size} selected
            </span>
            {ASSIGN_TYPES.map(({ type, label, icon: Icon, bulkColor }) => (
              <button
                key={type}
                onClick={() => handleBulkAssign(type)}
                disabled={!!bulkOp}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50',
                  bulkColor,
                  bulkOp === type && 'animate-pulse'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {bulkOp === type ? 'Assigning…' : `Assign as ${label}`}
              </button>
            ))}
            <button
              onClick={handleBulkDelete}
              disabled={!!bulkOp}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-50',
                bulkOp === 'delete' && 'animate-pulse'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkOp === 'delete' ? 'Deleting…' : 'Delete'}
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

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 space-y-2">

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="whai-card p-4 animate-pulse flex gap-3">
                  <div className="w-4 h-4 rounded bg-slate-700/50 mt-1 shrink-0" />
                  <div className="w-10 h-10 rounded-full bg-slate-700/50 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-slate-700/50 rounded" />
                    <div className="h-3 w-32 bg-slate-700/30 rounded" />
                  </div>
                  <div className="hidden sm:flex gap-2">
                    {[1, 2, 3].map((j) => <div key={j} className="w-24 h-8 bg-slate-700/30 rounded-lg" />)}
                  </div>
                </div>
              ))}
            </div>

          ) : error ? (
            <div className="py-16 text-center text-red-400 text-sm">Failed to load. Please refresh.</div>

          ) : contacts.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#112850] flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-white font-medium">
                {activeEvent ? `No contacts in "${activeEvent}"` : 'Inbox is empty'}
              </p>
              <p className="text-slate-500 text-sm">
                {query ? 'No contacts match your search.' : 'All contacts have been assigned or deleted.'}
              </p>
              <Link
                href="/import"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00B4D8] text-[#0A1628] text-sm font-semibold hover:bg-[#00B4D8]/90 transition-colors mt-2"
              >
                <Upload className="w-4 h-4" /> Import CSV
              </Link>
            </div>

          ) : (
            <>
              {/* Select-all row */}
              <div className="flex items-center gap-2.5 px-1 py-0.5">
                <Checkbox
                  checked={allPageSelected}
                  indeterminate={somePageSelected && !allPageSelected}
                  onChange={toggleSelectAll}
                />
                <span className="text-xs text-slate-500">
                  {allPageSelected
                    ? `All ${actionableIds.length} on this page selected`
                    : somePageSelected
                      ? `${selected.size} selected — click to select all ${actionableIds.length} on page`
                      : `Select all ${actionableIds.length} on this page`
                  }
                </span>
              </div>

              {contacts.map((contact: any) => {
                const suggestion = getSuggestion(contact)
                const busy = assigning[contact.id]
                const done = justDone[contact.id]
                const isSelected = selected.has(contact.id)
                const tags = contact.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) ?? []

                return (
                  <div
                    key={contact.id}
                    className={cn(
                      'whai-card p-4 sm:p-5 transition-all duration-300',
                      done && 'opacity-40 scale-[0.99] pointer-events-none',
                      isSelected && !done && 'border-[#00B4D8]/40 bg-[#00B4D8]/5'
                    )}
                  >
                    <div className="flex items-start gap-3">

                      {/* Checkbox */}
                      <div className="pt-0.5 shrink-0">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => !done && toggleOne(contact.id)}
                          disabled={!!done}
                        />
                      </div>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-[#112850] text-slate-300 flex items-center justify-center text-sm font-bold shrink-0">
                        {initials(contact)}
                      </div>

                      {/* Info + actions */}
                      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start gap-3">
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">
                              {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown'}
                            </span>
                            {suggestion && (
                              <span className={cn(
                                'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                                suggestion === 'speaker'
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-[#00B4D8]/15 text-[#00B4D8]'
                              )}>
                                {suggestion}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            {contact.email && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Mail className="w-3 h-3 text-slate-500" />{contact.email}
                              </span>
                            )}
                            {contact.organization && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Building2 className="w-3 h-3 text-slate-500" />{contact.organization}
                              </span>
                            )}
                            {contact.jobTitle && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Briefcase className="w-3 h-3" />{contact.jobTitle}
                              </span>
                            )}
                            {(contact.city || contact.country) && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <MapPin className="w-3 h-3" />{[contact.city, contact.country].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </div>

                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {tags.map((t: string) => (
                                <span key={t} className="px-1.5 py-0.5 rounded bg-[#112850] text-slate-400 text-[10px] border border-[#1a3a5c]">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {contact.notes && (
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">{contact.notes}</p>
                          )}
                        </div>

                        {/* Assign buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          {done ? (
                            <div className={cn(
                              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium',
                              done === 'skipped' ? 'text-slate-500' : 'text-green-400'
                            )}>
                              <CheckCircle2 className="w-4 h-4" />
                              {done === 'skipped' ? 'Skipped' : `→ ${done}`}
                            </div>
                          ) : (
                            <>
                              {ASSIGN_TYPES.map(({ type, label, icon: Icon, color, activeBg }) => (
                                <button
                                  key={type}
                                  onClick={() => handleAssign(contact.id, type)}
                                  disabled={!!busy}
                                  className={cn(
                                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50',
                                    suggestion === type ? activeBg : color,
                                    busy === type && 'animate-pulse'
                                  )}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {busy === type ? '…' : label}
                                </button>
                              ))}
                              <button
                                onClick={() => handleSkip(contact.id)}
                                disabled={!!busy}
                                className="flex items-center gap-1 px-2 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 border border-transparent hover:border-[#1a3a5c] transition-colors disabled:opacity-50"
                              >
                                <SkipForward className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-[#1a3a5c]">
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded hover:bg-[#112850] disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded hover:bg-[#112850] disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
