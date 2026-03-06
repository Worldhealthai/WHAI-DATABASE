import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildContactWhere } from '@/lib/search'
import type { ContactFilters } from '@/types'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '25'), 100)
    const sortBy = searchParams.get('sortBy') ?? 'created_at'
    const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc'

    const filters: ContactFilters = {
      query: searchParams.get('query') ?? undefined,
      seniority: searchParams.getAll('seniority') as any,
      department: searchParams.getAll('department') as any,
      jobFunctionIds: searchParams.getAll('jobFunctionIds'),
      companyTypes: searchParams.getAll('companyTypes') as any,
      verticalIds: searchParams.getAll('verticalIds'),
      therapeuticAreaIds: searchParams.getAll('therapeuticAreaIds'),
      regionIds: searchParams.getAll('regionIds'),
      countries: searchParams.getAll('countries'),
      cities: searchParams.getAll('cities'),
      tags: searchParams.getAll('tags'),
      engagementMin: searchParams.has('engagementMin')
        ? parseInt(searchParams.get('engagementMin')!)
        : undefined,
      engagementMax: searchParams.has('engagementMax')
        ? parseInt(searchParams.get('engagementMax')!)
        : undefined,
      isVerified: searchParams.has('isVerified')
        ? searchParams.get('isVerified') === 'true'
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
              company_type: true,
              logo_url: true,
              headquarters_city: true,
              headquarters_country: true,
            },
          },
          job_function: { select: { id: true, name: true } },
          region: { select: { id: true, name: true } },
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
