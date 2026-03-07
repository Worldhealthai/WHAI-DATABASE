import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// CSV Import endpoint
// POST /api/import — accepts { rows: object[] }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rows } = body as {
      rows: Record<string, string>[]
    }

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

    // Company cache to avoid duplicates within batch
    const companyCache = new Map<string, string>()

    for (const row of rows) {
      try {
        const firstName = row.first_name?.trim() || row.firstName?.trim() || ''
        const lastName = row.last_name?.trim() || row.lastName?.trim() || ''
        const email = row.email?.trim().toLowerCase() || null
        const jobTitle = row.job_title?.trim() || row.title?.trim() || row.jobTitle?.trim() || ''
        const companyName = row.company?.trim() || row.company_name?.trim() || row.companyName?.trim() || ''

        if (!firstName && !lastName) { stats.errors++; continue }

        // Deduplicate: try email first, then name + company
        if (email) {
          const existing = await prisma.contact.findUnique({ where: { email } })
          if (existing) { stats.duplicates++; continue }
        } else {
          const existing = await prisma.contact.findFirst({
            where: {
              firstName: { equals: firstName, mode: 'insensitive' },
              lastName: { equals: lastName, mode: 'insensitive' },
              company: { name: { equals: companyName, mode: 'insensitive' } },
            },
          })
          if (existing) { stats.duplicates++; continue }
        }

        // Find or create company
        let companyId: string | undefined
        if (companyName) {
          if (companyCache.has(companyName.toLowerCase())) {
            companyId = companyCache.get(companyName.toLowerCase())
          } else {
            const existingCompany = await prisma.company.findFirst({
              where: { name: { equals: companyName, mode: 'insensitive' } },
            })
            if (existingCompany) {
              companyId = existingCompany.id
            } else {
              const newCompany = await prisma.company.create({
                data: {
                  name: companyName,
                  companyType: 'SOLUTION_PROVIDER',
                },
              })
              companyId = newCompany.id
              stats.companiesCreated++
            }
            companyCache.set(companyName.toLowerCase(), companyId!)
          }
        }

        await prisma.contact.create({
          data: {
            firstName: firstName,
            lastName: lastName,
            email: email || undefined,
            phone: row.phone?.trim() || undefined,
            linkedinUrl: row.linkedin_url?.trim() || row.linkedin?.trim() || undefined,
            jobTitle: jobTitle,
            companyName: companyName || undefined,
            companyId: companyId,
            country: row.country?.trim() || undefined,
            city: row.city?.trim() || undefined,
            engagementScore: 0,
          },
        })
        stats.imported++
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
