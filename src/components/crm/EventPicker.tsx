'use client'

// Pick the events a company is part of: one tile per event, in its brand's
// colour, clicked on or off. `locked` is the event of the record being
// edited (always on); `already` are events the company is in through its
// other records (shown, not offered again).

import { Check, Lock } from 'lucide-react'
import { eventLook } from '@/lib/portals'

interface Props {
  options: string[]
  selected: string[]
  onToggle: (event: string) => void
  locked?: string | null
  already?: string[]
}

function parts(label: string) {
  const year = label.match(/\b(20\d{2})\b/)?.[1] ?? ''
  const look = eventLook(label.replace(year, '').trim())
  return { look, title: [look.city !== '—' ? look.city : '', year].filter(Boolean).join(' ') || label }
}

export function EventPicker({ options, selected, onToggle, locked, already = [] }: Props) {
  const has = (list: string[], ev: string) => list.some((x) => x.toLowerCase() === ev.toLowerCase())
  const shown = [
    ...(locked ? [locked] : []),
    ...already.filter((ev) => !locked || ev.toLowerCase() !== locked.toLowerCase()),
    ...options.filter((ev) => !(locked && ev.toLowerCase() === locked.toLowerCase()) && !has(already, ev)),
  ]
  if (!shown.length) return <p className="text-xs" style={{ color: 'var(--fg-4)' }}>No upcoming events to add.</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {shown.map((ev) => {
        const isLocked = !!locked && ev.toLowerCase() === locked.toLowerCase()
        const isAlready = !isLocked && has(already, ev)
        const on = isLocked || isAlready || has(selected, ev)
        const { look, title } = parts(ev)
        const note = isLocked ? 'This record' : isAlready ? 'Already added' : null
        return (
          <button
            key={ev}
            type="button"
            disabled={isLocked || isAlready}
            onClick={() => onToggle(ev)}
            aria-pressed={on}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors disabled:cursor-default"
            style={{
              border: `1px solid ${on ? look.accentLine : 'var(--line)'}`,
              background: on ? look.accentSoft : 'var(--bg)',
            }}
          >
            <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: look.accent }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-tight" style={{ color: 'var(--fg)' }}>{title}</span>
              <span className="block text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--fg-3)' }}>
                {look.series}{note ? ` · ${note}` : ''}
              </span>
            </span>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: on ? look.accent : 'transparent',
                border: on ? 'none' : '1.5px solid var(--line-3)',
                opacity: isAlready ? 0.6 : 1,
              }}
            >
              {isLocked ? <Lock className="w-3 h-3 text-white" /> : on ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
