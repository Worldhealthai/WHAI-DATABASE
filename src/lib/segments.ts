// The CRM in two layers, read from the three tabs as they are (nothing is
// stored or changed):
//
//   firmographic  who the company is — "Solution Provider" (sells) or
//                 "End User" (buys)
//   relationship  what a person does at our events — Delegate, Speaker,
//                 Sponsor (several at once)
//
// The rules, in one place so they can be changed (docs/audit/README.md):
//   Sponsors tab   → Solution Provider; tag Sponsor
//   Speakers tab   → their Speaker type when set (a sponsor's speaker is a
//                    Solution Provider), else End User; tag Speaker
//   Delegates tab  → their Company type when set; otherwise Solution
//                    Provider when paid (a Nexus booking paid by card, a
//                    Ticket or Sponsor pass, or "paid" in tags), else End
//                    User; tag Delegate
// A company with both labels is a Solution Provider, marked as a conflict
// for a human look, unless it is one the team has settled (SETTLED below).

export type Firmographic = 'Solution Provider' | 'End User'
export type Relationship = 'Sponsor' | 'Speaker' | 'Delegate'
export const RELATIONSHIPS: Relationship[] = ['Sponsor', 'Speaker', 'Delegate']

export function firmographicByRule(relationship: Relationship, paid: boolean): Firmographic {
  if (relationship === 'Sponsor') return 'Solution Provider'
  if (relationship === 'Speaker') return 'End User'
  return paid ? 'Solution Provider' : 'End User'
}

// Companies whose label the team has settled, whoever their people are: a
// Solution Provider can work with or speak for them (Hasib Aftab at the NHS),
// and they are never sponsors. Keys as companyKey() makes them.
const SETTLED: Record<string, Firmographic> = {
  nhs: 'End User',
  nice: 'End User',
  sobi: 'End User',
}

const LEGAL = /(\s+(ltd|limited|llc|llp|inc|plc|corp|corporation|gmbh|ag|sa|bv|group|holdings|co|company|international|uk))+\s*$/

// "Novartis AG" and "novartis" are one company.
export function companyKey(name: string | null | undefined): string | null {
  const k = (name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEGAL, '')
    .trim()
  return k || null
}

// A person is their email; without one, their name at their company.
export function personKey(email: string | null | undefined, first: string | null | undefined, last: string | null | undefined, company: string | null | undefined): string | null {
  const e = (email || '').trim().toLowerCase()
  if (e) return e
  const n = `${first || ''} ${last || ''}`.replace(/\s+/g, ' ').trim().toLowerCase()
  return n ? `${n}|${companyKey(company) || ''}` : null
}

const SENIOR = /(chief|ceo|cto|cdo|cmo|cio|coo|vp|vice president|head|director|founder|partner|president)/i

export interface SegmentContact {
  relationship: Relationship
  table: 'sponsors' | 'speakers' | 'delegates'
  id: string               // the row (a sponsor contact row links to its company row)
  recordId: string         // the record to open: the company row for sponsors
  event?: string | null
  company: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
  linkedinUrl: string | null
  status: string | null
  selfDeclared: string | null  // subType from the booking form
  paid: boolean
  firmographic: Firmographic
  website?: string | null
  country?: string | null
  tier?: string | null
  valueAmount?: number | null
  updatedAt: string | null
}

export interface Person {
  key: string
  name: string
  email: string | null
  phone: string | null
  jobTitle: string | null
  company: string | null
  companyKey: string | null
  tags: Relationship[]
  firmographic: Firmographic | null    // their company's
  selfDeclared: string | null
  records: { relationship: Relationship; table: string; id: string; status: string | null; event?: string | null }[]
  events: string[]         // every event they are in
  updatedAt: string | null
}

export interface Account {
  key: string
  name: string
  firmographic: Firmographic
  conflict: boolean
  decidedBy: string[]
  // Why a company needs a look: the people whose own label disagrees with
  // the company's ("Jane Doe (Speaker) said End User").
  disagree: string[]
  tags: Relationship[]
  people: number
  sponsorStage: string | null
  sponsorRecordId: string | null
  tier: string | null
  valueAmount: number | null
  website: string | null
  country: string | null
  best: { name: string; jobTitle: string | null; email: string | null; phone: string | null } | null
  events: string[]
  // Its people, each once, with their roles and records.
  members: Member[]
  completeness: number
  updatedAt: string | null
  // The record to open for it: the sponsor company if there is one, else
  // its first person's.
  open: { table: string; id: string }
}

export interface Member {
  key: string
  name: string
  email: string | null
  phone: string | null
  jobTitle: string | null
  tags: Relationship[]
  records: { relationship: Relationship; table: string; id: string; status: string | null; event?: string | null }[]
}

// People who gave no company are listed together under this name.
export const NO_COMPANY = 'No company given'

const STAGE_RANK: Record<string, number> = { 'Not Contacted': 1, Emailed: 2, 'In Discussion': 3, Confirmed: 4, Rejected: 0 }
const latest = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b)

export function consolidate(contacts: SegmentContact[]): { people: Person[]; accounts: Account[] } {
  // People: one per email (or name at company), every tab they are in.
  const byPerson = new Map<string, Person>()
  for (const c of contacts) {
    const key = personKey(c.email, c.firstName, c.lastName, c.company)
    if (!key) continue
    const name = `${c.firstName || ''} ${c.lastName || ''}`.replace(/\s+/g, ' ').trim()
    const p = byPerson.get(key) ?? {
      key, name, email: c.email, phone: null, jobTitle: null, company: null, companyKey: null,
      tags: [], firmographic: null, selfDeclared: null, records: [], events: [], updatedAt: null,
    }
    p.name ||= name
    p.email ||= c.email
    p.phone ||= c.phone
    p.jobTitle ||= c.jobTitle
    if (!p.company && c.company) { p.company = c.company; p.companyKey = companyKey(c.company) }
    p.selfDeclared ||= c.selfDeclared
    if (!p.tags.includes(c.relationship)) p.tags.push(c.relationship)
    p.records.push({ relationship: c.relationship, table: c.table, id: c.recordId, status: c.status, event: c.event ?? null })
    if (c.event && !p.events.includes(c.event)) p.events.push(c.event)
    p.updatedAt = latest(p.updatedAt, c.updatedAt)
    byPerson.set(key, p)
  }

  // Companies: one per normalised name, labelled by the rules.
  const byCompany = new Map<string, { contacts: SegmentContact[] }>()
  for (const c of contacts) {
    const k = companyKey(c.company) ?? (c.firstName || c.lastName || c.email ? '__none' : null)
    if (!k) continue
    const g = byCompany.get(k) ?? { contacts: [] }
    g.contacts.push(c)
    byCompany.set(k, g)
  }
  const accounts: Account[] = []
  for (const [key, { contacts: cs }] of byCompany) {
    const settled = SETTLED[key]
    const labels = settled ? new Set<Firmographic>([settled]) : new Set(cs.map((c) => c.firmographic))
    const decidedBy = Array.from(new Set(cs.map((c) => (c.relationship === 'Delegate' ? (c.paid ? 'Paid delegate' : 'Free delegate') : `${c.relationship}s tab`))))
    const sponsorRows = cs.filter((c) => c.relationship === 'Sponsor')
    const lead = sponsorRows.sort((a, b) => (STAGE_RANK[b.status || ''] ?? 0) - (STAGE_RANK[a.status || ''] ?? 0))[0]
    const named = cs.filter((c) => c.firstName || c.lastName || c.email)
    const best = named.sort((a, b) =>
      (Number(!!b.email) + Number(!!b.phone)) - (Number(!!a.email) + Number(!!a.phone)) ||
      Number(SENIOR.test(b.jobTitle || '')) - Number(SENIOR.test(a.jobTitle || '')))[0]
    const people = new Set(named.map((c) => personKey(c.email, c.firstName, c.lastName, c.company))).size
    const pick = <T,>(f: (c: SegmentContact) => T | null | undefined) => cs.map(f).find((v) => v !== null && v !== undefined && v !== '') ?? null
    const updatedAt = cs.reduce<string | null>((m, c) => latest(m, c.updatedAt), null)
    const website = pick((c) => c.website)
    const country = pick((c) => c.country)
    const tier = pick((c) => c.tier)
    const valueAmount = pick((c) => (c.valueAmount ? Number(c.valueAmount) : null))
    // How much there is to work with (out of 100): who to call and how,
    // what the company is, and whether it is warm.
    const has = (f: (c: SegmentContact) => unknown) => cs.some((c) => !!f(c))
    const recent = !!updatedAt && Date.now() - new Date(updatedAt).getTime() < 90 * 864e5
    const completeness =
      15 * Number(has((c) => c.firstName || c.lastName)) + 20 * Number(has((c) => c.email)) + 15 * Number(has((c) => c.phone)) +
      10 * Number(has((c) => c.jobTitle)) + 10 * Number(!!website) + 5 * Number(!!country) + 5 * Number(has((c) => c.linkedinUrl)) +
      10 * Number(people >= 2) + 5 * Number(!!(tier || valueAmount)) + 5 * Number(recent)
    const members = new Map<string, Member>()
    for (const c of cs) {
      const pk = personKey(c.email, c.firstName, c.lastName, c.company)
      if (!pk) continue
      const m = members.get(pk) ?? { key: pk, name: `${c.firstName || ''} ${c.lastName || ''}`.replace(/\s+/g, ' ').trim() || c.email || '', email: c.email, phone: null, jobTitle: null, tags: [], records: [] }
      m.email ||= c.email
      m.phone ||= c.phone
      m.jobTitle ||= c.jobTitle
      if (!m.tags.includes(c.relationship)) m.tags.push(c.relationship)
      m.records.push({ relationship: c.relationship, table: c.table, id: c.recordId, status: c.status, event: c.event ?? null })
      members.set(pk, m)
    }
    accounts.push({
      key,
      name: key === '__none' ? NO_COMPANY : cs.map((c) => (c.company || '').trim()).sort((a, b) => b.length - a.length)[0],
      firmographic: labels.has('Solution Provider') ? 'Solution Provider' : 'End User',
      conflict: labels.size > 1,
      decidedBy,
      disagree: labels.size > 1
        ? Array.from(new Set(cs.filter((c) => c.firmographic !== (labels.has('Solution Provider') ? 'Solution Provider' : 'End User'))
            .map((c) => `${`${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Someone'} (${c.relationship}) said ${c.firmographic}`)))
        : [],
      tags: RELATIONSHIPS.filter((r) => cs.some((c) => c.relationship === r)),
      people,
      sponsorStage: lead?.status ?? null,
      sponsorRecordId: lead?.recordId ?? null,
      tier: tier as string | null,
      valueAmount: valueAmount as number | null,
      website: website as string | null,
      country: country as string | null,
      best: best ? { name: `${best.firstName || ''} ${best.lastName || ''}`.trim() || best.email || '', jobTitle: best.jobTitle, email: best.email, phone: best.phone } : null,
      completeness,
      events: Array.from(new Set(cs.map((c) => c.event).filter((e): e is string => !!e))),
      members: Array.from(members.values()).sort((a, b) => a.name.localeCompare(b.name)),
      updatedAt,
      open: lead ? { table: 'sponsors', id: lead.recordId } : { table: cs[0].table, id: cs[0].recordId },
    })
  }

  // A person's firmographic is their company's.
  const label = new Map(accounts.map((a) => [a.key, a.firmographic]))
  const people = Array.from(byPerson.values())
  for (const p of people) p.firmographic = p.companyKey ? label.get(p.companyKey) ?? null : null
  return { people, accounts }
}

// The daily hit list: open Solution Providers, most complete first, then
// the furthest along and most recently touched.
export function hitList(accounts: Account[], limit = 50): Account[] {
  return accounts
    .filter((a) => a.firmographic === 'Solution Provider' && a.sponsorStage !== 'Confirmed' && a.sponsorStage !== 'Rejected')
    .sort((a, b) =>
      b.completeness - a.completeness ||
      (STAGE_RANK[b.sponsorStage || ''] ?? 2) - (STAGE_RANK[a.sponsorStage || ''] ?? 2) ||
      (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, limit)
}
