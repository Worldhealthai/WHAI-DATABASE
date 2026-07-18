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
