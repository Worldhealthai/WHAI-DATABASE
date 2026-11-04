// POST /api/companies { name, segment, event, website?, country?, notes?,
// contact?: { firstName, lastName, jobTitle, email, phone } } — a new
// company in the CRM, from the Companies tab or the Directory (November
// 2026). It is not put on any pipeline: it is kept as a leads-list record
// (crm.leads) for the edition, so it shows in Companies, Contacts and the
// Directory with its own profile, and is moved into Sales or Production from
// there. A company already in the CRM is not added twice.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { companyKey } from '@/lib/segments'

export const dynamic = 'force-dynamic'

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const esc = (s: string) => s.replace(/[\\%_]/g, '\\$&')
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null)
  const name = str(b?.name)
  const event = str(b?.event)
  const segment = b?.segment === 'Solution Provider' || b?.segment === 'End User' ? b.segment : null
  if (!name) return NextResponse.json({ error: 'Give the company a name' }, { status: 400 })
  if (!segment) return NextResponse.json({ error: 'Choose Solution Provider or End User' }, { status: 400 })
  if (!event) return NextResponse.json({ error: 'Open an event first' }, { status: 400 })
  const key = companyKey(name)
  if (!key) return NextResponse.json({ error: 'That name has no letters or numbers' }, { status: 400 })
  const c = b?.contact ?? {}
  const email = str(c.email)?.toLowerCase() ?? null
  if (email && !EMAIL.test(email)) return NextResponse.json({ error: `${email} is not an email address` }, { status: 400 })

  try {
    // Already in the CRM under this name (any spelling the CRM treats as the same)?
    const first = name.split(/\s+/)[0]
    for (const [table, col] of [['sponsors', 'companyName'], ['leads', 'companyName'], ['partners', 'companyName'], ['speakers', 'organization'], ['delegates', 'organization']] as const) {
      const { data, error } = await supabase.from(table).select(col).ilike(col, `${esc(first)}%`).limit(200)
      if (error) throw error
      const hit = (data ?? []).map((r) => (r as Record<string, string | null>)[col]).find((n) => companyKey(n) === key)
      if (hit) return NextResponse.json({ error: `${hit} is already in the CRM`, existing: { key, name: hit } }, { status: 409 })
    }
    let website = str(b?.website)
    if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`
    const { error } = await supabase.from('leads').insert({
      companyName: name, segment, event, website, country: str(b?.country),
      firstName: str(c.firstName), lastName: str(c.lastName), jobTitle: str(c.jobTitle), email, phone: str(c.phone),
      source: 'Added in the CRM', notes: str(b?.notes),
    })
    if (error) throw error
    return NextResponse.json({ ok: true, key, name }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not add the company' }, { status: 500 })
  }
}
