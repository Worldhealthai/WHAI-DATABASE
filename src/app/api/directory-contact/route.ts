// POST /api/directory-contact — a new person at a company, for one side of
// the business: { company, sponsorIds, focus: 'Health' | 'Pharma',
// firstName, lastName, jobTitle, email, phone }.
//
// From the Directory, where a company can be in the Health and the Pharma
// events at once: the person is added as a contact of the company's sponsor
// record on that side (its latest event), tagged with the side. With no
// record on that side, the company's latest record of any event takes them,
// still tagged; with no sponsor record at all, the company is added to that
// side's latest event (Not contacted) with them as its contact.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { FOCUSES, focusOfEvent, type Focus } from '@/lib/contactFocus'

export const dynamic = 'force-dynamic'

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const yearOf = (e: string | null) => Number(String(e ?? '').match(/20\d{2}/)?.[0] ?? 0)

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null)
  const company = str(b?.company)
  const focus = FOCUSES.includes(b?.focus) ? (b.focus as Focus) : null
  const firstName = str(b?.firstName), lastName = str(b?.lastName), email = str(b?.email)?.toLowerCase() ?? null
  if (!company || !focus) return NextResponse.json({ error: 'Company and Health or Pharma are needed' }, { status: 400 })
  if (!firstName && !lastName && !email) return NextResponse.json({ error: 'Give a name or an email' }, { status: 400 })
  const ids = (Array.isArray(b?.sponsorIds) ? b.sponsorIds : []).filter((x: unknown): x is string => typeof x === 'string').slice(0, 100)
  try {
    if (email) {
      const { data: dup } = await supabase.from('sponsors').select('id').ilike('contactEmail', email.replace(/[\\%_]/g, '\\$&')).ilike('companyName', company.replace(/[\\%_]/g, '\\$&')).limit(1)
      if (dup?.length) return NextResponse.json({ error: `${email} is already a contact at ${company}` }, { status: 409 })
    }
    // The company's sponsor records: its own side's latest first.
    let rows: { id: string; event: string | null; companyName: string | null; updatedAt: string | null }[] = []
    if (ids.length) {
      const { data, error } = await supabase.from('sponsors').select('id, event, "companyName", "updatedAt"').in('id', ids).is('companyId', null)
      if (error) throw error
      rows = (data ?? []) as typeof rows
    }
    rows.sort((x, y) => Number(focusOfEvent(y.event) === focus) - Number(focusOfEvent(x.event) === focus) || yearOf(y.event) - yearOf(x.event) || String(y.updatedAt).localeCompare(String(x.updatedAt)))
    const contact = { contactFirstName: firstName, contactLastName: lastName, contactEmail: email, contactJobTitle: str(b?.jobTitle), contactPhone: str(b?.phone) }
    let target = rows[0]
    if (!target) {
      // No sponsor record: into the side's latest event, as a new company.
      const { data: evs, error } = await supabase.from('sponsors').select('event').ilike('event', focus === 'Pharma' ? 'World Pharma AI%' : 'World Health AI%').limit(2000)
      if (error) throw error
      const event = Array.from(new Set((evs ?? []).map((e: { event: string | null }) => e.event).filter(Boolean) as string[])).sort((x, y) => yearOf(y) - yearOf(x))[0]
      if (!event) return NextResponse.json({ error: `No ${focus} event to add ${company} to` }, { status: 400 })
      const { data, error: e } = await supabase.from('sponsors')
        .insert({ companyName: company, event, status: 'Not Contacted', tags: `${focus}, Added from Directory`, ...contact })
        .select('id, event').single()
      if (e) throw e
      return NextResponse.json({ ok: true, id: data.id, companyId: data.id, event: data.event, created: 'company' })
    }
    const { data, error } = await supabase.from('sponsors')
      .insert({ companyId: target.id, companyName: target.companyName ?? company, event: target.event, status: 'Active', tags: focus, ...contact })
      .select('id').single()
    if (error) throw error
    return NextResponse.json({ ok: true, id: data.id, companyId: target.id, event: target.event, created: 'contact' })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not add them' }, { status: 500 })
  }
}
