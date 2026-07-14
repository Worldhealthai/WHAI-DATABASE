'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Award, Mic, Network, Users, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Result {
  id: string
  label: string
  sub?: string
  type: 'delegate' | 'sponsor' | 'speaker' | 'partner'
  href: string
}

const TYPE_META = {
  delegate: { icon: Users,   color: '#38bdf8', label: 'Delegates',         bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     text: 'text-sky-400' },
  sponsor: { icon: Award,   color: '#f59e0b', label: 'Sponsors',        bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400' },
  speaker: { icon: Mic,    color: '#a855f7', label: 'Speakers',         bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  text: 'text-purple-400' },
  partner: { icon: Network, color: '#10b981', label: 'Partners & Media', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const router = useRouter()

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setResults([]) }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const [delegatesRes, sponsorsRes, speakersRes, partnersRes] = await Promise.all([
        fetch(`/api/delegates?query=${encodeURIComponent(q)}&pageSize=5`),
        fetch(`/api/sponsors?query=${encodeURIComponent(q)}&pageSize=5`),
        fetch(`/api/speakers?query=${encodeURIComponent(q)}&pageSize=5`),
        fetch(`/api/partners?query=${encodeURIComponent(q)}&pageSize=5`),
      ])
      const [delegates, sponsors, speakers, partners] = await Promise.all([
        delegatesRes.ok ? delegatesRes.json() : { data: [] },
        sponsorsRes.ok ? sponsorsRes.json() : { data: [] },
        speakersRes.ok ? speakersRes.json() : { data: [] },
        partnersRes.ok ? partnersRes.json() : { data: [] },
      ])

      const out: Result[] = [
        ...(delegates.data ?? []).map((d: any) => ({
          id: d.id, type: 'delegate' as const, href: `/delegates/${d.id}`,
          label: `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim() || d.email,
          sub: d.organization || d.jobTitle || d.email,
        })),
        ...(sponsors.data ?? []).map((s: any) => ({
          id: s.id, type: 'sponsor' as const, href: `/sponsors/${s.id}`,
          label: s.companyName,
          sub: [s.contactFirstName, s.contactLastName].filter(Boolean).join(' ') || s.contactEmail,
        })),
        ...(speakers.data ?? []).map((s: any) => ({
          id: s.id, type: 'speaker' as const, href: `/speakers/${s.id}`,
          label: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
          sub: s.organization || s.jobTitle,
        })),
        ...(partners.data ?? []).map((s: any) => ({
          id: s.id, type: 'partner' as const, href: `/partners/${s.id}`,
          label: s.companyName,
          sub: s.tier,
        })),
      ]
      setResults(out)
      setHighlighted(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 250)
    return () => clearTimeout(debounceRef.current)
  }, [query, search])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && results[highlighted]) navigate(results[highlighted].href)
    if (e.key === 'Escape') setOpen(false)
  }

  // Group results by type
  const grouped = (['delegate', 'sponsor', 'speaker', 'partner'] as const)
    .map(type => ({ type, items: results.filter(r => r.type === type) }))
    .filter(g => g.items.length > 0)

  return (
    <>
      {/* Search trigger button in navbar */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#112850] border border-[#1a3a5c] text-slate-400 hover:text-white hover:border-slate-500 text-xs transition-colors group"
        title="Search (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-slate-500">Search…</span>
        <kbd className="hidden sm:inline ml-1 px-1 py-0.5 rounded text-[10px] bg-[#0A1628] border border-[#1a3a5c] text-slate-600">⌘K</kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[#0d2040] border border-[#1a3a5c] rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1a3a5c]">
              {loading
                ? <Loader2 className="w-4 h-4 text-slate-500 animate-spin shrink-0" />
                : <Search className="w-4 h-4 text-slate-500 shrink-0" />
              }
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search delegates, sponsors, speakers, partners…"
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] bg-[#0A1628] border border-[#1a3a5c] text-slate-600">Esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {!query.trim() && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  Type to search across all delegates, sponsors, speakers, and partners
                </div>
              )}

              {query.trim() && !loading && results.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No results for <span className="text-slate-300">"{query}"</span>
                </div>
              )}

              {grouped.map(({ type, items }) => {
                const meta = TYPE_META[type]
                const Icon = meta.icon
                let globalIdx = results.indexOf(items[0])
                return (
                  <div key={type}>
                    <div className="px-4 py-2 flex items-center gap-2 border-t border-[#1a3a5c]/50 first:border-t-0">
                      <Icon className="w-3 h-3" style={{ color: meta.color }} />
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{meta.label}</span>
                    </div>
                    {items.map((r, i) => {
                      const idx = results.indexOf(r)
                      const isHighlighted = idx === highlighted
                      return (
                        <button
                          key={r.id}
                          onMouseEnter={() => setHighlighted(idx)}
                          onClick={() => navigate(r.href)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            isHighlighted ? 'bg-[#112850]' : 'hover:bg-[#0d1f3a]'
                          )}
                        >
                          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0', meta.bg, meta.border, 'border')} style={{ color: meta.color }}>
                            {r.label.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{r.label}</div>
                            {r.sub && <div className="text-xs text-slate-500 truncate">{r.sub}</div>}
                          </div>
                          {isHighlighted && (
                            <kbd className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-[#0A1628] border border-[#1a3a5c] text-slate-500">↵</kbd>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {results.length > 0 && (
              <div className="px-4 py-2 border-t border-[#1a3a5c]/50 flex items-center gap-3 text-[10px] text-slate-600">
                <span><kbd className="px-1 border border-[#1a3a5c] rounded bg-[#0A1628]">↑↓</kbd> navigate</span>
                <span><kbd className="px-1 border border-[#1a3a5c] rounded bg-[#0A1628]">↵</kbd> open</span>
                <span><kbd className="px-1 border border-[#1a3a5c] rounded bg-[#0A1628]">Esc</kbd> close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
