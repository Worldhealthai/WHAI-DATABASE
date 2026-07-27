// Duplicate-company detection and merging for the sponsors / partners tables.
//
// Both tables store a company as a row with companyId = NULL, and every extra
// person at that company as another row in the same table with companyId set to
// the company row's id. A duplicate therefore looks like two company rows with
// the same name, each carrying its own primary contact and its own children.
//
// Merging keeps ONE company row and moves everything else onto it:
//   • company fields  — blanks on the survivor are filled from the duplicates
//   • people          — every contact from every duplicate ends up under the
//                       survivor; the same person appearing twice is merged
//                       field-by-field (a missing phone is taken from the twin)
//   • activities      — re-pointed at the survivor so no history is lost
// Only then are the emptied duplicate rows deleted.

import { supabase } from '@/lib/supabase'

export type MergeTable = 'sponsors' | 'partners'

export interface CompanyRow {
  id: string
  companyId: string | null
  companyName: string | null
  website: string | null
  contactFirstName: string | null
  contactLastName: string | null
  contactEmail: string | null
  contactPhone: string | null
  contactLinkedinUrl: string | null
  contactJobTitle: string | null
  country: string | null
  city: string | null
  tier: string | null
  status: string | null
  event: string | null
  valueAmount: number | null
  valueCurrency: string | null
  contractStatus: string | null
  packageDetails: string | null
  tags: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ── Name normalisation ───────────────────────────────────────────────────────

// Legal suffixes that shouldn't make two records look like different companies.
const LEGAL_SUFFIXES = [
  'ltd', 'limited', 'llc', 'llp', 'inc', 'incorporated', 'plc', 'corp',
  'corporation', 'gmbh', 'ag', 'sa', 'srl', 'bv', 'nv', 'ab', 'as', 'oy',
  'pty', 'co', 'company', 'holdings', 'group', 'international', 'intl',
]

// "BridgeHead Software Ltd." and "bridgehead  software" collapse to the same key.
export function normaliseCompanyName(raw: string | null | undefined): string {
  if (!raw) return ''
  let s = raw
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.,''`"()]/g, ' ')
    .replace(/[-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Strip trailing legal suffixes, repeatedly ("Foo Group Ltd" → "foo").
  let changed = true
  while (changed) {
    changed = false
    for (const suffix of LEGAL_SUFFIXES) {
      if (s.endsWith(` ${suffix}`)) {
        s = s.slice(0, -(suffix.length + 1)).trim()
        changed = true
      }
    }
  }
  return s
}

// ── Field merge rules ────────────────────────────────────────────────────────

// Furthest-along status wins, so merging "Not Contacted" into "In Discussion"
// never loses pipeline progress.
const STATUS_RANK: Record<string, number> = {
  'Not Contacted': 0,
  'Rejected': 1,
  'Emailed': 2,
  'In Discussion': 3,
  'Confirmed': 4,
}
const statusRank = (s: string | null | undefined) => (s && STATUS_RANK[s] !== undefined ? STATUS_RANK[s] : 0)

const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

// Company-level fields taken from a duplicate only when the survivor's is empty.
const COMPANY_FILL_FIELDS = [
  'website', 'country', 'city', 'tier', 'event',
  'valueCurrency', 'contractStatus', 'packageDetails',
] as const

// Person fields. These travel together as one identity — a phone is only ever
// filled from the SAME person on another record, never from a different person.
const PERSON_FIELDS = [
  'contactFirstName', 'contactLastName', 'contactEmail',
  'contactPhone', 'contactLinkedinUrl', 'contactJobTitle',
] as const

export type PersonFields = Pick<CompanyRow, (typeof PERSON_FIELDS)[number]>

// Identity key for a person: email when present (the reliable one), otherwise
// their name. Rows with neither are treated as having no person at all.
export function personKey(p: PersonFields): string | null {
  const email = (p.contactEmail || '').trim().toLowerCase()
  if (email) return `e:${email}`
  const name = `${(p.contactFirstName || '').trim()} ${(p.contactLastName || '').trim()}`
    .trim()
    .toLowerCase()
  return name ? `n:${name}` : null
}

export const hasPerson = (p: PersonFields): boolean => personKey(p) !== null

// Fills blanks on `base` from `extra`, returning only the changed fields.
function fillBlanks<T extends Record<string, unknown>>(
  base: T,
  extra: T,
  fields: readonly string[],
): Partial<T> {
  const patch: Record<string, unknown> = {}
  for (const f of fields) {
    if (isBlank(base[f]) && !isBlank(extra[f])) patch[f] = extra[f]
  }
  return patch as Partial<T>
}

// Comma-separated tag lists merged into one, case-insensitively deduped.
function mergeTags(a: string | null, b: string | null): string | null {
  const split = (s: string | null) => (s || '').split(',').map((t) => t.trim()).filter(Boolean)
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of [...split(a), ...split(b)]) {
    const k = t.toLowerCase()
    if (!seen.has(k)) { seen.add(k); out.push(t) }
  }
  return out.length ? out.join(', ') : null
}

// Notes are appended rather than overwritten — nothing a human typed is lost.
function mergeNotes(a: string | null, b: string | null, fromName: string): string | null {
  const left = (a || '').trim()
  const right = (b || '').trim()
  if (!right) return left || null
  if (!left) return right
  if (left.includes(right)) return left
  return `${left}\n\n— merged from duplicate ${fromName} —\n${right}`
}

// ── Detection ────────────────────────────────────────────────────────────────

export type DuplicateRecord = CompanyRow & {
  contactCount: number
  activityCount: number
  hasNotes: boolean
}

export interface DuplicateGroup {
  key: string
  name: string
  records: DuplicateRecord[]
}

// Every set of 2+ company rows sharing a normalised name, newest activity first.
export async function findDuplicateCompanies(table: MergeTable): Promise<DuplicateGroup[]> {
  const { data: companies, error } = await supabase
    .from(table)
    .select('*')
    .is('companyId', null)
  if (error) throw error

  const rows = (companies ?? []) as CompanyRow[]

  // Contact counts for every company in one pass.
  const { data: children } = await supabase
    .from(table)
    .select('companyId')
    .not('companyId', 'is', null)
  const counts = new Map<string, number>()
  for (const c of (children ?? []) as { companyId: string }[]) {
    counts.set(c.companyId, (counts.get(c.companyId) ?? 0) + 1)
  }

  // Logged activity per company — a record you've actually worked is the one
  // worth keeping, so it needs to outrank a bigger but untouched duplicate.
  const activityCol = table === 'sponsors' ? 'sponsorId' : 'partnerId'
  const { data: acts } = await supabase
    .from('activities')
    .select(activityCol)
    .not(activityCol, 'is', null)
  const activityCounts = new Map<string, number>()
  for (const a of (acts ?? []) as Record<string, string>[]) {
    const id = a[activityCol]
    if (id) activityCounts.set(id, (activityCounts.get(id) ?? 0) + 1)
  }

  const byKey = new Map<string, DuplicateRecord[]>()
  for (const r of rows) {
    const key = normaliseCompanyName(r.companyName)
    if (!key) continue
    const list = byKey.get(key) ?? []
    list.push({
      ...r,
      contactCount: counts.get(r.id) ?? 0,
      activityCount: activityCounts.get(r.id) ?? 0,
      hasNotes: !isBlank(r.notes),
    })
    byKey.set(key, list)
  }

  const groups: DuplicateGroup[] = []
  byKey.forEach((records, key) => {
    if (records.length < 2) return
    // Most-progressed record first — it's the one to keep by default.
    records.sort((a, b) => recordWeight(b) - recordWeight(a))
    groups.push({ key, name: records[0].companyName || key, records })
  })
  groups.sort((a, b) => a.name.localeCompare(b.name))
  return groups
}

// Which record deserves to survive. Ordered so that evidence of real work
// always beats sheer size: a company you've emailed or are in discussion with
// outranks an untouched duplicate even if the untouched one has more contacts.
// Nothing is lost either way — the loser's data is merged in before deletion —
// but the survivor keeps its id, its primary contact and its history in place.
export function recordWeight(r: DuplicateRecord): number {
  const filled = [
    r.website, r.contactEmail, r.contactPhone, r.contactJobTitle,
    r.country, r.city, r.tier, r.event, r.packageDetails,
  ].filter((v) => !isBlank(v)).length
  return (
    statusRank(r.status) * 1_000_000 +   // Confirmed > In Discussion > Emailed > Rejected > Not Contacted
    Math.min(r.activityCount, 99) * 5_000 + // logged calls / emails / notes on the timeline
    (r.hasNotes ? 2_000 : 0) +           // someone typed something into notes
    (r.valueAmount ? 1_000 : 0) +        // a deal value has been agreed
    r.contactCount * 100 +               // then size
    filled                               // then general completeness
  )
}

// ── Merge ────────────────────────────────────────────────────────────────────

export interface MergeSummary {
  keptId: string
  keptName: string
  mergedIds: string[]
  contactsMoved: number
  contactsMergedIntoExisting: number
  activitiesMoved: number
  fieldsFilled: string[]
}

export async function mergeCompanies(
  table: MergeTable,
  keepId: string,
  mergeIds: string[],
): Promise<MergeSummary> {
  const ids = mergeIds.filter((id) => id && id !== keepId)
  if (!ids.length) throw new Error('No duplicate records to merge')

  const activityCol = table === 'sponsors' ? 'sponsorId' : 'partnerId'

  // 1. Load the survivor and the duplicates, and everything hanging off them.
  const { data: rowsData, error: rowsErr } = await supabase
    .from(table)
    .select('*')
    .in('id', [keepId, ...ids])
  if (rowsErr) throw rowsErr

  const rows = (rowsData ?? []) as CompanyRow[]
  const survivor = rows.find((r) => r.id === keepId)
  if (!survivor) throw new Error('The record to keep no longer exists')
  const losers = rows.filter((r) => r.id !== keepId)
  if (!losers.length) throw new Error('The duplicate records no longer exist')
  if (rows.some((r) => r.companyId)) {
    throw new Error('Only company records can be merged, not individual contacts')
  }

  const { data: childData } = await supabase
    .from(table)
    .select('*')
    .in('companyId', [keepId, ...ids])
  const children = (childData ?? []) as CompanyRow[]

  const summary: MergeSummary = {
    keptId: keepId,
    keptName: survivor.companyName || '',
    mergedIds: [],
    contactsMoved: 0,
    contactsMergedIntoExisting: 0,
    activitiesMoved: 0,
    fieldsFilled: [],
  }

  // 2. Company-level fields: fill the survivor's blanks, take the best status,
  //    and combine tags/notes.
  const survivorPatch: Record<string, unknown> = {}
  for (const loser of losers) {
    const patch = fillBlanks(
      { ...survivor, ...survivorPatch } as unknown as Record<string, unknown>,
      loser as unknown as Record<string, unknown>,
      COMPANY_FILL_FIELDS,
    )
    Object.assign(survivorPatch, patch)

    if (isBlank((survivorPatch.valueAmount ?? survivor.valueAmount) as unknown) && !isBlank(loser.valueAmount)) {
      survivorPatch.valueAmount = loser.valueAmount
    }
    const currentStatus = (survivorPatch.status as string) ?? survivor.status
    if (statusRank(loser.status) > statusRank(currentStatus)) survivorPatch.status = loser.status

    const currentTags = (survivorPatch.tags as string) ?? survivor.tags
    const tags = mergeTags(currentTags, loser.tags)
    if (tags !== currentTags) survivorPatch.tags = tags

    const currentNotes = (survivorPatch.notes as string) ?? survivor.notes
    const notes = mergeNotes(currentNotes, loser.notes, loser.companyName || 'record')
    if (notes !== currentNotes) survivorPatch.notes = notes
  }

  // 3. People. Build the survivor's roster (its primary contact + its existing
  //    child rows), then fold every person from the duplicates into it.
  type Person = { key: string; row: CompanyRow; isSurvivorPrimary: boolean }
  const roster = new Map<string, Person>()

  if (hasPerson(survivor)) {
    roster.set(personKey(survivor)!, { key: personKey(survivor)!, row: survivor, isSurvivorPrimary: true })
  }
  for (const c of children.filter((c) => c.companyId === keepId)) {
    const k = personKey(c)
    if (k && !roster.has(k)) roster.set(k, { key: k, row: c, isSurvivorPrimary: false })
  }

  // Updates applied to already-existing rows (survivor primary or its children).
  const survivorPrimaryPersonPatch: Record<string, unknown> = {}
  const childPatches = new Map<string, Record<string, unknown>>()

  // A duplicate's person: merge into the matching person if we already have
  // them, otherwise they need to become a new contact under the survivor.
  const absorbPerson = (row: CompanyRow): 'merged' | 'new' => {
    const k = personKey(row)
    if (!k) return 'merged' // nothing to carry over
    const existing = roster.get(k)
    if (!existing) {
      roster.set(k, { key: k, row, isSurvivorPrimary: false })
      return 'new'
    }
    // Same human on both records — fill in whatever the kept copy is missing
    // (this is where a missing phone number gets picked up).
    const base = existing.isSurvivorPrimary
      ? { ...existing.row, ...survivorPrimaryPersonPatch }
      : { ...existing.row, ...(childPatches.get(existing.row.id) ?? {}) }
    const patch = fillBlanks(
      base as unknown as Record<string, unknown>,
      row as unknown as Record<string, unknown>,
      PERSON_FIELDS,
    )
    if (Object.keys(patch).length) {
      if (existing.isSurvivorPrimary) Object.assign(survivorPrimaryPersonPatch, patch)
      else childPatches.set(existing.row.id, { ...(childPatches.get(existing.row.id) ?? {}), ...patch })
    }
    return 'merged'
  }

  // Rows to re-parent onto the survivor, and duplicate company rows to delete.
  const reparent: string[] = []
  const toDelete: string[] = []

  for (const loser of losers) {
    // The duplicate's own children always move across.
    for (const c of children.filter((c) => c.companyId === loser.id)) {
      if (absorbPerson(c) === 'new') { reparent.push(c.id); summary.contactsMoved++ }
      else { toDelete.push(c.id); summary.contactsMergedIntoExisting++ }
    }
    // The duplicate's own primary contact becomes a contact under the survivor,
    // unless that person is already there.
    if (hasPerson(loser) && absorbPerson(loser) === 'new') {
      reparent.push(loser.id)
      summary.contactsMoved++
    } else {
      toDelete.push(loser.id)
      if (hasPerson(loser)) summary.contactsMergedIntoExisting++
    }
    summary.mergedIds.push(loser.id)
  }

  // If the survivor had no contact person at all, promote the first incoming
  // one into the company row so it never shows a nameless primary contact.
  if (!hasPerson(survivor)) {
    const firstIncoming = reparent[0]
    const row = [...children, ...losers].find((r) => r.id === firstIncoming)
    if (row) {
      for (const f of PERSON_FIELDS) survivorPatch[f] = row[f]
      reparent.shift()
      toDelete.push(row.id)
      summary.contactsMoved--
    }
  }

  // 4. Activities move before anything is deleted, so history is never lost to
  //    the ON DELETE CASCADE on the duplicate rows.
  const activitySourceIds = [...losers.map((l) => l.id), ...toDelete]
  if (activitySourceIds.length) {
    const { data: moved, error: actErr } = await supabase
      .from('activities')
      .update({ [activityCol]: keepId })
      .in(activityCol, activitySourceIds)
      .select('id')
    if (actErr) throw actErr
    summary.activitiesMoved = moved?.length ?? 0
  }

  // 5. Write the survivor.
  const finalSurvivorPatch = { ...survivorPatch, ...survivorPrimaryPersonPatch }
  if (Object.keys(finalSurvivorPatch).length) {
    finalSurvivorPatch.updatedAt = new Date().toISOString()
    const { error } = await supabase.from(table).update(finalSurvivorPatch).eq('id', keepId)
    if (error) throw error
    summary.fieldsFilled = Object.keys(finalSurvivorPatch).filter((f) => f !== 'updatedAt')
  }

  // 6. Update the kept contacts that gained details from a twin.
  for (const [id, patch] of Array.from(childPatches.entries())) {
    if (!Object.keys(patch).length) continue
    const { error } = await supabase
      .from(table)
      .update({ ...patch, updatedAt: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  // 7. Re-parent every incoming contact onto the survivor. Company-level fields
  //    are cleared on contact rows so they can't resurface as their own company.
  if (reparent.length) {
    const { error } = await supabase
      .from(table)
      .update({
        companyId: keepId,
        companyName: survivor.companyName,
        updatedAt: new Date().toISOString(),
      })
      .in('id', reparent)
    if (error) throw error
  }

  // 8. Delete what's left: emptied duplicate company rows and redundant twins.
  if (toDelete.length) {
    const { error } = await supabase.from(table).delete().in('id', toDelete)
    if (error) throw error
  }

  return summary
}
