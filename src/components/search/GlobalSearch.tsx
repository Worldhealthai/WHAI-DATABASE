'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, Building2, TrendingUp, BookOpen } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

async function globalSearch(q: string) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['global-search', query],
    queryFn: () => globalSearch(query),
    enabled: query.length >= 2,
    staleTime: 10000,
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const hasResults =
    data &&
    (data.contacts?.length || data.companies?.length || data.deals?.length || data.insights?.length)

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#112850] border border-[#1a3a5c] focus-within:border-[#00B4D8] transition-colors">
        <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Search contacts, companies, deals..."
          className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none min-w-0"
        />
        {query && (
          <kbd className="text-[10px] text-slate-500 hidden sm:block">ESC</kbd>
        )}
      </div>

      {open && hasResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0D1F3C] border border-[#1a3a5c] rounded-lg shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto">
          {data.contacts?.length > 0 && (
            <SearchSection
              title="Contacts"
              icon={<Users className="w-3 h-3" />}
              items={data.contacts.map((c: any) => ({
                id: c.id,
                label: `${c.first_name} ${c.last_name}`,
                sub: `${c.job_title}${c.company ? ` · ${c.company.name}` : ''}`,
                href: `/contacts/${c.id}`,
              }))}
              onSelect={(href) => { router.push(href); setOpen(false); setQuery('') }}
            />
          )}
          {data.companies?.length > 0 && (
            <SearchSection
              title="Companies"
              icon={<Building2 className="w-3 h-3" />}
              items={data.companies.map((c: any) => ({
                id: c.id,
                label: c.name,
                sub: `${c.headquarters_city ?? ''} ${c.headquarters_country ?? ''}`.trim(),
                href: `/companies/${c.id}`,
              }))}
              onSelect={(href) => { router.push(href); setOpen(false); setQuery('') }}
            />
          )}
          {data.deals?.length > 0 && (
            <SearchSection
              title="Deals"
              icon={<TrendingUp className="w-3 h-3" />}
              items={data.deals.map((d: any) => ({
                id: d.id,
                label: d.title,
                sub: d.deal_type,
                href: `/deals/${d.id}`,
              }))}
              onSelect={(href) => { router.push(href); setOpen(false); setQuery('') }}
            />
          )}
          {data.insights?.length > 0 && (
            <SearchSection
              title="Insights"
              icon={<BookOpen className="w-3 h-3" />}
              items={data.insights.map((i: any) => ({
                id: i.id,
                label: i.title,
                sub: i.content_type,
                href: `/insights/${i.slug}`,
              }))}
              onSelect={(href) => { router.push(href); setOpen(false); setQuery('') }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SearchSection({
  title, icon, items, onSelect,
}: {
  title: string
  icon: React.ReactNode
  items: { id: string; label: string; sub: string; href: string }[]
  onSelect: (href: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#1a3a5c]">
        <span className="text-[#00B4D8]">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</span>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.href)}
          className="w-full text-left px-3 py-2 hover:bg-[#112850] transition-colors"
        >
          <div className="text-sm text-white font-medium truncate">{item.label}</div>
          <div className="text-xs text-slate-400 truncate">{item.sub}</div>
        </button>
      ))}
    </div>
  )
}
