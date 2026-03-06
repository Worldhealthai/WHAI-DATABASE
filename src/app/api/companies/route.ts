import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildCompanyWhere } from '@/lib/search'
import type { CompanyFilters } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '25'), 100)
    const sortBy = searchParams.get('sortBy') ?? 'name'
    const sortDir = (searchParams.get('sortDir') ?? 'asc') as 'asc' | 'desc'

    const filters: CompanyFilters = {
      query: searchParams.get('query') ?? undefined,
      companyTypes: searchParams.getAll('companyTypes') as any,
      ownershipStatus: searchParams.getAll('ownershipStatus') as any,
      verticalIds: searchParams.getAll('verticalIds'),
      therapeuticAreaIds: searchParams.getAll('therapeuticAreaIds'),
      countries: searchParams.getAll('countries'),
      cities: searchParams.getAll('cities'),
      employeeRanges: searchParams.getAll('employeeRanges') as any,
      revenueRanges: searchParams.getAll('revenueRanges') as any,
      foundedYearMin: searchParams.has('foundedYearMin')
        ? parseInt(searchParams.get('foundedYearMin')!)
        : undefined,
      foundedYearMax: searchParams.has('foundedYearMax')
        ? parseInt(searchParams.get('foundedYearMax')!)
        : undefined,
      hasContacts: searchParams.get('hasContacts') === 'true' || undefined,
      hasRecentDeals: searchParams.get('hasRecentDeals') === 'true' || undefined,
      tags: searchParams.getAll('tags'),
    }

    for (const key of Object.keys(filters) as (keyof CompanyFilters)[]) {
      if (Array.isArray(filters[key]) && (filters[key] as unknown[]).length === 0) {
        delete filters[key]
      }
    }

    const where = buildCompanyWhere(filters)
    const orderBy: Record<string, 'asc' | 'desc'> = { [sortBy]: sortDir }

    const [total, data] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          verticals: {
            include: { vertical: { select: { id: true, name: true, slug: true } } },
            where: { is_primary: true },
            take: 3,
          },
          therapeutic_areas: {
            include: { therapeutic_area: { select: { id: true, name: true } } },
            take: 3,
          },
          _count: {
            select: {
              contacts: true,
              deals_as_acquirer: true,
              deals_as_target: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Companies API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
