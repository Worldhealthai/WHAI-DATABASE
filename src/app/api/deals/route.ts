import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeeded } from '@/lib/auto-seed'
import { buildDealWhere } from '@/lib/search'
import type { DealFilters } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded()
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '25'), 100)
    const sortBy = searchParams.get('sortBy') ?? 'announcedDate'
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
          acquirerCompany: { select: { id: true, name: true } },
          targetCompany: { select: { id: true, name: true } },
          investors: {
            select: {
              id: true,
              investorCompanyName: true,
              investorCompanyId: true,
              investorRole: true,
              investorCompany: { select: { id: true, name: true } },
            },
            take: 3,
          },
        },
      }),
      // Summary stats
      prisma.deal.aggregate({
        where,
        _sum: { dealValueUsd: true },
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
        totalValueCents: stats._sum.dealValueUsd?.toString() ?? '0',
      },
    })
  } catch (error) {
    console.error('Deals API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
