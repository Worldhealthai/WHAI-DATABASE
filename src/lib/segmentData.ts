// Reads one edition's (or, for the directory, every event's) sponsors,
// speakers and delegates (and the Nexus card
// payments, for the paid-delegate rule) into the two layers of
// lib/segments. Read only.
import { supabase } from '@/lib/supabase'
import { firmographicByRule, type SegmentContact } from '@/lib/segments'

type Row = Record<string, any>

// events null: every event.
async function all(table: string, select: string, events: string[] | null): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(select)
    if (events) q = q.in('event', events)
    const { data, error } = await q.order('id').range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as unknown as Row[]))
    if (!data || data.length < 1000) return out
  }
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

export async function loadContacts(events: string[] | null): Promise<SegmentContact[]> {
  if (events && !events.length) return []
  const [companies, speakers, delegates] = await Promise.all([
    all('sponsors', 'id, "companyId", "companyName", event, website, country, tier, "valueAmount", status, "contactFirstName", "contactLastName", "contactEmail", "contactPhone", "contactJobTitle", "contactLinkedinUrl", "updatedAt"', events),
    all('speakers', 'id, event, organization, "firstName", "lastName", email, phone, "jobTitle", "linkedinUrl", status, "subType", country, "updatedAt"', events),
    all('delegates', 'id, event, organization, "firstName", "lastName", email, phone, "jobTitle", "linkedinUrl", status, "subType", tags, "ticketType", country, "updatedAt"', events),
  ])
  // Sponsors: the company rows of the edition, each with its own contact,
  // then the extra contacts that hang off them (companyId), whatever event
  // they carry themselves.
  const sponsorCompanies = companies.filter((c) => !c.companyId && !['Media Partner', 'Association Partner'].includes(String(c.tier)))
  const ids = sponsorCompanies.map((c) => c.id)
  // Every event: the contact rows are already in hand.
  const extra: Row[] = events ? [] : companies.filter((c) => c.companyId)
  for (let i = 0; events && i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('sponsors')
      .select('id, "companyId", "contactFirstName", "contactLastName", "contactEmail", "contactPhone", "contactJobTitle", "contactLinkedinUrl", "updatedAt"')
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
      updatedAt: row.updatedAt ?? company.updatedAt ?? null,
    })
  }
  for (const r of speakers) {
    out.push({
      relationship: 'Speaker', table: 'speakers', id: r.id, recordId: r.id, event: s(r.event), company: s(r.organization), firstName: s(r.firstName), lastName: s(r.lastName),
      email: s(r.email)?.toLowerCase() ?? null, phone: s(r.phone), jobTitle: s(r.jobTitle), linkedinUrl: s(r.linkedinUrl), status: r.status ?? null,
      selfDeclared: s(r.subType), paid: false, firmographic: firmographicByRule('Speaker', false), country: s(r.country), updatedAt: r.updatedAt ?? null,
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
      selfDeclared: declared, paid: isPaid, firmographic: firm, country: s(r.country), updatedAt: r.updatedAt ?? null,
    })
  }
  return out
}
