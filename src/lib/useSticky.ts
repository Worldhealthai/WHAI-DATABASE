'use client'

// State that outlives the page for the rest of the tab's session
// (sessionStorage): a list's search, filters and page come back as they were
// when Back returns to it from a profile. Read after mount, so the first
// render matches the server's.
import { useEffect, useState } from 'react'

export function useSticky<T>(key: string, initial: T): [T, (v: T | ((x: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial)
  // Saving starts only once what was saved has been read back: in the same
  // render as the restored value, never before it.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`crm.sticky.${key}`)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring what was saved, once, after mount
      if (raw) setValue(JSON.parse(raw) as T)
    } catch { /* storage unavailable */ }
    setReady(true)
  }, [key])
  useEffect(() => {
    if (!ready) return
    try { sessionStorage.setItem(`crm.sticky.${key}`, JSON.stringify(value)) } catch { /* storage unavailable */ }
  }, [key, value, ready])
  return [value, setValue]
}
