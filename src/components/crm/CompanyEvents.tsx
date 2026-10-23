'use client'

// The events a company is part of, and a way to add it to more of them. Each
// event is its own record of the company (that event's stage, value and
// package), so adding events makes a fresh record per event with the
// company's details and contacts copied across (lib/companyEditions).

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Check, Loader2 } from 'lucide-react'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { useEventOptions } from '@/lib/useEventOptions'
import { cn } from '@/lib/utils'

interface Edition { id: string; event: string | null; status: string | null }

export function CompanyEvents({ kind, id }: { kind: 'sponsor' | 'partner'; id: string }) {
  const api = kind === 'sponsor' ? '/api/sponsors' : '/api/partners'
  const detail = kind === 'sponsor' ? '/sponsors' : '/partners'
  const queryClient = useQueryClient()
  const options = useEventOptions()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const { data, refetch } = useQuery<{ editions: Edition[] }>({
    queryKey: ['company-events', kind, id],
    queryFn: async () => {
      const r = await fetch(`${api}/${id}/editions`)
      if (!r.ok) throw new Error('editions')
      return r.json()
    },
  })
  const editions = data?.editions ?? []
  const inEvent = new Set(editions.map((e) => String(e.event ?? '').toLowerCase()))
  const available = options.filter((o) => !inEvent.has(o.toLowerCase()))

  const toggle = (ev: string) => setPicked((p) => (p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev]))
  const save = async () => {
    if (!picked.length) return
    setSaving(true)
    setMessage('')
    try {
      const r = await fetch(`${api}/${id}/editions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: picked }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setMessage(j?.error || 'Could not add the events.'); return }
      const n = j?.added?.length ?? 0
      setMessage(n ? `Added to ${n} ${n === 1 ? 'event' : 'events'}.` : 'Already in those events.')
      setPicked([])
      setOpen(false)
      await refetch()
      queryClient.invalidateQueries({ queryKey: [kind === 'sponsor' ? 'sponsors' : 'partners'] })
      queryClient.invalidateQueries({ queryKey: ['ws-list'] })
      queryClient.invalidateQueries({ queryKey: ['ws-board'] })
      queryClient.invalidateQueries({ queryKey: ['ws-stats'] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="whai-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-[var(--fg)]">Events</h2>
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setMessage('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] text-slate-300 hover:text-[var(--fg)] hover:border-slate-500 text-xs transition-colors"
        >
          <CalendarPlus className="w-3.5 h-3.5" /> Add to events
        </button>
      </div>

      {editions.length === 0 ? (
        <p className="text-xs text-slate-500">Not in any event yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--line)]">
          {editions.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2">
              {e.id === id ? (
                <span className="text-sm text-[var(--fg)] font-medium">{e.event || 'No event'} <span className="text-xs text-slate-500 font-normal">· this record</span></span>
              ) : (
                <Link href={`${detail}/${e.id}`} className="text-sm text-slate-300 hover:text-[var(--fg)] hover:underline underline-offset-4">{e.event || 'No event'}</Link>
              )}
              {e.status && <StatusBadge value={e.status} variant="sponsor_status" />}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-4 pt-4 border-t border-[var(--line)]">
          <p className="text-xs text-slate-400 mb-3">
            Each event gets its own record of this company, starting at Not contacted, with its details and contacts copied across.
          </p>
          {available.length === 0 ? (
            <p className="text-xs text-slate-500">It is already in every event.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
              {available.map((ev) => {
                const on = picked.includes(ev)
                return (
                  <button
                    type="button"
                    key={ev}
                    onClick={() => toggle(ev)}
                    aria-pressed={on}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors',
                      on ? 'border-[var(--teal)] text-[var(--fg)] bg-[var(--surface-2)]' : 'border-[var(--line)] text-slate-300 hover:border-slate-500'
                    )}
                  >
                    <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', on ? 'border-[var(--teal)] bg-[var(--teal)]' : 'border-slate-500')}>
                      {on && <Check className="w-3 h-3 text-[var(--bg)]" />}
                    </span>
                    {ev}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={save}
              disabled={!picked.length || saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--teal)] text-[var(--bg)] text-xs font-semibold disabled:opacity-40"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {picked.length ? `Add to ${picked.length} ${picked.length === 1 ? 'event' : 'events'}` : 'Pick events'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setPicked([]) }} className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-[var(--fg)]">Cancel</button>
          </div>
        </div>
      )}
      {message && <p className="text-xs text-slate-400 mt-3">{message}</p>}
    </div>
  )
}
