import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rows } = body as { rows: Record<string, string>[] }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 })
    }

    const stats = {
      total: rows.length,
      imported: 0,
      duplicates: 0,
      companiesCreated: 0,
      errors: 0,
    }

    const companyCache = new Map<string, string>()

    for (const row of rows) {
      try {
        const firstName = row.first_name?.trim() || row.firstName?.trim() || ''
        const lastName = row.last_name?.trim() || row.lastName?.trim() || ''
        const email = row.email?.trim().toLowerCase() || null
        const jobTitle = row.job_title?.trim() || row.title?.trim() || row.jobTitle?.trim() || ''
        const companyName = row.company?.trim() || row.company_name?.trim() || row.companyName?.trim() || ''

        if (!firstName && !lastName) { stats.errors++; continue }

        // Deduplicate by email
        if (email) {
          const { data: existing } = await supabase.from('contacts').select('id').eq('email', email).limit(1).single()
          if (existing) { stats.duplicates++; continue }
        }

        // Find or create company
        let companyId: string | undefined
        if (companyName) {
          if (companyCache.has(companyName.toLowerCase())) {
            companyId = companyCache.get(companyName.toLowerCase())
          } else {
            const { data: existing } = await supabase
              .from('companies')
              .select('id')
              .ilike('name', companyName)
              .limit(1)
              .single()

            if (existing) {
              companyId = existing.id
            } else {
              const { data: newCompany } = await supabase
                .from('companies')
                .insert({ name: companyName, companyType: 'Solution Provider' })
                .select('id')
                .single()
              if (newCompany) {
                companyId = newCompany.id
                stats.companiesCreated++
              }
            }
            if (companyId) companyCache.set(companyName.toLowerCase(), companyId)
          }
        }

        const { error } = await supabase.from('contacts').insert({
          firstName,
          lastName,
          email: email || undefined,
          phone: row.phone?.trim() || undefined,
          linkedinUrl: row.linkedin_url?.trim() || row.linkedin?.trim() || undefined,
          jobTitle,
          companyName: companyName || undefined,
          companyId: companyId || undefined,
          country: row.country?.trim() || undefined,
          city: row.city?.trim() || undefined,
          engagementScore: 0,
        })

        if (!error) stats.imported++
        else stats.errors++
      } catch (err) {
        console.error('Row import error:', err)
        stats.errors++
      }
    }

    return NextResponse.json({ success: true, stats })
  } catch (error) {
    console.error('Import API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
