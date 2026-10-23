'use client'

import { useEffect, useState } from 'react'
import { EVENT_OPTIONS } from '@/types'

// Event tabs/dropdowns render the static base list immediately, then extend
// with whatever /api/event-options discovers: labels already in the data
// plus events configured on worldnexusgroup.com.
export function useEventOptions(): string[] {
  const [options, setOptions] = useState<string[]>([...EVENT_OPTIONS])
  useEffect(() => {
    let alive = true
    fetch('/api/event-options')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && Array.isArray(j?.options) && j.options.length) setOptions(j.options)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return options
}

// The events still to come, for offering a company or person a place in
// one: /api/event-options names the ones whose day has passed. Until it
// answers, the base list is offered as it is.
export function useUpcomingEventOptions(): string[] {
  const [state, setState] = useState<{ options: string[]; past: string[] }>({ options: [...EVENT_OPTIONS], past: [] })
  useEffect(() => {
    let alive = true
    fetch('/api/event-options')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && Array.isArray(j?.options) && j.options.length) {
          setState({ options: j.options, past: Array.isArray(j.past) ? j.past : [] })
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const past = new Set(state.past.map((p) => p.toLowerCase()))
  // An edition from an earlier year is past even before the list answers.
  const thisYear = new Date().getFullYear()
  const earlier = (o: string) => Number(o.match(/\b(20\d{2})\b/)?.[1] || thisYear) < thisYear
  return state.options.filter((o) => !past.has(o.toLowerCase()) && !earlier(o))
}
