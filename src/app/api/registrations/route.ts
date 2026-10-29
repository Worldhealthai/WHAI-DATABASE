// GET /api/registrations?events=<label>&events=… — the edition's bookings
// as the Nexus admin panel holds them (its registrations table, in the same
// database), each with the CRM record it is filed as. Read only: approving,
// rejecting and editing stay in the admin panel, which syncs here.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { canonicalEventLabel } from '@/types'
import { nexusBase } from '@/lib/nexusSync'

export const dynamic = 'force-dynamic'

const COLS = [
  'id', 'first_name', 'last_name', 'email', 'company', 'job_position', 'status', 'attendee_type', 'inquiry_type',
  'payment_status', 'amount_paid', 'currency', 'ticket_name', 'promo_code', 'source_site', 'invite_status',
  'event_series', 'event_label', 'event_location', 'event_date', 'synced_to_crm', 'created_at', 'reviewed_at',
].join(', ')

const CITIES = ['London', 'Boston', 'New York', 'Dubai', 'Singapore', 'Paris', 'Berlin', 'Amsterdam']

// The edition as the CRM names it, the way the admin panel's sync builds it:
// series, city and year, else the stored label.
function editionOf(r: Record<string, any>): string | null {
  const year = Number(String(r.event_date || '').match(/\b(20\d{2})\b/)?.[1]) || null
  const loc = String(r.event_location || '').trim()
  const city = CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(loc)) ?? (loc.split(',')[0] || '').trim()
  const series = String(r.event_series || '').trim()
  return canonicalEventLabel(series && city && year ? `${series} ${city} ${year}` : r.event_label, year)
}

export async function GET(req: NextRequest) {
  const events = req.nextUrl.searchParams.getAll('events').map((e) => e.trim()).filter(Boolean)
  if (!events.length) return NextResponse.json({ data: [], admin: `${nexusBase()}/admin/registrations` })
  const wanted = new Set(events.map((e) => (canonicalEventLabel(e) ?? e).toLowerCase()))
  const years = Array.from(new Set(events.map((e) => e.match(/\b(20\d{2})\b/)?.[1]).filter(Boolean))) as string[]
  try {
    // The editions' years narrow the read; the label decides.
    const rows: Record<string, any>[] = []
    for (let from = 0; ; from += 1000) {
      let q = supabase.schema('public').from('registrations').select(COLS)
      if (years.length) q = q.or(years.map((y) => `event_date.ilike.%${y}%`).join(','))
      const { data, error } = await q.order('created_at', { ascending: false }).range(from, from + 999)
      if (error) throw error
      rows.push(...((data ?? []) as unknown as Record<string, any>[]))
      if (!data || data.length < 1000 || rows.length >= 10000) break
    }
    const mine = rows.filter((r) => wanted.has((editionOf(r) ?? '').toLowerCase()))

    // The CRM record each booking is filed as, by email within the edition.
    const filed = new Map<string, { kind: 'speaker' | 'delegate'; id: string; status: string | null }>()
    for (const [kind, table] of [['speaker', 'speakers'], ['delegate', 'delegates']] as const) {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from(table).select('id, email, status').in('event', events).range(from, from + 999)
        if (error) throw error
        for (const r of data ?? []) {
          const e = String(r.email || '').trim().toLowerCase()
          if (e && !filed.has(`${kind}:${e}`)) filed.set(`${kind}:${e}`, { kind, id: r.id, status: r.status ?? null })
        }
        if (!data || data.length < 1000) break
      }
    }
    const data = mine.map((r) => {
      const e = String(r.email || '').trim().toLowerCase()
      const speaker = /^speaker/.test(String(r.attendee_type || ''))
      const crm = e ? filed.get(`${speaker ? 'speaker' : 'delegate'}:${e}`) ?? filed.get(`${speaker ? 'delegate' : 'speaker'}:${e}`) ?? null : null
      return { ...r, edition: editionOf(r), crm }
    })
    return NextResponse.json({ data, admin: `${nexusBase()}/admin/registrations` })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 })
  }
}
