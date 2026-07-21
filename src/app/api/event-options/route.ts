// GET /api/event-options — the event labels the UI should offer as
// tabs/columns/dropdowns. Union of:
//   1. the static base list (legacy UK/US Forum),
//   2. every distinct event label already present in the data,
//   3. events configured on worldnexusgroup.com (so a new event gets its
//      column before its first booking arrives).
// Best-effort on every source — the base list always ships.
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { EVENT_OPTIONS } from '@/types'

export const dynamic = 'force-dynamic'

const NEXUS_EVENTS_URL =
  process.env.NEXUS_EVENTS_URL || 'https://www.worldnexusgroup.com/api/public-events'

export async function GET() {
  const options: string[] = [...EVENT_OPTIONS]
  const add = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : ''
    if (s && !options.includes(s)) options.push(s)
  }
  // Structured info per label (series/city/year) from the Nexus events list —
  // lets the UI group labels into series+city categories with year sub-tabs
  // even when the label itself doesn't carry the city.
  const meta: { label: string; series: string | null; city: string | null; year: string | null }[] = []

  try {
    const [d, s, sp] = await Promise.all([
      supabase.from('delegates').select('event').not('event', 'is', null),
      supabase.from('speakers').select('event').not('event', 'is', null),
      supabase.from('sponsors').select('event').not('event', 'is', null),
    ])
    for (const rows of [d.data, s.data, sp.data]) {
      for (const r of rows ?? []) add((r as { event?: string }).event)
    }
  } catch {
    // data unreachable — continue with base + remote
  }

  try {
    const res = await fetch(NEXUS_EVENTS_URL, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 300 },
    })
    if (res.ok) {
      const j = await res.json()
      for (const ev of j?.events ?? []) {
        add(ev?.label)
        if (typeof ev?.label === 'string' && ev.label.trim()) {
          meta.push({
            label: ev.label.trim(),
            series: typeof ev?.series === 'string' ? ev.series : null,
            city: typeof ev?.city === 'string' ? ev.city : null,
            year: String(ev?.date ?? ev?.label ?? '').match(/\b(20\d{2})\b/)?.[1] ?? null,
          })
        }
      }
    }
  } catch {
    // Nexus unreachable — data-derived list still covers active events
  }

  return NextResponse.json({ options, meta })
}
