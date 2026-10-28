// POST /api/events/import — scraped contacts into one edition (the import
// dialog on an event's Sponsors and Speakers pages, lib/eventImport).
// Body: { kind: 'sponsor' | 'speaker', event: "World Pharma AI London 2027",
//         rows: [{ company, name, jobTitle, email, phone }] }
//
// Sponsors: one company per name, as Not Contacted, the first person its
// contact and the others its contacts. A company already in the edition
// keeps its stage and gains only the people it hasn't got.
// Speakers: one Not Contacted speaker per person; anyone whose email is
// already a speaker in the edition is skipped.
// Every row filed is tagged "Imported". Answers with what was added and
// what was skipped, and why.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { canonicalEventLabel } from '@/types'
import { looksLikeEmail, splitName, type ImportRow } from '@/lib/eventImport'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 5000
const TAG = 'Imported'

type Person = { contactFirstName?: string | null; contactLastName?: string | null; contactEmail?: string | null }
const personKey = (p: Person) => {
  const email = (p.contactEmail || '').trim().toLowerCase()
  if (email) return `e:${email}`
  const name = `${(p.contactFirstName || '').trim()} ${(p.contactLastName || '').trim()}`.trim().toLowerCase()
  return name ? `n:${name}` : ''
}

function clean(raw: unknown): ImportRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const s = (k: string) => String(r[k] ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
  const email = s('email').toLowerCase()
  return { company: s('company'), name: s('name'), jobTitle: s('jobTitle'), email: looksLikeEmail(email) ? email : '', phone: s('phone') }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const kind = body?.kind === 'speaker' ? 'speaker' : body?.kind === 'sponsor' ? 'sponsor' : null
    const event = canonicalEventLabel(String(body?.event || ''))
    if (!kind) return NextResponse.json({ error: 'Choose sponsors or speakers.' }, { status: 400 })
    if (!event) return NextResponse.json({ error: 'No event to import into.' }, { status: 400 })
    if (!Array.isArray(body?.rows) || !body.rows.length) return NextResponse.json({ error: 'No rows to import.' }, { status: 400 })
    if (body.rows.length > MAX_ROWS) return NextResponse.json({ error: `Up to ${MAX_ROWS} rows at a time.` }, { status: 400 })
    const rows = (body.rows as unknown[]).map(clean).filter((r): r is ImportRow => !!r && Boolean(r.company || r.name || r.email))
    return kind === 'sponsor' ? await importSponsors(rows, event) : await importSpeakers(rows, event)
  } catch (error: any) {
    console.error('event import error:', error)
    return NextResponse.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 })
  }
}

async function importSpeakers(rows: ImportRow[], event: string) {
  const year = Number(event.match(/\b(20\d{2})\b/)?.[1]) || null
  const { data: existing, error } = await supabase.from('speakers').select('email').eq('event', event).not('email', 'is', null)
  if (error) throw error
  const have = new Set((existing ?? []).map((r: { email: string | null }) => (r.email || '').toLowerCase()).filter(Boolean))
  let already = 0
  let noName = 0
  const records: Record<string, unknown>[] = []
  for (const r of rows) {
    if (!r.name && !r.email) { noName++; continue }
    if (r.email && have.has(r.email)) { already++; continue }
    if (r.email) have.add(r.email)
    const { firstName, lastName } = splitName(r.name, r.email)
    records.push({
      firstName, lastName, email: r.email || null, phone: r.phone || null, organization: r.company || null,
      jobTitle: r.jobTitle || null, event, year, status: 'Not Contacted', tags: TAG,
    })
  }
  let added = 0
  for (let i = 0; i < records.length; i += 200) {
    const chunk = records.slice(i, i + 200)
    const { error: insertErr } = await supabase.from('speakers').insert(chunk)
    if (!insertErr) { added += chunk.length; continue }
    // One clash (someone added meanwhile) fails the chunk: file it row by row.
    for (const rec of chunk) {
      const { error: oneErr } = await supabase.from('speakers').insert(rec)
      if (oneErr) already++
      else added++
    }
  }
  return NextResponse.json({ ok: true, event, added, skipped: { already, noName } })
}

async function importSponsors(rows: ImportRow[], event: string) {
  // The file's companies, by name, each with its people in order.
  const groups = new Map<string, { name: string; people: ImportRow[] }>()
  let noCompany = 0
  for (const r of rows) {
    if (!r.company) { noCompany++; continue }
    const key = r.company.toLowerCase()
    if (!groups.has(key)) groups.set(key, { name: r.company, people: [] })
    groups.get(key)!.people.push(r)
  }

  // The companies already in this edition, and their contacts.
  const { data: companies, error } = await supabase
    .from('sponsors')
    .select('id, companyName, contactFirstName, contactLastName, contactEmail')
    .is('companyId', null)
    .eq('event', event)
  if (error) throw error
  const byName = new Map<string, { id: string; companyName: string } & Person>()
  for (const c of companies ?? []) byName.set(String(c.companyName || '').trim().toLowerCase(), c)
  const known = new Map<string, Set<string>>() // company id → people's keys
  for (const c of byName.values()) known.set(c.id, new Set([personKey(c)].filter(Boolean)))
  const ids = [...known.keys()]
  for (let i = 0; i < ids.length; i += 200) {
    const { data: contacts, error: cErr } = await supabase
      .from('sponsors')
      .select('companyId, contactFirstName, contactLastName, contactEmail')
      .in('companyId', ids.slice(i, i + 200))
    if (cErr) throw cErr
    for (const c of contacts ?? []) {
      const k = personKey(c)
      if (k && c.companyId) known.get(c.companyId)?.add(k)
    }
  }

  let companiesAdded = 0
  let contactsAdded = 0
  let already = 0
  const person = (r: ImportRow) => {
    const { firstName, lastName } = splitName(r.name, r.email)
    return {
      contactFirstName: r.name ? firstName : null,
      contactLastName: r.name ? lastName || null : null,
      contactEmail: r.email || null,
      contactPhone: r.phone || null,
      contactJobTitle: r.jobTitle || null,
    }
  }

  for (const [key, group] of groups) {
    let company = byName.get(key)
    let keys = company ? known.get(company.id)! : new Set<string>()
    const people = group.people.filter((r) => r.name || r.email)
    if (!company) {
      const first = people.shift()
      const { data: made, error: insertErr } = await supabase
        .from('sponsors')
        .insert({ companyName: group.name, event, status: 'Not Contacted', tier: null, tags: TAG, ...(first ? person(first) : {}) })
        .select('id, companyName, contactFirstName, contactLastName, contactEmail')
        .single()
      if (insertErr || !made) throw insertErr ?? new Error(`Could not add ${group.name}`)
      company = made
      keys = new Set([personKey(made)].filter(Boolean))
      companiesAdded++
      if (first) contactsAdded++
    }
    const newPeople: Record<string, unknown>[] = []
    for (const r of people) {
      const p = person(r)
      const k = personKey(p)
      if (k && keys.has(k)) { already++; continue }
      if (k) keys.add(k)
      newPeople.push({ companyId: company!.id, companyName: company!.companyName || group.name, event, status: 'Not Contacted', tags: TAG, ...p })
    }
    // A company in the edition with nobody on it takes the first as its contact.
    if (newPeople.length && !personKey(company!)) {
      const { companyId: _c, companyName: _n, event: _e, status: _s, tags: _t, ...fields } = newPeople.shift()!
      const { error: upErr } = await supabase.from('sponsors').update(fields).eq('id', company!.id)
      if (upErr) throw upErr
      contactsAdded++
    }
    if (newPeople.length) {
      const { error: peopleErr } = await supabase.from('sponsors').insert(newPeople)
      if (peopleErr) throw peopleErr
      contactsAdded += newPeople.length
    }
  }
  return NextResponse.json({ ok: true, event, companiesAdded, contactsAdded, skipped: { already, noCompany } })
}
