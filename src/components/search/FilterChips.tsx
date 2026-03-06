'use client'

import { X } from 'lucide-react'

interface FilterChip {
  key: string
  label: string
  value: string
  displayValue: string
}

interface FilterChipsProps {
  chips: FilterChip[]
  onRemove: (key: string, value: string) => void
  onClearAll: () => void
}

export function FilterChips({ chips, onRemove, onClearAll }: FilterChipsProps) {
  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border">
      {chips.map((chip) => (
        <span
          key={`${chip.key}-${chip.value}`}
          className="filter-chip"
        >
          <span className="text-slate-400 text-[10px]">{chip.label}:</span>
          <span>{chip.displayValue}</span>
          <button
            onClick={() => onRemove(chip.key, chip.value)}
            className="ml-0.5 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2"
      >
        Clear all
      </button>
    </div>
  )
}
