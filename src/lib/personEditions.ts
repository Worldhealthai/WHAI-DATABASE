// A speaker or delegate is one row per event (edition) they are part of
// (migration 011): each row carries that event's stage, session, ticket and
// so on. The rows of one person are matched on their email
// (case-insensitive), or on first and last name when there is no email.
// These read every event a person is in, add them to more events in one go
// (a fresh row per event with their details copied, the stage back to the
// start) and take them out of events.
import { supabase } from '@/lib/supabase'

export type PersonTable = 'speakers' | 'delegates'

// What belongs to the person, not to one event; copied to a new event's row.
const PERSON: Record<PersonTable, string[]> = {
  speakers: [
    'firstName', 'lastName', 'email', 'phone', 'linkedinUrl', 'organization', 'jobTitle', 'country', 'city',
    'headshotUrl', 'bio', 'expertiseAreas', 'subType', 'tags',
  ],
  delegates: [
    'firstName', 'lastName', 'email', 'phone', 'linkedinUrl', 'organization', 'jobTitle', 'country', 'city',
    'subType', 'dietaryRequirements', 'accessibilityNeeds', 'bio', 'tags',
  ],
}
export const FIRST_STAGE: Record<PersonTable, string> = { speakers: 'Not Contacted', delegates: 'Registered' }

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')
const yearOf = (event: string) => Number(event.match(/\b(20\d{2})\b/)?.[1]) || null

export interface PersonEdition { id: string; event: string | null; status: string | null; year?: number | null; sessionTitle?: string | null }

export async function personEditions(table: PersonTable, id: string): Promise<{ name: string; editions: PersonEdition[] } | null> {
  const { data: me } = await supabase.from(table).select('id, email, firstName, lastName').eq('id', id).maybeSingle()
  if (!me) return null
  const cols = table === 'speakers' ? 'id, event, status, year, sessionTitle' : 'id, event, status'
  let q = supabase.from(table).select(cols)
  const email = typeof me.email === 'string' ? me.email.trim() : ''
  if (email) q = q.ilike('email', escapeLike(email))
  else if (me.firstName && me.lastName) q = q.ilike('firstName', escapeLike(me.firstName)).ilike('lastName', escapeLike(me.lastName)).or('email.is.null,email.eq.')
  else q = q.eq('id', id)
  const { data } = await q
  const rows = ((data ?? []) as unknown as PersonEdition[]).slice()
  // Newest edition first.
  rows.sort((a, b) => (yearOf(String(b.event ?? '')) ?? b.year ?? 0) - (yearOf(String(a.event ?? '')) ?? a.year ?? 0) || String(a.event ?? '').localeCompare(String(b.event ?? '')))
  return { name: [me.firstName, me.lastName].filter(Boolean).join(' '), editions: rows }
}

export async function addPersonToEvents(table: PersonTable, id: string, events: string[], status?: string | null) {
  const { data: me, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (error || !me) return { error: 'Person not found.' as const }
  const current = await personEditions(table, id)
  const have = new Set((current?.editions ?? []).map((e) => String(e.event ?? '').trim().toLowerCase()))
  const wanted = Array.from(new Set(events.map((e) => String(e).trim()).filter(Boolean)))
  const details = Object.fromEntries(PERSON[table].filter((k) => k in me).map((k) => [k, me[k]]))

  const added: { event: string; id: string }[] = []
  const skipped: string[] = []
  for (const event of wanted) {
    if (have.has(event.toLowerCase())) { skipped.push(event); continue }
    const row = {
      ...details,
      event,
      status: status || FIRST_STAGE[table],
      ...(table === 'speakers' ? { year: yearOf(event) } : {}),
    }
    const { data: made, error: insertError } = await supabase.from(table).insert(row).select('id').single()
    if (insertError || !made) { skipped.push(event); console.error(`Could not add ${current?.name} to ${event}:`, insertError); continue }
    added.push({ event, id: made.id })
    have.add(event.toLowerCase())
  }
  return { added, skipped }
}

// Take a person out of events: each event's record of them goes (its logged
// activity goes with it in the database).
export async function removePersonFromEvents(table: PersonTable, id: string, events: string[]) {
  const current = await personEditions(table, id)
  if (!current) return { error: 'Person not found.' as const }
  const wanted = new Set(events.map((e) => String(e).trim().toLowerCase()).filter(Boolean))
  const removed: { event: string; id: string }[] = []
  for (const ed of current.editions) {
    if (!ed.event || !wanted.has(ed.event.trim().toLowerCase())) continue
    const { error } = await supabase.from(table).delete().eq('id', ed.id)
    if (error) { console.error(`Could not remove ${current.name} from ${ed.event}:`, error); continue }
    removed.push({ event: ed.event, id: ed.id })
  }
  const remaining = current.editions.filter((ed) => !removed.some((r) => r.id === ed.id))
  return { removed, remaining }
}
