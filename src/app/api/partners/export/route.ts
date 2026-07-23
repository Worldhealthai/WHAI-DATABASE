import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Returns CSV of all sponsor companies + every linked contact.
// One row per contact. If a company has no linked contacts,
// it still gets one row (using the primary contact fields on the record).
// Query params (all optional):
//   ids        — comma-separated list of company IDs to restrict export
//   event      — filter by event
//   status     — filter by status
//   tier       — filter by tier
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []
    // Multi-select filters arrive as repeated params (status=A&status=B) —
    // reading only the first value silently dropped every other selection
    // from the export.
    const q = searchParams.get('query')?.trim() || ''
    const events = searchParams.getAll('event').filter(Boolean)
    const statuses = searchParams.getAll('status').filter(Boolean)
    const tiers = searchParams.getAll('tier').filter(Boolean)

    // ── Fetch all companies ───────────────────────────────────────────────
    let companyQuery = supabase
      .from('partners')
      .select('*')
      .is('companyId', null)
      .order('companyName', { ascending: true })
      .limit(10000)

    if (ids.length) companyQuery = companyQuery.in('id', ids)
    if (q) {
      const like = q.replace(/[\\%_]/g, '\\$&')
      companyQuery = companyQuery.or(
        `companyName.ilike.%${like}%,contactFirstName.ilike.%${like}%,contactLastName.ilike.%${like}%,contactEmail.ilike.%${like}%`
      )
    }
    if (events.length) companyQuery = companyQuery.in('event', events)
    if (statuses.length) companyQuery = companyQuery.in('status', statuses)
    if (tiers.length) companyQuery = companyQuery.in('tier', tiers)

    const { data: companies, error: companyError } = await companyQuery
    if (companyError) {
      return NextResponse.json({ error: companyError.message }, { status: 500 })
    }

    const companyIds = (companies ?? []).map((c: any) => c.id)

    // ── Fetch all linked contacts for these companies ──────────────────────
    let contactMap: Record<string, any[]> = {}
    if (companyIds.length) {
      const { data: contacts } = await supabase
        .from('partners')
        .select('*')
        .not('companyId', 'is', null)
        .in('companyId', companyIds)
        .order('createdAt', { ascending: true })
        .limit(10000)

      for (const c of contacts ?? []) {
        if (!contactMap[c.companyId]) contactMap[c.companyId] = []
        contactMap[c.companyId].push(c)
      }
    }

    // ── Build CSV rows ────────────────────────────────────────────────────
    const HEADER = [
      'Company', 'Website', 'Country', 'City', 'Event', 'Status', 'Tier',
      'Value', 'Contract Status', 'Tags', 'Notes',
      'Contact First Name', 'Contact Last Name', 'Contact Email',
      'Contact Phone', 'Contact Job Title', 'Contact LinkedIn',
    ]

    const rows: string[][] = []

    for (const co of companies ?? []) {
      const linkedContacts: any[] = contactMap[co.id] ?? []

      // Primary contact from the company record itself
      const primaryContact = {
        firstName: co.contactFirstName ?? '',
        lastName: co.contactLastName ?? '',
        email: co.contactEmail ?? '',
        phone: co.contactPhone ?? '',
        jobTitle: co.contactJobTitle ?? '',
        linkedin: co.contactLinkedinUrl ?? '',
      }

      // Collect all contacts to output (linked ones + primary if it has any data)
      const allContacts: typeof primaryContact[] = []

      if (linkedContacts.length > 0) {
        // Add primary contact first if it has data
        if (primaryContact.firstName || primaryContact.lastName || primaryContact.email) {
          allContacts.push(primaryContact)
        }
        // Add all linked contacts
        for (const lc of linkedContacts) {
          allContacts.push({
            firstName: lc.contactFirstName ?? '',
            lastName: lc.contactLastName ?? '',
            email: lc.contactEmail ?? '',
            phone: lc.contactPhone ?? '',
            jobTitle: lc.contactJobTitle ?? '',
            linkedin: lc.contactLinkedinUrl ?? '',
          })
        }
      } else {
        // No linked contacts — output one row with primary contact (even if empty)
        allContacts.push(primaryContact)
      }

      const value = co.valueAmount
        ? `${co.valueCurrency ?? 'GBP'} ${co.valueAmount}`
        : ''

      for (const contact of allContacts) {
        rows.push([
          co.companyName ?? '',
          co.website ?? '',
          co.country ?? '',
          co.city ?? '',
          co.event ?? '',
          co.status ?? '',
          co.tier ?? '',
          value,
          co.contractStatus ?? '',
          co.tags ?? '',
          co.notes ?? '',
          contact.firstName,
          contact.lastName,
          contact.email,
          contact.phone,
          contact.jobTitle,
          contact.linkedin,
        ])
      }
    }

    const csv = [HEADER, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="partners-export.csv"',
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
