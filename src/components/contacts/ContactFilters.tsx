'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContactFilters } from '@/types'

interface ContactFiltersProps {
  filters: ContactFilters
  taxonomy: undefined
  onChange: (filters: ContactFilters) => void
}

function FilterSection({
  title, defaultOpen = true, children,
}: {
  title: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="filter-section">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors mb-2"
      >
        {title}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  )
}

function MultiCheckbox({
  options, selected, onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value))
    } else {
      onChange([...selected, value])
    }
  }
  return (
    <>
      {options.map((option) => (
        <label
          key={option}
          className="flex items-center gap-2 cursor-pointer py-0.5 group"
        >
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => toggle(option)}
            className="w-3.5 h-3.5 rounded border-slate-600 bg-transparent accent-[#00B4D8] cursor-pointer"
          />
          <span className={cn(
            'text-sm transition-colors',
            selected.includes(option) ? 'text-[#00B4D8]' : 'text-slate-300 group-hover:text-white',
          )}>
            {option}
          </span>
        </label>
      ))}
    </>
  )
}

export function ContactFilterSidebar({ filters, onChange }: ContactFiltersProps) {
  const update = (partial: Partial<ContactFilters>) => onChange({ ...filters, ...partial })

  return (
    <aside className="w-64 shrink-0 space-y-0 overflow-y-auto pr-2">
      {/* Keyword search */}
      <div className="filter-section">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={filters.query ?? ''}
            onChange={(e) => update({ query: e.target.value || undefined })}
            placeholder="Search name, title, company..."
            className="w-full pl-8 pr-3 py-2 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8] transition-colors"
          />
        </div>
      </div>

      {/* Engagement Score */}
      <FilterSection title="Engagement Score" defaultOpen={false}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Min</label>
              <input
                type="number"
                min={0} max={100}
                value={filters.engagementMin ?? ''}
                onChange={(e) => update({ engagementMin: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white outline-none focus:border-[#00B4D8]"
                placeholder="0"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Max</label>
              <input
                type="number"
                min={0} max={100}
                value={filters.engagementMax ?? ''}
                onChange={(e) => update({ engagementMax: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white outline-none focus:border-[#00B4D8]"
                placeholder="100"
              />
            </div>
          </div>
        </div>
      </FilterSection>
    </aside>
  )
}
