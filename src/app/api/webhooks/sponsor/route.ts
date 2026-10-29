import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { canonicalEventLabel } from '@/types'
import { companySimilarity } from '@/lib/companyMatch'

export const dynamic = 'force-dynamic'

// Sponsor onboarding webhook.
// The Nexus admin posts here when a sponsor's onboarding form is approved
// and published to an event. The company lands in this edition's sponsors
// (the row the Marketing portal reads), with the LinkedIn posts its package
// includes. An existing row for the same company and edition is updated,
// otherwise one is created as Confirmed. The onboarding contact never
// overwrites a different person's details: when the company already has
// another primary contact, it is filed as one of the company's contacts.
//
// With "lead": true it files a sales lead instead: a delegate booking the
// Nexus admin rejected because the person sells to the audience (a solution
// provider). The company is added to this edition's sponsors as Not
// Contacted, with the person as its contact (job title and phone included);
// a company already there keeps its stage and gains the person as a
// contact if they are new to it. Nothing is marked confirmed or onboarded.
//
// POST /api/webhooks/sponsor
// Headers: x-webhook-secret: <WEBHOOK_SECRET env var>
// Body: {
//   "companyName": "Acme Health", "tier": "Gold Sponsor",
//   "event": "World Health AI · London · 2026", "year": 2026,
//   "contactFirstName": "…", "contactLastName": "…", "contactEmail": "…",
//   "logoUrl": "…", "bio": "…",
//   "linkedinPostsDue": 2, "onboardedAt": "2026-09-19T…",
//   "source": "worldnexusgroup.com sponsor onboarding"
// }
// Optional, on an onboarding: "speaker": { "firstName", "lastName", "email",
//   "jobTitle" } — the person the sponsor's form nominated for its speaking
//   slot, added as one of the company's contacts (tag "Sponsor speaker")
//   unless they are on it already. Their speaker record comes from the
//   register webhook.
// A lead: { "lead": true, "companyName", "event", "year", "contactFirstName",
//   "contactLastName", "contactEmail", "contactPhone", "contactJobTitle",
//   "source" }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const MATCH_THRESHOLD = 0.9

type Row = {
  id: string
  companyName: string | null
  contactFirstName: string | null
  contactLastName: string | null
  contactEmail: string | null
  event: string | null
  notes: string | null
  linkedinPostsDue?: number | null
}

// One person's contact fields, as on a sponsors row.
type Person = { contactFirstName?: unknown; contactLastName?: unknown; contactEmail?: unknown }
const emailKey = (p: Person) => String(p.contactEmail ?? '').trim().toLowerCase()
const nameKey = (p: Person) => {
  const k = `${String(p.contactFirstName ?? '').trim().toLowerCase()}|${String(p.contactLastName ?? '').trim().toLowerCase()}`
  return k === '|' ? '' : k
}
const hasPerson = (p: Person) => Boolean(emailKey(p) || nameKey(p))
// The same person: by email when both have one, otherwise by first and last
// name (the rule the bulk import uses for a company's contacts).
function samePerson(a: Person, b: Person): boolean {
  const e1 = emailKey(a)
  const e2 = emailKey(b)
  if (e1 && e2) return e1 === e2
  const n1 = nameKey(a)
  return Boolean(n1) && n1 === nameKey(b)
}

// The sponsor's speaker, as one of the company's contacts (the company row
// itself when that is them). Best-effort: the onboarding is already filed.
async function addSpeakerContact(raw: unknown, company: { id: string; companyName: string; event: string }) {
  if (!raw || typeof raw !== 'object') return
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const person = {
    contactFirstName: str(r.firstName),
    contactLastName: str(r.lastName),
    contactEmail: str(r.email)?.toLowerCase() ?? null,
    contactJobTitle: str(r.jobTitle),
  }
  if (!hasPerson(person)) return
  const { data: rows, error } = await supabase
    .from('sponsors')
    .select('id, contactFirstName, contactLastName, contactEmail')
    .or(`id.eq.${company.id},companyId.eq.${company.id}`)
  if (error) { console.warn('sponsor webhook: speaker contact lookup failed:', error.message); return }
  if (((rows || []) as Person[]).some((c) => samePerson(c, person))) return
  const { error: insErr } = await supabase.from('sponsors').insert({
    companyId: company.id, companyName: company.companyName, event: company.event, status: 'Confirmed', tags: 'Sponsor speaker', ...person,
  })
  if (insErr) console.warn('sponsor webhook: speaker contact not added:', insErr.message)
}

// Nexus writes editions as "World Health AI · London · 2026"; the CRM stores
// "World Health AI London 2026".
function editionLabel(raw: string, year: number | null): string | null {
  const flat = raw.replace(/\s*[·•—-]\s*/g, ' ').replace(/\s+/g, ' ').trim()
  return canonicalEventLabel(flat, year)
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.WEBHOOK_SECRET?.trim()
    if (secret && req.headers.get('x-webhook-secret')?.trim() !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const body = await req.json().catch(() => ({}))
    const companyName = String(body?.companyName || '').trim()
    if (!companyName) return NextResponse.json({ error: 'companyName is required' }, { status: 400, headers: CORS_HEADERS })

    const year = Number.isInteger(body?.year) ? body.year : null
    const event = body?.event ? editionLabel(String(body.event), year) : null
    if (!event) return NextResponse.json({ error: 'event is required' }, { status: 400, headers: CORS_HEADERS })

    const email = String(body?.contactEmail || '').trim().toLowerCase() || null
    const due = Number.isInteger(body?.linkedinPostsDue) ? Math.max(0, body.linkedinPostsDue) : null
    const source = String(body?.source || 'sponsor onboarding').slice(0, 120)

    // The company's row for this edition, matched on the name (fuzzy) or the
    // contact email. Company rows only — contact rows carry a companyId.
    const { data: rows, error: readErr } = await supabase
      .from('sponsors')
      .select('id, companyName, contactFirstName, contactLastName, contactEmail, event, notes')
      .is('companyId', null)
      .eq('event', event)
    if (readErr) throw readErr
    let best: { row: Row; score: number } | null = null
    for (const row of (rows || []) as Row[]) {
      let score = row.companyName ? companySimilarity(companyName, row.companyName) : 0
      if (email && (row.contactEmail || '').trim().toLowerCase() === email) score = Math.max(score, 1)
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { row, score }
    }

    if (body?.lead === true) return await fileLead(body, companyName, event, email, best?.row ?? null)

    const marketing: Record<string, unknown> = {
      linkedinPostsDue: due,
      onboardedAt: body?.onboardedAt || new Date().toISOString(),
      logoUrl: body?.logoUrl || null,
    }
    const contact: Record<string, unknown> = {}
    if (body?.contactFirstName) contact.contactFirstName = String(body.contactFirstName)
    if (body?.contactLastName) contact.contactLastName = String(body.contactLastName)
    if (email) contact.contactEmail = email
    const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const onboardingNote = `[Onboarded · ${source} · ${stamp}]${body?.bio ? `\n${String(body.bio).trim()}` : ''}`

    // Before migration 005 the marketing columns do not exist: keep the
    // sponsor itself, drop only those fields.
    const missingColumn = (err: { message?: string } | null) => Boolean(err?.message && /linkedinPostsDue|onboardedAt|logoUrl/.test(err.message))

    if (best) {
      const company = best.row
      // Where the onboarding contact goes. The company row's contact fields
      // are one person, so they are written there only when that is the same
      // person, or the row has no contact yet. Otherwise the primary contact
      // chosen in the CRM stays, and the onboarding contact is filled in on
      // the company's matching contact, or added as a new one.
      let onCompany: Record<string, unknown> = {}
      let linked: { id: string | null; fields: Record<string, unknown> } | null = null
      if (hasPerson(contact)) {
        if (samePerson(company, contact)) onCompany = contact
        else {
          const { data: contacts, error: contactsErr } = await supabase
            .from('sponsors')
            .select('id, contactFirstName, contactLastName, contactEmail')
            .eq('companyId', company.id)
          if (contactsErr) throw contactsErr
          const match = ((contacts || []) as (Person & { id: string })[]).find((c) => samePerson(c, contact))
          if (match) linked = { id: match.id, fields: contact }
          else if (!hasPerson(company)) onCompany = contact
          else linked = { id: null, fields: contact }
        }
      }

      const notes = (company.notes || '').includes('[Onboarded ·') ? company.notes : [company.notes, onboardingNote].filter(Boolean).join('\n\n')
      const update = { ...onCompany, tier: body?.tier || undefined, status: 'Confirmed', notes, updatedAt: new Date().toISOString() }
      let { error } = await supabase.from('sponsors').update({ ...update, ...marketing }).eq('id', company.id)
      if (error && missingColumn(error)) ({ error } = await supabase.from('sponsors').update(update).eq('id', company.id))
      if (error) throw error

      if (linked?.id) {
        const { error: contactErr } = await supabase.from('sponsors').update(linked.fields).eq('id', linked.id)
        if (contactErr) throw contactErr
      } else if (linked) {
        const { error: contactErr } = await supabase.from('sponsors').insert({
          companyId: company.id,
          companyName: company.companyName || companyName,
          ...linked.fields,
          status: 'Confirmed',
          event: company.event || event,
          tags: 'Sponsor onboarding',
        })
        if (contactErr) throw contactErr
      }
      await addSpeakerContact(body?.speaker, { id: company.id, companyName: company.companyName || companyName, event: company.event || event })
      return NextResponse.json({ ok: true, created: false, id: company.id, event }, { headers: CORS_HEADERS })
    }

    const record = {
      companyName,
      tier: body?.tier || null,
      status: 'Confirmed',
      event,
      contractStatus: 'Signed',
      tags: 'Sponsor onboarding',
      notes: onboardingNote,
      ...contact,
    }
    let { data, error } = await supabase.from('sponsors').insert({ ...record, ...marketing }).select('id').single()
    if (error && missingColumn(error)) ({ data, error } = await supabase.from('sponsors').insert(record).select('id').single())
    if (error) throw error
    if (data?.id) await addSpeakerContact(body?.speaker, { id: data.id, companyName, event })
    return NextResponse.json({ ok: true, created: true, id: data?.id, event }, { status: 201, headers: CORS_HEADERS })
  } catch (error: any) {
    console.error('sponsor webhook error:', error)
    return NextResponse.json({ error: 'Internal server error', detail: String(error?.message || error).slice(0, 300) }, { status: 500, headers: CORS_HEADERS })
  }
}

// A rejected delegate booking from a solution provider, filed as a sales
// lead for the edition (see the note at the top).
async function fileLead(body: Record<string, unknown>, companyName: string, event: string, email: string | null, company: Row | null) {
  const contact: Record<string, unknown> = {}
  if (body.contactFirstName) contact.contactFirstName = String(body.contactFirstName)
  if (body.contactLastName) contact.contactLastName = String(body.contactLastName)
  if (email) contact.contactEmail = email
  if (body.contactPhone) contact.contactPhone = String(body.contactPhone)
  if (body.contactJobTitle) contact.contactJobTitle = String(body.contactJobTitle)
  const source = String(body.source || 'rejected delegate booking').slice(0, 120)
  const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const who = [`${contact.contactFirstName ?? ''} ${contact.contactLastName ?? ''}`.trim(), contact.contactJobTitle].filter(Boolean).join(', ')
  const note = `[Lead · ${source} · ${stamp}]${who ? ` ${who}` : ''}`
  const tags = 'Rejected delegate booking'

  if (!company) {
    const { data, error } = await supabase
      .from('sponsors')
      .insert({ companyName, status: 'Not Contacted', event, tier: null, tags, notes: note, ...contact })
      .select('id')
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, created: true, id: data?.id, event }, { status: 201, headers: CORS_HEADERS })
  }

  // Already a company in this edition: its stage and primary contact stay.
  // The person is added as one of its contacts unless they are on it already.
  if (hasPerson(contact) && !samePerson(company, contact)) {
    const { data: contacts, error: contactsErr } = await supabase
      .from('sponsors')
      .select('id, contactFirstName, contactLastName, contactEmail')
      .eq('companyId', company.id)
    if (contactsErr) throw contactsErr
    if (!((contacts || []) as Person[]).some((c) => samePerson(c, contact))) {
      const { error } = hasPerson(company)
        ? await supabase.from('sponsors').insert({
            companyId: company.id,
            companyName: company.companyName || companyName,
            ...contact,
            status: 'Not Contacted',
            event: company.event || event,
            tags,
          })
        : await supabase.from('sponsors').update(contact).eq('id', company.id)
      if (error) throw error
    }
  }
  if (!(company.notes || '').includes(note)) {
    const notes = [company.notes, note].filter(Boolean).join('\n\n')
    const { error } = await supabase.from('sponsors').update({ notes, updatedAt: new Date().toISOString() }).eq('id', company.id)
    if (error) throw error
  }
  return NextResponse.json({ ok: true, created: false, id: company.id, event }, { headers: CORS_HEADERS })
}
