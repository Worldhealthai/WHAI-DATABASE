'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Merge, Loader2, CheckCircle2, AlertTriangle, Users, Mail, Phone, Globe, Activity, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DuplicateRecord {
  id: string
  companyName: string | null
  website: string | null
  contactFirstName: string | null
  contactLastName: string | null
  contactEmail: string | null
  contactPhone: string | null
  contactJobTitle: string | null
  country: string | null
  city: string | null
  tier: string | null
  status: string | null
  event: string | null
  valueAmount: number | null
  notes: string | null
  contactCount: number
  activityCount: number
  hasNotes: boolean
  createdAt: string
}

interface DuplicateGroup {
  key: string
  name: string
  records: DuplicateRecord[]
}

interface Props {
  table: 'sponsors' | 'partners'
  entityLabel?: string
  accent?: AccentName
  onClose: () => void
  onMerged: () => void
}

type AccentName = 'amber' | 'emerald' | 'purple'

const ACCENTS: Record<AccentName, { text: string; bg: string; ring: string; soft: string }> = {
  amber:   { text: 'text-amber-400',   bg: 'bg-amber-500',   ring: 'border-amber-500',   soft: 'bg-amber-500/10' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500', ring: 'border-emerald-500', soft: 'bg-emerald-500/10' },
  purple:  { text: 'text-purple-400',  bg: 'bg-purple-500',  ring: 'border-purple-500',  soft: 'bg-purple-500/10' },
}

const fullName = (r: DuplicateRecord) =>
  [r.contactFirstName, r.contactLastName].filter(Boolean).join(' ') || null

export function DuplicateCompaniesModal({
  table,
  entityLabel = 'sponsor',
  accent = 'amber',
  onClose,
  onMerged,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [keepChoice, setKeepChoice] = useState<Record<string, string>>({})
  const [merging, setMerging] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const { text: accentText, bg: accentBg, ring: accentRing, soft: accentSoft } = ACCENTS[accent]

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/duplicates/companies?table=${table}`)
      if (!res.ok) throw new Error('Failed to load duplicates')
      const json = await res.json()
      setGroups(json.groups ?? [])
      // Pre-select the richest record in each group (the API sorts it first).
      const preset: Record<string, string> = {}
      for (const g of json.groups ?? []) preset[g.key] = g.records[0]?.id
      setKeepChoice(preset)
    } catch {
      setError('Could not load duplicates. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [table])

  useEffect(() => { load() }, [load])

  const mergeGroup = async (group: DuplicateGroup) => {
    const keepId = keepChoice[group.key]
    if (!keepId) return
    setMerging(group.key)
    setError(null)
    try {
      const res = await fetch('/api/duplicates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table,
          keepId,
          mergeIds: group.records.filter((r) => r.id !== keepId).map((r) => r.id),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Merge failed')
      const moved = json.contactsMoved + json.contactsMergedIntoExisting
      setDone((d) => ({
        ...d,
        [group.key]: `Merged into one record · ${moved} contact${moved === 1 ? '' : 's'} kept${
          json.fieldsFilled?.length ? ` · ${json.fieldsFilled.length} field${json.fieldsFilled.length === 1 ? '' : 's'} filled in` : ''
        }`,
      }))
      onMerged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed')
    } finally {
      setMerging(null)
    }
  }

  const pending = groups.filter((g) => !done[g.key])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl bg-[var(--bg)] border border-[var(--line)] shadow-2xl">
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-[var(--line)]">
          <div>
            <h2 className="text-base font-bold text-[var(--fg)] flex items-center gap-2">
              <Merge className={cn('w-4 h-4', accentText)} /> Duplicate companies
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Records sharing a company name. Choose which one to keep — its contacts, history and any
              missing details are taken from the others before they are removed.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-[var(--fg)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" />
              Scanning your {entityLabel}s for duplicates…
            </div>
          ) : groups.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-[var(--fg)] font-medium">No duplicates found</p>
              <p className="text-xs text-slate-500 mt-1">Every company in your {entityLabel} list is unique.</p>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <p className="text-xs text-slate-500">
                  {pending.length} {pending.length === 1 ? 'company appears' : 'companies appear'} more than once.
                </p>
              )}

              {groups.map((group) => {
                const finished = done[group.key]
                const keepId = keepChoice[group.key]
                return (
                  <div
                    key={group.key}
                    className={cn(
                      'rounded-lg border overflow-hidden',
                      finished ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[var(--line)] bg-[var(--surface)]'
                    )}
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--line)]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-[var(--fg)] truncate">{group.name}</span>
                        <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-slate-400">
                          {group.records.length} records
                        </span>
                      </div>
                      {finished ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {finished}
                        </span>
                      ) : (
                        <button
                          onClick={() => mergeGroup(group)}
                          disabled={merging === group.key || !keepId}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--on-accent)] transition-colors disabled:opacity-50',
                            accentBg
                          )}
                        >
                          {merging === group.key ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Merging…</>
                          ) : (
                            <><Merge className="w-3.5 h-3.5" /> Merge {group.records.length} into 1</>
                          )}
                        </button>
                      )}
                    </div>

                    {!finished && (
                      <div className="divide-y divide-[var(--line)]">
                        {group.records.map((r, i) => {
                          const keeping = keepId === r.id
                          // The API returns the most-progressed record first.
                          const recommended = i === 0
                          const worked = (r.status && r.status !== 'Not Contacted') || r.activityCount > 0 || r.hasNotes
                          return (
                            <label
                              key={r.id}
                              className={cn(
                                'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                                keeping ? accentSoft : 'hover:bg-[var(--surface-2)]'
                              )}
                            >
                              <input
                                type="radio"
                                name={`keep-${group.key}`}
                                checked={keeping}
                                onChange={() => setKeepChoice((k) => ({ ...k, [group.key]: r.id }))}
                                className="mt-1 accent-amber-500"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-[var(--fg)]">
                                    {fullName(r) ?? <span className="text-slate-500 italic">No contact name</span>}
                                  </span>
                                  {r.contactJobTitle && (
                                    <span className="text-xs text-slate-500">{r.contactJobTitle}</span>
                                  )}
                                  <span
                                    className={cn(
                                      'text-[11px] px-1.5 py-0.5 rounded border',
                                      keeping
                                        ? `${accentRing} ${accentText}`
                                        : 'border-slate-600 text-slate-400'
                                    )}
                                  >
                                    {keeping ? 'Keeping this one' : 'Will be merged in'}
                                  </span>
                                  {recommended && worked && (
                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                      Most progress
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[11px] text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" /> {r.contactCount} contact{r.contactCount === 1 ? '' : 's'}
                                  </span>
                                  {r.contactEmail && (
                                    <span className="flex items-center gap-1 truncate max-w-[220px]">
                                      <Mail className="w-3 h-3" /> {r.contactEmail}
                                    </span>
                                  )}
                                  {r.contactPhone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3 h-3" /> {r.contactPhone}
                                    </span>
                                  )}
                                  {r.website && (
                                    <span className="flex items-center gap-1 truncate max-w-[180px]">
                                      <Globe className="w-3 h-3" /> {r.website}
                                    </span>
                                  )}
                                  {r.activityCount > 0 && (
                                    <span className="flex items-center gap-1 text-emerald-400">
                                      <Activity className="w-3 h-3" /> {r.activityCount} update{r.activityCount === 1 ? '' : 's'}
                                    </span>
                                  )}
                                  {r.hasNotes && (
                                    <span className="flex items-center gap-1 text-emerald-400">
                                      <StickyNote className="w-3 h-3" /> Has notes
                                    </span>
                                  )}
                                  {r.status && (
                                    <span className={r.status === 'Not Contacted' ? 'text-slate-500' : 'text-slate-200 font-medium'}>
                                      {r.status}
                                    </span>
                                  )}
                                  {r.event && <span className={accentText}>{r.event}</span>}
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-[var(--line)]">
          <p className="text-[11px] text-slate-500">
            Nothing is lost: contacts, notes, tags and activity history all move to the record you keep.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-[var(--fg)] border border-[var(--line)] hover:border-slate-500 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
