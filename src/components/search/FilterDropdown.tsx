'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterDropdownProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  searchable?: boolean
  // Optional display names for option values (e.g. delegate status
  // 'Confirmed' shown as "Invited"); filtering still uses the raw value.
  labels?: Record<string, string>
}

export function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  searchable = true,
  labels,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Position the portal menu relative to the trigger button
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: 256,
      zIndex: 9999,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()

    function onScroll() { updatePosition() }
    function onResize() { updatePosition() }
    function onMouseDown(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }

    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open, updatePosition])

  // Focus search when opened
  useEffect(() => {
    if (open && searchable) inputRef.current?.focus()
  }, [open, searchable])

  const display = (o: string) => labels?.[o] ?? o
  const filtered = search
    ? options.filter((o) => display(o).toLowerCase().includes(search.toLowerCase()))
    : options

  const toggle = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter((s) => s !== val))
    else onChange([...selected, val])
  }

  const hasSelected = selected.length > 0

  const menu = open && typeof document !== 'undefined' && createPortal(
    <div
      ref={menuRef}
      style={menuStyle}
      className="bg-[#0D1F3C] border border-[#1a3a5c] rounded-lg shadow-2xl shadow-black/60 overflow-hidden"
    >
      {searchable && options.length > 5 && (
        <div className="p-2 border-b border-[#1a3a5c]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full pl-8 pr-3 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-xs text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50"
            />
          </div>
        </div>
      )}

      <div className="max-h-56 overflow-y-auto p-1.5">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-slate-500 text-center">No matches</div>
        ) : (
          filtered.map((option) => {
            const isSelected = selected.includes(option)
            return (
              <button
                key={option}
                onClick={() => toggle(option)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-sm transition-colors',
                  isSelected
                    ? 'bg-[#00B4D8]/10 text-[#00B4D8]'
                    : 'text-slate-300 hover:bg-[#112850] hover:text-white',
                )}
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                    isSelected
                      ? 'bg-[#00B4D8] border-[#00B4D8]'
                      : 'border-slate-600 bg-transparent',
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-[#0A1628]" strokeWidth={3} />}
                </div>
                <span className="truncate">{display(option)}</span>
              </button>
            )
          })
        )}
      </div>

      {hasSelected && (
        <div className="p-2 border-t border-[#1a3a5c] flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            {selected.length} selected
          </span>
          <button
            onClick={() => { onChange([]); setOpen(false) }}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>,
    document.body,
  )

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all whitespace-nowrap',
          open
            ? 'bg-[#00B4D8]/10 text-[#00B4D8] border-[#00B4D8]/40'
            : hasSelected
              ? 'bg-[#00B4D8]/8 text-[#00B4D8] border-[#00B4D8]/30 hover:border-[#00B4D8]/50'
              : 'bg-[#112850]/60 text-slate-300 border-[#1a3a5c] hover:text-white hover:border-slate-500',
        )}
      >
        {label}
        {hasSelected && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#00B4D8] text-[#0A1628] text-[10px] font-bold leading-none">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {menu}
    </div>
  )
}

// ── Active filter chips bar ───────────────────────────────────────────────────

interface ActiveFilter {
  category: string
  key: string
  value: string
  display?: string // optional display name when the raw value isn't user-facing
}

interface ActiveFiltersBarProps {
  filters: ActiveFilter[]
  onRemove: (key: string, value: string) => void
  onClearAll: () => void
}

export function ActiveFiltersBar({ filters, onRemove, onClearAll }: ActiveFiltersBarProps) {
  if (filters.length === 0) return null

  const grouped: Record<string, ActiveFilter[]> = {}
  filters.forEach((f) => {
    if (!grouped[f.category]) grouped[f.category] = []
    grouped[f.category].push(f)
  })

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 py-3 border-b border-[#1a3a5c]">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="flex items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-0.5 pl-1">
            {category}
          </span>
          {items.map((item) => (
            <span
              key={`${item.key}-${item.value}`}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-[#112850] text-slate-200 border border-[#1a3a5c] hover:border-slate-500 transition-colors"
            >
              {item.display ?? item.value}
              <button
                onClick={() => onRemove(item.key, item.value)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-slate-600/50 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ))}
      <button
        onClick={onClearAll}
        className="ml-2 text-xs text-slate-500 hover:text-[#00B4D8] transition-colors"
      >
        Clear all
      </button>
    </div>
  )
}
