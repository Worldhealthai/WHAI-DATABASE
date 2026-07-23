import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST body: { rows: SponsorRow[], event?: string }
// Each row: { companyName, website?, country?, city?, tier?, status?, event?,
//             contactFirstName?, contactLastName?, contactEmail?, contactPhone?,
//             contactJobTitle?, contactLinkedinUrl?, notes?, tags? }
// Groups rows by companyName, creates one company record per unique company
// (or finds an existing one), then inserts contacts linked via companyId.

interface SponsorRow {
  companyName?: string
  website?: string
  country?: string
  city?: string
  tier?: string
  status?: string
  event?: string
  contactFirstName?: string
  contactLastName?: string
  contactEmail?: string
  contactPhone?: string
  contactJobTitle?: string
  contactLinkedinUrl?: string
  notes?: string
  tags?: string
}

export async function POST(req: NextRequest) {
  try {
    const { rows, event }: { rows: SponsorRow[]; event?: string | null } = await req.json()

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    // Group rows by company name (case-insensitive key, preserve original casing)
    const groupMap = new Map<string, { canonical: string; rows: SponsorRow[] }>()
    for (const row of rows) {
      const raw = row.companyName?.trim() || ''
      const key = raw.toLowerCase()
      if (!groupMap.has(key)) {
        groupMap.set(key, { canonical: raw || '(Unknown Company)', rows: [] })
      }
      groupMap.get(key)!.rows.push(row)
    }

    // Fetch existing companies by name (case-insensitive)
    const companyNames = [...groupMap.keys()]
    const { data: existingCompanies } = await supabase
      .from('sponsors')
      .select('id, companyName')
      .is('companyId', null)
      .in('companyName', [...groupMap.values()].map((g) => g.canonical))

    const existingMap = new Map<string, string>() // lowercased name → id
    for (const c of existingCompanies ?? []) {
      existingMap.set(c.companyName?.toLowerCase() ?? '', c.id)
    }

    let companiesCreated = 0
    let contactsCreated = 0
    let contactsEnriched = 0

    for (const [key, group] of groupMap) {
      const firstRow = group.rows[0]
      const resolvedEvent = event || firstRow.event || null

      let companyId: string
      let isNewCompany = false

      if (existingMap.has(key)) {
        // Company already exists — use its id
        companyId = existingMap.get(key)!
      } else {
        // Create the company record
        const { data: newCompany, error: companyError } = await supabase
          .from('sponsors')
          .insert({
            companyName: group.canonical,
            website: firstRow.website || null,
            country: firstRow.country || null,
            city: firstRow.city || null,
            tier: firstRow.tier || null,
            status: firstRow.status || 'Not Contacted',
            event: resolvedEvent,
            notes: firstRow.notes || null,
            tags: firstRow.tags || null,
            companyId: null,
          })
          .select('id')
          .single()

        if (companyError || !newCompany) {
          console.error('Failed to create company:', group.canonical, companyError)
          continue
        }

        companyId = newCompany.id
        companiesCreated++
        isNewCompany = true
      }

      // Merge incoming contacts with what's already on the company so each
      // person ends up with the best of both records — e.g. the CRM knows
      // their phone number and the CSV brings their email. Matching is by
      // email first, then by first+last name; existing values are never
      // overwritten, only blanks are filled.
      const incoming = group.rows.filter((r) => r.contactFirstName || r.contactLastName || r.contactEmail)

      const emailKey = (e?: string | null) => (e ?? '').trim().toLowerCase()
      const nameKey = (f?: string | null, l?: string | null) => {
        const k = `${(f ?? '').trim().toLowerCase()}|${(l ?? '').trim().toLowerCase()}`
        return k === '|' ? '' : k
      }
      const samePerson = (a: any, b: any) => {
        const e1 = emailKey(a?.contactEmail), e2 = emailKey(b?.contactEmail)
        if (e1 && e2) return e1 === e2
        const n1 = nameKey(a?.contactFirstName, a?.contactLastName)
        const n2 = nameKey(b?.contactFirstName, b?.contactLastName)
        return !!n1 && n1 === n2
      }
      const CONTACT_FIELDS = [
        'contactFirstName', 'contactLastName', 'contactEmail',
        'contactPhone', 'contactJobTitle', 'contactLinkedinUrl',
      ] as const

      // Existing records for this company: its own primary-contact fields plus
      // every linked contact row. Freshly created companies have neither.
      let companyRecord: any = null
      let linkedContacts: any[] = []
      if (!isNewCompany) {
        const [p, l] = await Promise.all([
          supabase.from('sponsors').select('*').eq('id', companyId).single(),
          supabase.from('sponsors').select('*').eq('companyId', companyId),
        ])
        companyRecord = p.data ?? null
        linkedContacts = l.data ?? []

        // Fill blank company details from the import while we're here.
        if (companyRecord) {
          const patch: Record<string, any> = {}
          if (firstRow.website && !companyRecord.website) patch.website = firstRow.website
          if (firstRow.country && !companyRecord.country) patch.country = firstRow.country
          if (firstRow.city && !companyRecord.city) patch.city = firstRow.city
          if (resolvedEvent && !companyRecord.event) patch.event = resolvedEvent
          if (Object.keys(patch).length) {
            await supabase.from('sponsors').update(patch).eq('id', companyId)
          }
        }
      }

      const toInsert: any[] = []
      for (const r of incoming) {
        const existing =
          (companyRecord && samePerson(companyRecord, r) ? companyRecord : null) ||
          linkedContacts.find((c) => samePerson(c, r))

        if (existing) {
          const patch: Record<string, any> = {}
          for (const f of CONTACT_FIELDS) {
            const val = typeof (r as any)[f] === 'string' ? (r as any)[f].trim() : (r as any)[f]
            if (val && !existing[f]) patch[f] = val
          }
          if (Object.keys(patch).length) {
            const { error: updateError } = await supabase.from('sponsors').update(patch).eq('id', existing.id)
            if (!updateError) {
              Object.assign(existing, patch)
              contactsEnriched++
            }
          }
          continue
        }

        // Same person listed twice in the file — merge into the pending row.
        const pending = toInsert.find((c) => samePerson(c, r))
        if (pending) {
          for (const f of CONTACT_FIELDS) {
            if ((r as any)[f] && !pending[f]) pending[f] = (r as any)[f]
          }
          continue
        }

        toInsert.push({
          companyId,
          companyName: group.canonical,
          contactFirstName: r.contactFirstName || null,
          contactLastName: r.contactLastName || null,
          contactEmail: r.contactEmail || null,
          contactPhone: r.contactPhone || null,
          contactJobTitle: r.contactJobTitle || null,
          contactLinkedinUrl: r.contactLinkedinUrl || null,
          notes: r.notes || null,
          // Contact rows inherit company-level fields for completeness
          status: r.status || 'Not Contacted',
          event: event || r.event || null,
        })
      }

      if (toInsert.length > 0) {
        const { data: inserted, error: contactError } = await supabase
          .from('sponsors')
          .insert(toInsert)
          .select('id')

        if (contactError) {
          console.error('Failed to insert contacts for', group.canonical, contactError)
        } else {
          contactsCreated += inserted?.length ?? 0
        }
      }
    }

    return NextResponse.json({
      companies: companiesCreated,
      contacts: contactsCreated,
      contactsEnriched,
      existingCompaniesUpdated: companyNames.length - companiesCreated,
    })
  } catch (error) {
    console.error('Bulk import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
