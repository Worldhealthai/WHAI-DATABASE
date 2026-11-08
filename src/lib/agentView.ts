// What the agents' key (AGENT_READ_TOKEN) may read of contacts and
// companies: the same people and companies the CRM's Contacts and Companies
// tabs show (lib/segments), trimmed to plain fields. Read only, and no deal
// values or internal record ids beyond what is needed to name a record.
import type { Account, Person } from '@/lib/segments'

export const MAX_LIMIT = 200

// ?limit and ?offset, within bounds.
export function paging(sp: URLSearchParams): { limit: number; offset: number } {
  const n = (v: string | null, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d)
  return { limit: Math.min(Math.max(n(sp.get('limit'), 50), 1), MAX_LIMIT), offset: n(sp.get('offset'), 0) }
}

// ?type=solution-provider | end-user (or the labels themselves).
export function typeFilter(v: string | null): 'Solution Provider' | 'End User' | null {
  const t = (v || '').toLowerCase().replace(/[^a-z]/g, '')
  return t === 'solutionprovider' ? 'Solution Provider' : t === 'enduser' ? 'End User' : null
}

// Every word of the query found somewhere in the text, ignoring case.
export function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  const hay = fields.filter(Boolean).join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}

export function companyCard(a: Account) {
  return {
    key: a.key,
    name: a.name,
    type: a.firmographic,
    sides: a.sides,
    website: a.website,
    country: a.country,
    roles: a.tags,
    sponsorStage: a.sponsorStage,
    tier: a.tier,
    events: a.events,
    people: a.people,
    mainContact: a.best,
    updatedAt: a.updatedAt,
  }
}

export function contactCard(p: Person) {
  return {
    key: p.key,
    name: p.name,
    jobTitle: p.jobTitle,
    company: p.company,
    companyKey: p.companyKey,
    companyType: p.firmographic,
    email: p.email,
    phone: p.phone,
    roles: p.tags,
    sides: p.focus.length ? p.focus : p.focusAuto,
    events: p.events,
    pipelines: p.records
      .filter((r) => r.table !== 'leads')
      .map((r) => ({ pipeline: r.relationship, status: r.status, event: r.event ?? null })),
    note: p.note,
    updatedAt: p.updatedAt,
  }
}
