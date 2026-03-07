import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildContactWhere } from '@/lib/search'
import type { ContactFilters } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '25'), 100)
    const sortBy = searchParams.get('sortBy') ?? 'createdAt'
    const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc'

    const filters: ContactFilters = {
      query: searchParams.get('query') ?? undefined,
      companyTypes: searchParams.getAll('companyTypes'),
      verticalSlugs: searchParams.getAll('verticalSlugs'),
      therapeuticAreas: searchParams.getAll('therapeuticAreas'),
      countries: searchParams.getAll('countries'),
      cities: searchParams.getAll('cities'),
      tags: searchParams.getAll('tags'),
      engagementMin: searchParams.has('engagementMin')
        ? parseInt(searchParams.get('engagementMin')!)
        : undefined,
      engagementMax: searchParams.has('engagementMax')
        ? parseInt(searchParams.get('engagementMax')!)
        : undefined,
    }

    // Remove empty arrays
    for (const key of Object.keys(filters) as (keyof ContactFilters)[]) {
      if (Array.isArray(filters[key]) && (filters[key] as unknown[]).length === 0) {
        delete filters[key]
      }
    }

    const where = buildContactWhere(filters)

    const orderBy: Record<string, 'asc' | 'desc'> = { [sortBy]: sortDir }

    const [total, data] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              companyType: true,
              headquartersCity: true,
              headquartersCountry: true,
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
    console.error('Contacts API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
