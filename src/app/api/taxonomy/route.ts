import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Returns distinct taxonomy values derived from actual data
// Cached at edge for performance

export const revalidate = 3600 // 1 hour

export async function GET() {
  try {
    const [verticals, therapeuticAreas, companyTypes, dealTypes] = await Promise.all([
      // Distinct vertical slugs from CompanyVertical
      prisma.companyVertical.findMany({
        distinct: ['verticalSlug'],
        select: { verticalSlug: true },
        orderBy: { verticalSlug: 'asc' },
      }),
      // Distinct therapeutic areas from CompanyTherapeuticArea
      prisma.companyTherapeuticArea.findMany({
        distinct: ['therapeuticArea'],
        select: { therapeuticArea: true },
        orderBy: { therapeuticArea: 'asc' },
      }),
      // Distinct company types
      prisma.company.findMany({
        distinct: ['companyType'],
        select: { companyType: true },
        where: { companyType: { not: null } },
        orderBy: { companyType: 'asc' },
      }),
      // Distinct deal types
      prisma.deal.findMany({
        distinct: ['dealType'],
        select: { dealType: true },
        where: { dealType: { not: null } },
        orderBy: { dealType: 'asc' },
      }),
    ])

    return NextResponse.json({
      verticals: verticals.map((v) => v.verticalSlug),
      therapeuticAreas: therapeuticAreas.map((t) => t.therapeuticArea),
      companyTypes: companyTypes.map((c) => c.companyType),
      dealTypes: dealTypes.map((d) => d.dealType),
    })
  } catch (error) {
    console.error('Taxonomy API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
