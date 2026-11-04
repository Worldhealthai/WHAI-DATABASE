// A person into Sales for an edition, as their company's contact (November
// 2026): they join the company's sponsor record for that edition when it has
// one (unless they are already on it), else the company is added at Not
// Contacted with them as its contact. Returns the company record.
import { supabase } from '@/lib/supabase'

const esc = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export interface SalesPerson {
  firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null
  jobTitle?: string | null; linkedinUrl?: string | null
}

export async function addToSales(opts: {
  company: string; event: string; person: SalesPerson
  website?: string | null; country?: string | null; city?: string | null; tags?: string | null; notes?: string | null
}): Promise<{ id: string; created: 'company' | 'contact' | 'none' }> {
  const name = opts.company.trim()
  const email = opts.person.email ? opts.person.email.toLowerCase() : null
  const contact = {
    contactFirstName: opts.person.firstName ?? null, contactLastName: opts.person.lastName ?? null, contactEmail: email,
    contactPhone: opts.person.phone ?? null, contactJobTitle: opts.person.jobTitle ?? null, contactLinkedinUrl: opts.person.linkedinUrl ?? null,
  }
  const { data: rows, error } = await supabase.from('sponsors').select('id, "contactEmail", "contactFirstName", "contactLastName"')
    .ilike('companyName', esc(name)).eq('event', opts.event).is('companyId', null).limit(1)
  if (error) throw error
  const company = rows?.[0]
  if (company) {
    const same = (email && String(company.contactEmail || '').toLowerCase() === email) ||
      (!email && `${company.contactFirstName ?? ''} ${company.contactLastName ?? ''}`.trim().toLowerCase() === `${contact.contactFirstName ?? ''} ${contact.contactLastName ?? ''}`.trim().toLowerCase())
    const { data: dup } = email ? await supabase.from('sponsors').select('id').eq('companyId', company.id).ilike('contactEmail', esc(email)).limit(1) : { data: [] as { id: string }[] }
    if (same || dup?.length) return { id: company.id, created: 'none' }
    const { error: e } = await supabase.from('sponsors').insert({ companyId: company.id, companyName: name, event: opts.event, status: 'Active', tags: opts.tags ?? null, notes: opts.notes ?? null, ...contact })
    if (e) throw e
    return { id: company.id, created: 'contact' }
  }
  const { data, error: e } = await supabase.from('sponsors').insert({
    companyName: name, website: opts.website ?? null, country: opts.country ?? null, city: opts.city ?? null,
    event: opts.event, status: 'Not Contacted', tags: opts.tags ?? null, notes: opts.notes ?? null, ...contact,
  }).select('id').single()
  if (e) throw e
  return { id: data.id, created: 'company' }
}
