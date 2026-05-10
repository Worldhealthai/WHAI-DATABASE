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

    for (const [key, group] of groupMap) {
      const firstRow = group.rows[0]
      const resolvedEvent = event || firstRow.event || null

      let companyId: string

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
            status: firstRow.status || 'Prospecting',
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
      }

      // Insert contacts for this company
      const contactRows = group.rows
        .filter((r) => r.contactFirstName || r.contactLastName || r.contactEmail)
        .map((r) => ({
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
          status: r.status || 'Prospecting',
          event: event || r.event || null,
        }))

      if (contactRows.length > 0) {
        const { data: inserted, error: contactError } = await supabase
          .from('sponsors')
          .insert(contactRows)
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
      existingCompaniesUpdated: companyNames.length - companiesCreated,
    })
  } catch (error) {
    console.error('Bulk import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
