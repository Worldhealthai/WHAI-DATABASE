// Assigning a contact from the triage inbox (staged_contacts) to a record:
// a delegate or speaker (production) or a sponsor or partner company
// (sales), filed under the event the enquiry was about. Used by the
// Unassigned page's buttons and by "Move to CRM" in the Nexus admin, which
// stages and assigns in one go.
import { supabase } from '@/lib/supabase'
import { canonicalEventLabel } from '@/types'
import { isEnquiry, teamNoteFromStaged, teamNoteSource } from '@/lib/inboxNote'
import { upsertInboxNoteActivity } from '@/lib/inboxNoteActivity'

export const ASSIGN_AS = ['delegate', 'speaker', 'sponsor', 'partner'] as const
export type AssignAs = (typeof ASSIGN_AS)[number]
export const isAssignAs = (v: unknown): v is AssignAs => typeof v === 'string' && (ASSIGN_AS as readonly string[]).includes(v)

const cap = (s: string) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

// The event the contact came in for, as a canonical label. The Nexus
// enquiry's own tag ("health-london-2027") names the edition exactly, city
// included; otherwise whatever event field the source sent.
export function eventOfStaged(raw: Record<string, unknown>): string | null {
  const slug = String(raw.event_id ?? '').trim().toLowerCase()
  const m = slug.match(/^(health|pharma)-([a-z]+(?:-[a-z]+)*)-(20\d{2})$/)
  if (m) return `World ${m[1] === 'pharma' ? 'Pharma' : 'Health'} AI ${cap(m[2])} ${m[3]}`
  const key = Object.keys(raw).find((k) => ['primary event', 'event', 'event_label', 'event label'].includes(k.toLowerCase()))
  const value = key ? String(raw[key] ?? '').trim() : ''
  if (!value) return null
  // The worldhealth.ai inbox stores bare city slugs.
  if (value.toLowerCase() === 'london') return 'World Health AI London 2026'
  if (value.toLowerCase() === 'boston') return 'World Health AI Boston 2025'
  return canonicalEventLabel(value)
}

function parseRaw(contact: { rawData?: string | null }): Record<string, unknown> {
  try { return JSON.parse(contact.rawData ?? '{}') ?? {} } catch { return {} }
}

export async function assignStagedContact(id: string, assignAs: AssignAs) {
  const { data: contact, error: fetchError } = await supabase.from('staged_contacts').select('*').eq('id', id).single()
  if (fetchError || !contact) return { error: 'Staged contact not found', status: 404 as const }

  const raw = parseRaw(contact)
  const event = eventOfStaged(raw)
  let subType: string | null = null
  const typeKey = Object.keys(raw).find((k) => ['attendee type', 'type'].includes(k.toLowerCase()))
  if (typeKey) {
    const at = String(raw[typeKey] ?? '').toLowerCase()
    if (at.includes('end_user') || at.includes('end-user')) subType = 'End User'
    else if (at.includes('solution_provider') || at.includes('solution-provider')) subType = 'Solution Provider'
  }
  const eventYear = Number(event?.match(/\b(20\d{2})\b/)?.[1] || 0) || new Date().getFullYear()

  // Enquiries from the admin panels arrive mid-conversation (already
  // replied to), not cold; imports start at the top of the pipeline.
  const fromEnquiry = isEnquiry(contact)

  const person = {
    firstName: contact.firstName, lastName: contact.lastName, email: contact.email, phone: contact.phone,
    linkedinUrl: contact.linkedinUrl, organization: contact.organization, jobTitle: contact.jobTitle,
    country: contact.country, city: contact.city, bio: contact.bio, tags: contact.tags, notes: contact.notes,
  }
  const company = {
    companyName: contact.organization ?? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim(),
    website: null,
    contactFirstName: contact.firstName, contactLastName: contact.lastName, contactEmail: contact.email,
    contactPhone: contact.phone, contactLinkedinUrl: contact.linkedinUrl, contactJobTitle: contact.jobTitle,
    country: contact.country, city: contact.city, tags: contact.tags, notes: contact.notes,
    event,
    status: fromEnquiry ? 'In Discussion' : 'Not Contacted',
  }

  const target =
    assignAs === 'delegate' ? { table: 'delegates', record: { ...person, status: 'Registered', event, subType } }
    : assignAs === 'speaker' ? { table: 'speakers', record: { ...person, status: fromEnquiry ? 'Discussing' : 'Not Contacted', event, subType, year: eventYear } }
    : assignAs === 'partner' ? { table: 'partners', record: { ...company, tier: 'Association Partner' } }
    : { table: 'sponsors', record: company }

  const { data: created, error: insertError } = await supabase.from(target.table).insert(target.record).select().single()
  if (insertError) return { error: insertError.message || 'Could not create the record', status: 500 as const }

  await supabase.from('staged_contacts').update({ status: 'assigned', assignedAs: assignAs, assignedId: created.id }).eq('id', id)

  // The team's note from the admin panel's inbox goes onto the new record's
  // timeline, alongside its status changes. Best-effort.
  const teamNote = teamNoteFromStaged(contact)
  if (teamNote) {
    await upsertInboxNoteActivity({ entityType: assignAs, entityId: created.id, note: teamNote, source: teamNoteSource(contact), email: contact.email })
  }
  return { assignedAs: assignAs, assignedId: created.id as string, event, record: created }
}
