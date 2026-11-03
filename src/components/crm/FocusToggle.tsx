'use client'

// Health / Pharma on a contact (lib/contactFocus): which side of the business
// they are for, so the right people at a company are worked for World Health
// AI or World Pharma AI. Either, both or neither; a tap saves it on every
// record the person has (the rows given, and any others with their email).

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FOCUSES, type Focus } from '@/lib/contactFocus'
import type { FocusRow } from '@/lib/segments'

// The brands' colours: World Health AI blue, World Pharma AI teal.
const LOOK: Record<Focus, string> = { Health: 'london', Pharma: 'pharma' }

export function FocusToggle({ rows, email, initial, size = 'sm' }: { rows: FocusRow[]; email?: string | null; initial: Focus[]; size?: 'sm' | 'xs' }) {
  const qc = useQueryClient()
  const [focus, setFocus] = useState<Focus[]>(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const flip = async (f: Focus) => {
    const before = focus
    const next = FOCUSES.filter((x) => (x === f ? !before.includes(x) : before.includes(x)))
    setFocus(next)
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/contact-focus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows, email: email || undefined, focus: next }) })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not save')
      qc.invalidateQueries({ queryKey: ['ws-segments'] })
    } catch (e) {
      setFocus(before)
      setErr(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label="Relevant for" title={err || 'Relevant for World Health AI, World Pharma AI or both'}>
      {FOCUSES.map((f) => {
        const on = focus.includes(f)
        return (
          <button
            key={f}
            type="button"
            disabled={busy}
            aria-pressed={on}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); flip(f) }}
            className={`inline-flex items-center rounded-md font-medium transition-colors disabled:opacity-60 ${size === 'xs' ? 'h-[22px] px-2 text-[11px]' : 'h-[26px] px-2.5 text-[12px]'}`}
            style={on
              ? { background: `var(--ev-${LOOK[f]}-soft)`, color: `var(--ev-${LOOK[f]}-ink)`, border: `1px solid var(--ev-${LOOK[f]})` }
              : { background: 'transparent', color: 'var(--fg-4)', border: '1px dashed var(--line-3)' }}
          >
            {f}
          </button>
        )
      })}
      {err && <span className="text-[11.5px]" style={{ color: 'var(--bad)' }}>{err}</span>}
    </span>
  )
}
