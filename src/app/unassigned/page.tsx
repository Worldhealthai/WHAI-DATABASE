'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users, Mic, Award, SkipForward, Search, Upload, CheckCircle2,
  ChevronLeft, ChevronRight, Mail, Phone, Building2, Briefcase,
  MapPin, Tag, ExternalLink, Inbox, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

async function fetchUnassigned(page: number, query: string, batch: string) {
  const params = new URLSearchParams({
    status: 'pending',
    page: String(page),
    pageSize: '20',
  })
  if (query) params.set('query', query)
  if (batch) params.set('batch', batch)
  const res = await fetch(`/api/staged-contacts?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

// Derive suggested assignment from attendeeType tag
function getSuggestion(contact: any): 'delegate' | 'speaker' | 'sponsor' | null {
  const tags = (contact.tags ?? '').toLowerCase()
  if (tags.includes('speaker')) return 'speaker'
  if (tags.includes('delegate')) return 'delegate'
  return null
}

function initials(c: any) {
  return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase() || '?'
}

const ASSIGN_BUTTONS = [
  {
    type: 'delegate' as const,
    label: 'Delegate',
    icon: Users,
    color: 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/30 hover:bg-[#00B4D8]/25 hover:border-[#00B4D8]/60',
    suggestionBg: 'bg-[#00B4D8]/20 border-[#00B4D8]/50',
  },
  {
    type: 'speaker' as const,
    label: 'Speaker',
    icon: Mic,
    color: 'bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25 hover:border-purple-500/60',
    suggestionBg: 'bg-purple-500/20 border-purple-500/50',
  },
  {
    type: 'sponsor' as const,
    label: 'Sponsor',
    icon: Award,
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/60',
    suggestionBg: 'bg-amber-500/20 border-amber-500/50',
  },
]

export default function UnassignedPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('')
  const [assigning, setAssigning] = useState<Record<string, string>>({}) // id → 'delegate'|'speaker'|'sponsor'|'skipping'
  const [justDone, setJustDone] = useState<Record<string, string>>({}) // id → assigned type
  const [deleting, setDeleting] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['unassigned', page, query, selectedBatch],
    queryFn: () => fetchUnassigned(page, query, selectedBatch),
    placeholderData: (prev) => prev,
  })

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
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['unassigned'] })
      }, 800)
    } catch {
      setAssigning((p) => { const n = { ...p }; delete n[id]; return n })
    }
  }, [queryClient])

  const handleDeleteBatch = useCallback(async (batch: string) => {
    const label = batch || 'all unassigned contacts'
    if (!confirm(`Delete ${batch ? `the "${batch}" batch` : 'all unassigned contacts'}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const url = batch ? `/api/staged-contacts?batch=${encodeURIComponent(batch)}` : '/api/staged-contacts'
      await fetch(url, { method: 'DELETE' })
      setSelectedBatch('')
      queryClient.invalidateQueries({ queryKey: ['unassigned'] })
    } finally {
      setDeleting(false)
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
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['unassigned'] })
      }, 500)
    } catch {
      setAssigning((p) => { const n = { ...p }; delete n[id]; return n })
    }
  }, [queryClient])

  const contacts = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const batches: string[] = data?.batches ?? []

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="shrink-0 bg-[#0A1628] border-b border-[#1a3a5c] z-20">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between pt-4 pb-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Inbox className="w-5 h-5 text-[#00B4D8]" />
                Unassigned Contacts
              </h1>
              {!isLoading && (
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="text-white font-semibold">{total.toLocaleString()}</span> contacts waiting to be assigned
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDeleteBatch(selectedBatch)}
                disabled={deleting || total === 0}
                title={selectedBatch ? `Delete "${selectedBatch}" batch` : 'Delete all unassigned'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
                {selectedBatch ? 'Delete batch' : 'Delete all'}
              </button>
              <Link
                href="/import"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1a3a5c] text-slate-300 hover:text-white hover:border-slate-500 text-sm transition-colors"
              >
                <Upload className="w-4 h-4" /> Import CSV
              </Link>
            </div>
          </div>

          {/* Search + batch filter */}
          <div className="flex items-center gap-3 pb-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(searchInput); setPage(1) } }}
                placeholder="Search by name, email, organisation..."
                className="w-full pl-9 pr-4 py-2 bg-[#112850] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50 transition-colors"
              />
            </div>
            {batches.length > 0 && (
              <select
                value={selectedBatch}
                onChange={(e) => { setSelectedBatch(e.target.value); setPage(1) }}
                className="px-3 py-2 bg-[#112850] border border-[#1a3a5c] rounded-lg text-sm text-white outline-none focus:border-[#00B4D8]/50"
              >
                <option value="">All imports</option>
                {batches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 space-y-3">

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="whai-card p-5 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-11 h-11 rounded-full bg-slate-700/50 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 bg-slate-700/50 rounded" />
                      <div className="h-3 w-32 bg-slate-700/30 rounded" />
                    </div>
                    <div className="flex gap-2">
                      {[1,2,3].map((j) => <div key={j} className="w-24 h-8 bg-slate-700/30 rounded-lg" />)}
                    </div>
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
              <p className="text-white font-medium">Inbox is empty</p>
              <p className="text-slate-500 text-sm">
                {query ? 'No contacts match your search.' : 'All contacts have been assigned. Import more to continue.'}
              </p>
              <Link href="/import" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00B4D8] text-[#0A1628] text-sm font-semibold hover:bg-[#00B4D8]/90 transition-colors mt-2">
                <Upload className="w-4 h-4" /> Import CSV
              </Link>
            </div>
          ) : (
            contacts.map((contact: any) => {
              const suggestion = getSuggestion(contact)
              const busy = assigning[contact.id]
              const done = justDone[contact.id]
              const tags = contact.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) ?? []

              return (
                <div
                  key={contact.id}
                  className={cn(
                    'whai-card p-4 sm:p-5 transition-all duration-300',
                    done && 'opacity-40 scale-[0.99]'
                  )}
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Avatar + info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-[#112850] text-slate-300 flex items-center justify-center text-sm font-bold shrink-0">
                        {initials(contact)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-white">
                            {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown'}
                          </span>
                          {suggestion && (
                            <span className={cn(
                              'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                              suggestion === 'speaker' ? 'bg-purple-500/20 text-purple-400' : 'bg-[#00B4D8]/15 text-[#00B4D8]'
                            )}>
                              Suggested: {suggestion}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                          {contact.email && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Mail className="w-3 h-3 text-slate-500" /> {contact.email}
                            </span>
                          )}
                          {contact.phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Phone className="w-3 h-3" /> {contact.phone}
                            </span>
                          )}
                          {contact.organization && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Building2 className="w-3 h-3 text-slate-500" /> {contact.organization}
                            </span>
                          )}
                          {contact.jobTitle && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Briefcase className="w-3 h-3" /> {contact.jobTitle}
                            </span>
                          )}
                          {(contact.city || contact.country) && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="w-3 h-3" /> {[contact.city, contact.country].filter(Boolean).join(', ')}
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
                          <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{contact.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Assign buttons */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0 w-full sm:w-auto">
                      {done ? (
                        <div className={cn(
                          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium',
                          done === 'skipped' ? 'text-slate-500' : 'text-green-400'
                        )}>
                          <CheckCircle2 className="w-4 h-4" />
                          {done === 'skipped' ? 'Skipped' : `Added as ${done}`}
                        </div>
                      ) : (
                        <>
                          {ASSIGN_BUTTONS.map(({ type, label, icon: Icon, color, suggestionBg }) => (
                            <button
                              key={type}
                              onClick={() => handleAssign(contact.id, type)}
                              disabled={!!busy}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50',
                                suggestion === type ? suggestionBg : color,
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
                            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 border border-transparent hover:border-[#1a3a5c] transition-colors disabled:opacity-50"
                          >
                            <SkipForward className="w-3.5 h-3.5" /> Skip
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
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
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded hover:bg-[#112850] disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
