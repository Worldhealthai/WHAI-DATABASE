// A company is one row per event (edition) it is part of: each row carries
// that event's stage, value and package, and its contacts hang off it. The
// same company in another event is another row with the same name. These
// read every event a company is in, and add it to more events in one go:
// a fresh row per event (stage back to the start, no value or package
// yet) with the company's details and its contacts copied across.
import { supabase } from '@/lib/supabase'

export type CompanyTable = 'sponsors' | 'partners'

// What belongs to one event's conversation, not to the company.
const PER_EVENT = [
  'id', 'companyId', 'createdAt', 'updatedAt', 'event', 'status', 'valueAmount',
  'contractStatus', 'packageDetails', 'notes', 'onboardedAt', 'linkedinPostsDue', 'linkedinPostsDone',
]
const omit = (row: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)))

// An exact, case-insensitive name match (no wildcards from the name itself).
const exactName = (name: string) => name.trim().replace(/[\\%_]/g, (c) => `\\${c}`)

export interface CompanyEdition { id: string; event: string | null; status: string | null; tier: string | null; valueAmount: number | null }

export async function companyEditions(table: CompanyTable, id: string): Promise<{ companyName: string; editions: CompanyEdition[] } | null> {
  const { data: company } = await supabase.from(table).select('id, companyName, companyId').eq('id', id).maybeSingle()
  if (!company || company.companyId) return null
  const { data } = await supabase
    .from(table)
    .select('id, event, status, tier, valueAmount')
    .is('companyId', null)
    .ilike('companyName', exactName(company.companyName))
    .order('event', { ascending: false })
  return { companyName: company.companyName, editions: (data ?? []) as CompanyEdition[] }
}

export async function addCompanyToEvents(table: CompanyTable, id: string, events: string[]) {
  const { data: company, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (error || !company || company.companyId) return { error: 'Company not found.' as const }
  const current = await companyEditions(table, id)
  const have = new Set((current?.editions ?? []).map((e) => String(e.event ?? '').trim().toLowerCase()))
  const wanted = Array.from(new Set(events.map((e) => String(e).trim()).filter(Boolean)))
  const { data: contacts } = await supabase.from(table).select('*').eq('companyId', id)

  const added: { event: string; id: string }[] = []
  const skipped: string[] = []
  for (const event of wanted) {
    if (have.has(event.toLowerCase())) { skipped.push(event); continue }
    const row = {
      ...omit(company, PER_EVENT),
      // A sponsor's tier is the package bought for that event; a partner's
      // is the kind of partner it is, which stays.
      ...(table === 'sponsors' ? { tier: null } : {}),
      event,
      status: 'Not Contacted',
    }
    const { data: made, error: insertError } = await supabase.from(table).insert(row).select('id').single()
    if (insertError || !made) { skipped.push(event); console.error(`Could not add ${company.companyName} to ${event}:`, insertError); continue }
    if (contacts?.length) {
      const people = contacts.map((c) => ({ ...omit(c, ['id', 'createdAt', 'updatedAt', 'companyId', 'event']), companyId: made.id }))
      const { error: peopleError } = await supabase.from(table).insert(people)
      if (peopleError) console.error(`Contacts not copied to ${event}:`, peopleError)
    }
    added.push({ event, id: made.id })
    have.add(event.toLowerCase())
  }
  return { added, skipped }
}

// Take a company out of events: each event's record of it goes, with the
// contacts under it (its logged activity goes with it in the database).
export async function removeCompanyFromEvents(table: CompanyTable, id: string, events: string[]) {
  const current = await companyEditions(table, id)
  if (!current) return { error: 'Company not found.' as const }
  const wanted = new Set(events.map((e) => String(e).trim().toLowerCase()).filter(Boolean))
  const removed: { event: string; id: string }[] = []
  for (const ed of current.editions) {
    if (!ed.event || !wanted.has(ed.event.trim().toLowerCase())) continue
    const { error: peopleError } = await supabase.from(table).delete().eq('companyId', ed.id)
    if (peopleError) { console.error(`Contacts not removed from ${ed.event}:`, peopleError); continue }
    const { error } = await supabase.from(table).delete().eq('id', ed.id)
    if (error) { console.error(`Could not remove ${current.companyName} from ${ed.event}:`, error); continue }
    removed.push({ event: ed.event, id: ed.id })
  }
  const remaining = current.editions.filter((ed) => !removed.some((r) => r.id === ed.id))
  return { removed, remaining }
}
