// Reads one edition's, one side's (Health or Pharma) or, for the directory,
// every event's sponsors, speakers, delegates and leads (and the Nexus card
// payments, for the paid-delegate rule) into the two layers of
// lib/segments. Read only.
//
// A company is not assigned to an event (November 2026): it is on a side,
// Health or Pharma, and an event only comes into it when something happens
// there: it goes into that edition's Sales pipeline, or one of its people
// registers or speaks. So a leads-list record carries a side (its Health or
// Pharma tag; until it has one, the side of the event it was loaded under)
// and no event, and the three ways to read are:
//   an edition's labels   the records of that edition (no leads lists)
//   a side                everyone on that side: every event of its series,
//                         the leads lists, and anyone tagged for it
//   neither               everything
import { supabase } from '@/lib/supabase'
import { firmographicByRule, type SegmentContact } from '@/lib/segments'
import { focusOf, focusOfEvent, type Focus } from '@/lib/contactFocus'

type Row = Record<string, any>

// events null: every event.
// Pages of 1,000 (the API's cap), four at a time: the leads lists run to
// thousands of rows.
type Narrow = { events?: string[] | null; like?: [string, string]; ilike?: [string, string] }
async function all(table: string, select: string, narrow: Narrow = {}): Promise<Row[]> {
  const out: Row[] = []
  const page = async (from: number) => {
    let q = supabase.from(table).select(select)
    if (narrow.events) q = q.in('event', narrow.events)
    if (narrow.like) q = q.ilike(narrow.like[0], narrow.like[1])
    if (narrow.ilike) q = q.ilike(narrow.ilike[0], narrow.ilike[1])
    const { data, error } = await q.order('id').range(from, from + 999)
    if (error) throw error
    return (data ?? []) as unknown as Row[]
  }
  for (let from = 0; ; from += 4000) {
    const pages = await Promise.all([0, 1, 2, 3].map((i) => page(from + i * 1000)))
    for (const p of pages) out.push(...p)
    if (pages.some((p) => p.length < 1000)) return out
  }
}

// The series whose events are on a side.
const SERIES_OF: Record<Focus, string> = { Health: 'World Health AI', Pharma: 'World Pharma AI' }

// A table's rows on a side: those in one of its series' events, and those
// tagged for it whatever their event (read apart and joined, each row once).
// Which of them really are on the side is settled after, row by row.
async function onSide(table: string, select: string, side: Focus, like?: [string, string]): Promise<Row[]> {
  const [byEvent, byTag] = await Promise.all([
    all(table, select, { like, ilike: ['event', `${SERIES_OF[side]}%`] }),
    all(table, select, { like, ilike: ['tags', `%${side}%`] }),
  ])
  const seen = new Set<string>()
  return [...byEvent, ...byTag].filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
}

// Emails with a paid Nexus booking. Only where the CRM runs on the Nexus
// database (its bookings are in the same project); elsewhere none.
async function paidEmails(emails: string[]): Promise<Set<string>> {
  const paid = new Set<string>()
  const list = Array.from(new Set(emails.filter(Boolean)))
  try {
    for (let i = 0; i < list.length; i += 300) {
      const { data, error } = await supabase.schema('public').from('registrations').select('email').eq('payment_status', 'paid').in('email', list.slice(i, i + 300))
      if (error) return paid
      for (const r of data ?? []) if (r.email) paid.add(String(r.email).trim().toLowerCase())
    }
  } catch {
    // not the Nexus database: the tags and ticket type still count
  }
  return paid
}

const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

// With `company`, only the records whose company name contains it (every
// event): one company's page (/api/companies), sorted by companyKey after.
// With `side` (and no events), everyone on that side.
export async function loadContacts(events: string[] | null, opts: { company?: string; side?: Focus } = {}): Promise<SegmentContact[]> {
  if (events && !events.length) return []
  const side = events ? undefined : opts.side
  const like = (col: string): [string, string] | undefined => (opts.company ? [col, `%${opts.company.replace(/[\\%_]/g, '\\$&')}%`] : undefined)
  const read = (table: string, select: string, col: string) => (side ? onSide(table, select, side, like(col)) : all(table, select, { events, like: like(col) }))
  const [companies, speakers, delegates, leads] = await Promise.all([
    read('sponsors', 'id, "companyId", "companyName", event, website, country, tier, "valueAmount", status, "contactFirstName", "contactLastName", "contactEmail", "contactPhone", "contactJobTitle", "contactLinkedinUrl", tags, "updatedAt"', 'companyName'),
    read('speakers', 'id, event, organization, "firstName", "lastName", email, phone, "jobTitle", "linkedinUrl", status, "subType", tags, country, "updatedAt"', 'organization'),
    read('delegates', 'id, event, organization, "firstName", "lastName", email, phone, "jobTitle", "linkedinUrl", status, "subType", tags, "ticketType", country, "updatedAt"', 'organization'),
    // The leads lists belong to a side, not to an edition. Every lead
    // carries its side as a tag (migration 019), so a side reads them by
    // that alone: the lists run to thousands of rows.
    events ? Promise.resolve([] as Row[]) : all('leads', 'id, event, "companyName", "firstName", "lastName", email, phone, "jobTitle", "linkedinUrl", segment, country, website, notes, tags, "updatedAt"',
      { like: like('companyName'), ilike: side ? ['tags', `%${side}%`] : undefined }),
  ])
  // Sponsors: the company rows of the edition, each with its own contact,
  // then the extra contacts that hang off them (companyId), whatever event
  // they carry themselves.
  const sponsorCompanies = companies.filter((c) => !c.companyId && !['Media Partner', 'Association Partner'].includes(String(c.tier)))
  // A side: a contact tagged for it can hang off a company of the other
  // side (a Health company's Pharma contact), so its company row is read too.
  if (side) {
    const have = new Set(sponsorCompanies.map((c) => c.id))
    const missing = Array.from(new Set(companies.filter((c) => c.companyId && !have.has(c.companyId)).map((c) => c.companyId as string)))
    for (let i = 0; i < missing.length; i += 200) {
      const { data, error } = await supabase
        .from('sponsors')
        .select('id, "companyId", "companyName", event, website, country, tier, "valueAmount", status, "contactFirstName", "contactLastName", "contactEmail", "contactPhone", "contactJobTitle", "contactLinkedinUrl", tags, "updatedAt"')
        .in('id', missing.slice(i, i + 200))
      if (error) throw error
      sponsorCompanies.push(...((data ?? []) as Row[]).filter((c) => !c.companyId && !['Media Partner', 'Association Partner'].includes(String(c.tier))))
    }
  }
  const ids = sponsorCompanies.map((c) => c.id)
  // Every event: the contact rows are already in hand.
  const fetchExtra = !!events || !!opts.company || !!side
  const extra: Row[] = fetchExtra ? [] : companies.filter((c) => c.companyId)
  for (let i = 0; fetchExtra && i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('sponsors')
      .select('id, "companyId", "contactFirstName", "contactLastName", "contactEmail", "contactPhone", "contactJobTitle", "contactLinkedinUrl", tags, "updatedAt"')
      .in('companyId', ids.slice(i, i + 200))
    if (error) throw error
    extra.push(...((data ?? []) as Row[]))
  }
  const companyOf = new Map(sponsorCompanies.map((c) => [c.id, c]))
  const paid = await paidEmails(delegates.map((d) => s(d.email)?.toLowerCase() ?? ''))
  const out: SegmentContact[] = []

  for (const row of [...sponsorCompanies, ...extra]) {
    const company = companyOf.get(row.companyId ?? row.id)
    if (!company) continue
    out.push({
      relationship: 'Sponsor', table: 'sponsors', id: row.id, recordId: company.id, event: s(company.event),
      company: s(company.companyName), firstName: s(row.contactFirstName), lastName: s(row.contactLastName),
      email: s(row.contactEmail)?.toLowerCase() ?? null, phone: s(row.contactPhone), jobTitle: s(row.contactJobTitle), linkedinUrl: s(row.contactLinkedinUrl),
      status: company.status ?? null, selfDeclared: null, paid: false, firmographic: firmographicByRule('Sponsor', false),
      website: s(company.website), country: s(company.country), tier: s(company.tier), valueAmount: company.valueAmount ?? null,
      focus: focusOf(row.tags), updatedAt: row.updatedAt ?? company.updatedAt ?? null,
    })
  }
  for (const r of speakers) {
    out.push({
      relationship: 'Speaker', table: 'speakers', id: r.id, recordId: r.id, event: s(r.event), company: s(r.organization), firstName: s(r.firstName), lastName: s(r.lastName),
      email: s(r.email)?.toLowerCase() ?? null, phone: s(r.phone), jobTitle: s(r.jobTitle), linkedinUrl: s(r.linkedinUrl), status: r.status ?? null,
      // Their own answer (Speaker type) when they gave one: a sponsor's speaker
      // is a Solution Provider.
      selfDeclared: s(r.subType), paid: false,
      firmographic: s(r.subType) === 'Solution Provider' || s(r.subType) === 'End User' ? (s(r.subType) as 'Solution Provider' | 'End User') : firmographicByRule('Speaker', false),
      country: s(r.country), focus: focusOf(r.tags), updatedAt: r.updatedAt ?? null,
    })
  }
  for (const r of delegates) {
    const email = s(r.email)?.toLowerCase() ?? null
    const isPaid = (!!email && paid.has(email)) || /paid/i.test(String(r.tags ?? '')) || /paid|^ticket$|^sponsor$/i.test(String(r.ticketType ?? '').trim())
    // Their own answer (Company type) wins over the rule.
    const declared = s(r.subType)
    const firm = declared === 'Solution Provider' || declared === 'End User' ? declared : firmographicByRule('Delegate', isPaid)
    out.push({
      relationship: 'Delegate', table: 'delegates', id: r.id, recordId: r.id, event: s(r.event), company: s(r.organization), firstName: s(r.firstName), lastName: s(r.lastName),
      email, phone: s(r.phone), jobTitle: s(r.jobTitle), linkedinUrl: s(r.linkedinUrl), status: r.status ?? null,
      selfDeclared: declared, paid: isPaid, firmographic: firm, country: s(r.country), focus: focusOf(r.tags), updatedAt: r.updatedAt ?? null,
    })
  }
  // Leads lists (crm.leads): in Companies, Contacts and the Directory only,
  // labelled by the list (Solution Provider or End User), with their note.
  for (const r of leads) {
    // Its side: its own Health or Pharma tag, else the side of the event the
    // list was loaded under. No event of its own: a lead is in none.
    const tagged = focusOf(r.tags)
    const from = focusOfEvent(r.event)
    out.push({
      relationship: 'Lead', table: 'leads', id: r.id, recordId: r.id, event: null, company: s(r.companyName), firstName: s(r.firstName), lastName: s(r.lastName),
      email: s(r.email)?.toLowerCase() ?? null, phone: s(r.phone), jobTitle: s(r.jobTitle), linkedinUrl: s(r.linkedinUrl), status: null,
      selfDeclared: null, paid: false, firmographic: r.segment === 'Solution Provider' ? 'Solution Provider' : 'End User',
      website: s(r.website), country: s(r.country), note: s(r.notes), focus: tagged.length ? tagged : from ? [from] : [], updatedAt: r.updatedAt ?? null,
    })
  }
  if (!side) return out
  // On the side: by their own tag where they have one, else by their event.
  return out.filter((c) => ((c.focus ?? []).length ? c.focus! : [focusOfEvent(c.event)]).includes(side))
}
