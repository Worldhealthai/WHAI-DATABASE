import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildInsightWhere } from '@/lib/search'

export const dynamic = 'force-dynamic'
import type { InsightFilters } from '@/types'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '12'), 100)
    const sortBy = searchParams.get('sortBy') ?? 'published_at'
    const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc'

    const filters: InsightFilters = {
      query: searchParams.get('query') ?? undefined,
      contentTypes: searchParams.getAll('contentTypes') as any,
      verticalIds: searchParams.getAll('verticalIds'),
      therapeuticAreaIds: searchParams.getAll('therapeuticAreaIds'),
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      isPremium: searchParams.has('isPremium')
        ? searchParams.get('isPremium') === 'true'
        : undefined,
    }

    for (const key of Object.keys(filters) as (keyof InsightFilters)[]) {
      if (Array.isArray(filters[key]) && (filters[key] as unknown[]).length === 0) {
        delete filters[key]
      }
    }

    const where = buildInsightWhere(filters)
    const orderBy: Record<string, 'asc' | 'desc'> = { [sortBy]: sortDir }

    const [total, data] = await Promise.all([
      prisma.insight.count({ where }),
      prisma.insight.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          verticals: {
            include: { vertical: { select: { id: true, name: true } } },
            take: 3,
          },
          therapeutic_areas: {
            include: { therapeutic_area: { select: { id: true, name: true } } },
            take: 3,
          },
        },
      }),
    ])

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (error) {
    console.error('Insights API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
