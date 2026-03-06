import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildDealWhere } from '@/lib/search'
import type { DealFilters } from '@/types'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '25'), 100)
    const sortBy = searchParams.get('sortBy') ?? 'announced_date'
    const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc'

    const filters: DealFilters = {
      query: searchParams.get('query') ?? undefined,
      dealTypes: searchParams.getAll('dealTypes') as any,
      dealStages: searchParams.getAll('dealStages') as any,
      valueMin: searchParams.has('valueMin') ? parseInt(searchParams.get('valueMin')!) : undefined,
      valueMax: searchParams.has('valueMax') ? parseInt(searchParams.get('valueMax')!) : undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      acquirerQuery: searchParams.get('acquirerQuery') ?? undefined,
      targetQuery: searchParams.get('targetQuery') ?? undefined,
      investorQuery: searchParams.get('investorQuery') ?? undefined,
      verticalIds: searchParams.getAll('verticalIds'),
      countries: searchParams.getAll('countries'),
      valueDisclosed: searchParams.has('valueDisclosed')
        ? searchParams.get('valueDisclosed') === 'true'
        : undefined,
    }

    for (const key of Object.keys(filters) as (keyof DealFilters)[]) {
      if (Array.isArray(filters[key]) && (filters[key] as unknown[]).length === 0) {
        delete filters[key]
      }
    }

    const where = buildDealWhere(filters)
    const orderBy: Record<string, 'asc' | 'desc'> = { [sortBy]: sortDir }

    const [total, data, stats] = await Promise.all([
      prisma.deal.count({ where }),
      prisma.deal.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          acquirer_company: { select: { id: true, name: true, logo_url: true } },
          target_company: { select: { id: true, name: true, logo_url: true } },
          verticals: {
            include: { vertical: { select: { id: true, name: true } } },
            take: 3,
          },
          investors: {
            include: { company: { select: { id: true, name: true } } },
            take: 3,
          },
        },
      }),
      // Summary stats
      prisma.deal.aggregate({
        where,
        _sum: { deal_value_usd: true },
        _count: { id: true },
      }),
    ])

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats: {
        totalDeals: stats._count.id,
        totalValueCents: stats._sum.deal_value_usd?.toString() ?? '0',
      },
    })
  } catch (error) {
    console.error('Deals API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
