'use client'

// The events a speaker or delegate is in, for their form: one tile per
// event, clicked on or off (EventPicker), like a company's. Each event is a
// record of its own (lib/personEditions). Adding: the first event picked is
// this record's, each other gets a record of its own. Editing: it starts as
// the events the person is in now; ticking one adds them to it, unticking
// one takes them out of it.

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { EventPicker } from '@/components/crm/EventPicker'
import { KINDS } from '@/lib/recordKinds'
import { useEventOptions, useUpcomingEventOptions } from '@/lib/useEventOptions'

type Kind = 'speaker' | 'delegate'
const lc = (s: string) => s.toLowerCase()

export const yearOfEvent = (event: string | null | undefined) => Number(String(event ?? '').match(/\b(20\d{2})\b/)?.[1]) || null

export function usePersonEvents(kind: Kind, record: { id?: string; event?: string | null } | undefined) {
  const api = KINDS[kind].api
  const isEdit = !!record?.id
  const router = useRouter()
  const queryClient = useQueryClient()
  const [picked, setPicked] = useState<string[]>(!isEdit && record?.event ? [record.event] : [])
  const [ready, setReady] = useState(!isEdit)
  const toggle = (ev: string) => setPicked((p) => (p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev]))
  const { data } = useQuery<{ name: string; editions: { id: string; event: string | null }[] }>({
    queryKey: ['company-events', kind, record?.id],
    queryFn: async () => {
      const r = await fetch(`${api}/${record!.id}/editions`)
      if (!r.ok) throw new Error('editions')
      return r.json()
    },
    enabled: isEdit,
  })
  const existing = Array.from(new Set((data?.editions ?? []).map((e) => String(e.event ?? '')).filter(Boolean)))
  useEffect(() => {
    if (!isEdit || ready || !data) return
    setPicked(existing)
    setReady(true)
  }, [isEdit, ready, data, existing])
  // Only events still to come are offered (and, adding from a past
  // edition's page, that edition too).
  const upcoming = useUpcomingEventOptions()
  const options = !isEdit && record?.event && !upcoming.includes(record.event) ? [record.event, ...upcoming] : upcoming

  // What saving will do, given the event this record is filed under.
  const plan = (current: string) => {
    const main = isEdit ? current : picked[0] || ''
    const add = isEdit ? picked.filter((ev) => !existing.some((x) => lc(x) === lc(ev))) : picked.slice(1).filter((ev) => ev !== main)
    const remove = isEdit && ready ? existing.filter((ev) => !picked.some((x) => lc(x) === lc(ev))) : []
    const removingThis = !!current && remove.some((ev) => lc(ev) === lc(current))
    const emptied = isEdit && existing.length > 0 && picked.length === 0
    return { main, add, remove, removingThis, emptied }
  }

  // After this record is saved: the other events' records are made, the
  // unticked ones go. Returns false when the page was left (this record
  // itself was taken out of its event).
  const apply = async (savedId: string | undefined, p: ReturnType<typeof plan>, status?: string | null) => {
    if (savedId && p.add.length) {
      const more = await fetch(`${api}/${savedId}/editions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: p.add, status: isEdit ? null : status }),
      })
      if (!more.ok) {
        const d = await more.json().catch(() => null)
        throw new Error(`Saved, but not added to the other events: ${d?.error || 'please try again from their page'}.`)
      }
    }
    let goTo: string | null = null
    if (p.remove.length && record?.id) {
      const out = await fetch(`${api}/${record.id}/editions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: p.remove }),
      })
      const d = await out.json().catch(() => null)
      if (!out.ok) throw new Error(`Not taken out of ${p.remove.join(', ')}: ${d?.error || 'please try again'}.`)
      if (p.removingThis) {
        const next = (d?.remaining ?? [])[0]
        goTo = next ? `${KINDS[kind].detailPath}/${next.id}` : KINDS[kind].detailPath
      }
    }
    if (p.add.length || p.remove.length) {
      for (const key of ['company-events', 'ws-list', 'ws-board', 'ws-stats']) queryClient.invalidateQueries({ queryKey: [key] })
    }
    if (goTo) { router.push(goTo); return false }
    return true
  }

  return { isEdit, picked, toggle, existing, options, ready, plan, apply }
}

// The Events section of the form.
export function PersonEventsField({ kind, events, current, onMove, inputCls }: {
  kind: Kind
  events: ReturnType<typeof usePersonEvents>
  current: string
  onMove: (event: string) => void
  inputCls: string
}) {
  const all = useEventOptions()
  const [moving, setMoving] = useState(false)
  const { isEdit, picked, toggle, existing, options } = events
  const stage = KINDS[kind].stages[0].label
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs font-medium text-slate-400">Events</label>
        {picked.length > 0 && (
          <span className="text-[11.5px]" style={{ color: 'var(--fg-3)' }}>
            {picked.length} {picked.length === 1 ? 'event' : 'events'}
          </span>
        )}
      </div>
      <p className="text-[11.5px]" style={{ color: 'var(--fg-4)' }}>
        {isEdit
          ? `Tick to add them to an event (their details are copied, starting at ${stage}); untick to take them out. Each event keeps its own stage.`
          : 'Pick one or more events and years. Each event keeps its own stage.'}
      </p>
      <EventPicker options={options} selected={picked} onToggle={toggle} existing={isEdit ? existing : []} current={isEdit ? current || null : null} />
      {isEdit && (
        moving ? (
          <div className="flex items-center gap-2 pt-1">
            <select value={current} onChange={(e) => onMove(e.target.value)} className={inputCls}>
              <option value="">No event</option>
              {(current && !all.includes(current) ? [current, ...all] : all).map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <button type="button" onClick={() => setMoving(false)} className="text-xs whitespace-nowrap" style={{ color: 'var(--fg-3)' }}>Done</button>
          </div>
        ) : (
          <button type="button" onClick={() => setMoving(true)} className="text-[11.5px] hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
            Move this record to a different event
          </button>
        )
      )}
    </div>
  )
}

// Confirm taking the person out of events; false when they say no, or
// when nothing would be left (the form shows `blocked` instead).
export function confirmRemoval(name: string, p: { remove: string[]; emptied: boolean }): { ok: boolean; blocked?: string } {
  if (p.emptied) return { ok: false, blocked: `Keep ${name || 'them'} in at least one event, or use Delete to remove the record.` }
  if (!p.remove.length) return { ok: true }
  return {
    ok: window.confirm(
      `Take ${name || 'this person'} out of ${p.remove.join(', ')}?\n\nTheir stage, notes and activity for ${p.remove.length === 1 ? 'that event' : 'those events'} will be deleted. This can't be undone.`
    ),
  }
}
