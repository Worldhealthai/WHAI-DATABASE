'use client'

// Event categorisation for the CRM.
//
// Raw `event` values on records are free-text labels that arrived over time in
// different shapes ("UK Forum", "World Health AI 2026", …). The CRM groups
// them two levels deep:
//   category  — series + city ("World Health AI London", "World Health AI
//               Boston", "World Pharma AI London")
//   year      — the edition within a category (2026, 2027, …)
// A category tab filters on every raw label that belongs to it; a year chip
// narrows to that edition's labels. Records keep their stored strings — all
// grouping happens here.

import { useEffect, useState } from 'react'
import { EVENT_OPTIONS } from '@/types'

export interface EventMeta {
  label: string
  series?: string | null
  city?: string | null
  year?: string | null
}

export interface EventCategory {
  name: string           // "World Health AI London"
  labels: string[]       // every raw label under this category
  years: string[]        // sorted years present (labels without a year excluded)
  labelsByYear: Record<string, string[]>
}

// Preferred display order for the known categories; anything else follows
// alphabetically (e.g. a future "World Pharma AI Boston").
const CATEGORY_ORDER = [
  'World Health AI London',
  'World Health AI Boston',
  'World Pharma AI London',
]

const yearOf = (s: string): string | null => s.match(/\b(20\d{2})\b/)?.[1] ?? null

// Work out which category a raw event label belongs to. Meta (from the Nexus
// events API) supplies the city for labels that don't carry one; legacy CRM
// names map to their known editions (UK Forum = London, US Forum = Boston).
export function categoriseEvent(
  label: string,
  meta?: EventMeta | null
): { category: string; year: string | null } {
  const s = label.toLowerCase()
  const year = meta?.year || yearOf(label)

  if (/\buk\s*forum\b/.test(s)) return { category: 'World Health AI London', year }
  if (/\bus\s*forum\b/.test(s)) return { category: 'World Health AI Boston', year }

  const series = meta?.series?.trim() || (s.includes('pharma') ? 'World Pharma AI' : s.includes('health') ? 'World Health AI' : null)

  let city = meta?.city?.split(',')[0]?.trim() || null
  if (!city) {
    if (s.includes('london')) city = 'London'
    else if (s.includes('boston')) city = 'Boston'
  }

  if (series && city) return { category: `${series} ${city}`, year }
  if (series) return { category: series, year }
  return { category: 'Other events', year }
}

// Group a flat option list into ordered categories.
export function groupEventOptions(options: string[], meta: EventMeta[]): EventCategory[] {
  const metaByLabel = new Map(meta.map((m) => [m.label, m]))
  const map = new Map<string, EventCategory>()
  for (const label of options) {
    const { category, year } = categoriseEvent(label, metaByLabel.get(label))
    const c = map.get(category) || { name: category, labels: [], years: [], labelsByYear: {} }
    if (!c.labels.includes(label)) c.labels.push(label)
    if (year) {
      if (!c.years.includes(year)) c.years.push(year)
      c.labelsByYear[year] = [...(c.labelsByYear[year] || []), label]
    }
    map.set(category, c)
  }
  const list = Array.from(map.values())
  for (const c of list) c.years.sort()
  return list.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.name)
    const bi = CATEGORY_ORDER.indexOf(b.name)
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    if (a.name === 'Other events') return 1
    if (b.name === 'Other events') return -1
    return a.name.localeCompare(b.name)
  })
}

// Human description of a label selection for headings ("World Health AI
// London · 2026"), matching the category/year the tabs would highlight.
export function describeEventSelection(selected: string[], categories: EventCategory[]): string {
  if (!selected.length) return ''
  const same = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ')
  for (const c of categories) {
    if (same(selected, c.labels)) return c.name
    for (const y of c.years) {
      if (same(selected, c.labelsByYear[y])) return `${c.name} · ${y}`
    }
  }
  return selected.length === 1 ? selected[0] : `${selected.length} events`
}

// Categories built from /api/event-options (labels + Nexus event meta), with
// the static base list grouped immediately while the fetch is in flight.
export function useEventCategories(): EventCategory[] {
  const [cats, setCats] = useState<EventCategory[]>(() => groupEventOptions([...EVENT_OPTIONS], []))
  useEffect(() => {
    let alive = true
    fetch('/api/event-options')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !Array.isArray(j?.options) || !j.options.length) return
        const meta: EventMeta[] = Array.isArray(j?.meta) ? j.meta : []
        setCats(groupEventOptions(j.options, meta))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return cats
}
