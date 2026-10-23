'use client'

// Pick the events a company is part of: one tile per event, in its brand's
// colour, clicked on or off. `existing` are the events it is in now; a tile
// says what saving will do to it (added, to be added, to be removed).
// `current` marks the event of the record being edited.

import { Check } from 'lucide-react'
import { eventLook } from '@/lib/portals'

interface Props {
  options: string[]
  selected: string[]
  onToggle: (event: string) => void
  existing?: string[]
  current?: string | null
}

function parts(label: string) {
  const year = label.match(/\b(20\d{2})\b/)?.[1] ?? ''
  const look = eventLook(label.replace(year, '').trim())
  return { look, title: [look.city !== '—' ? look.city : '', year].filter(Boolean).join(' ') || label }
}

export function EventPicker({ options, selected, onToggle, existing = [], current }: Props) {
  const lc = (s: string) => s.toLowerCase()
  const has = (list: string[], ev: string) => list.some((x) => lc(x) === lc(ev))
  // The events it is in first (this record's at the front), then the rest.
  const shown = [
    ...existing.slice().sort((a, b) => (current && lc(a) === lc(current) ? -1 : current && lc(b) === lc(current) ? 1 : 0)),
    ...options.filter((ev) => !has(existing, ev)),
  ]
  if (!shown.length) return <p className="text-xs" style={{ color: 'var(--fg-4)' }}>No upcoming events.</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {shown.map((ev) => {
        const on = has(selected, ev)
        const isIn = has(existing, ev)
        const removing = isIn && !on
        const { look, title } = parts(ev)
        const note = removing ? 'Will be removed' : isIn ? (current && lc(ev) === lc(current) ? 'This record' : 'Added') : on ? 'Will be added' : null
        return (
          <button
            key={ev}
            type="button"
            onClick={() => onToggle(ev)}
            aria-pressed={on}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
            style={{
              border: `1px ${removing ? 'dashed' : 'solid'} ${removing ? 'var(--bad, #dc2626)' : on ? look.accentLine : 'var(--line)'}`,
              background: on ? look.accentSoft : 'var(--bg)',
              opacity: removing ? 0.8 : 1,
            }}
          >
            <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: removing ? 'var(--line-3)' : look.accent }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-tight" style={{ color: 'var(--fg)', textDecoration: removing ? 'line-through' : undefined }}>{title}</span>
              <span className="block text-[11.5px] mt-0.5 truncate" style={{ color: removing ? 'var(--bad, #dc2626)' : 'var(--fg-3)' }}>
                {look.series}{note ? ` · ${note}` : ''}
              </span>
            </span>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: on ? look.accent : 'transparent', border: on ? 'none' : '1.5px solid var(--line-3)' }}
            >
              {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
