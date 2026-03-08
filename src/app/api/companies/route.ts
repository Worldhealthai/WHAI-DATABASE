import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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
      companyTypes: searchParams.getAll('companyTypes').filter(Boolean),
      ownershipStatus: searchParams.getAll('ownershipStatus').filter(Boolean),
      verticalIds: searchParams.getAll('verticalIds').filter(Boolean),
      therapeuticAreaIds: searchParams.getAll('therapeuticAreaIds').filter(Boolean),
      countries: searchParams.getAll('countries').filter(Boolean),
      cities: searchParams.getAll('cities').filter(Boolean),
      employeeRanges: searchParams.getAll('employeeRanges').filter(Boolean),
      revenueRanges: searchParams.getAll('revenueRanges').filter(Boolean),
      foundedYearMin: searchParams.has('foundedYearMin') ? parseInt(searchParams.get('foundedYearMin')!) : undefined,
      foundedYearMax: searchParams.has('foundedYearMax') ? parseInt(searchParams.get('foundedYearMax')!) : undefined,
      tags: searchParams.getAll('tags').filter(Boolean),
    }

    // Pre-filter by vertical/therapeutic area
    let companyIdFilter: string[] | undefined
    if (filters.verticalIds?.length || filters.therapeuticAreaIds?.length) {
      let ids: string[] = []
      let initialized = false

      if (filters.verticalIds?.length) {
        const { data } = await supabase.from('company_verticals').select('companyId').in('verticalSlug', filters.verticalIds)
        ids = data?.map((v: any) => v.companyId) ?? []
        initialized = true
      }

      if (filters.therapeuticAreaIds?.length) {
        const { data } = await supabase.from('company_therapeutic_areas').select('companyId').in('therapeuticArea', filters.therapeuticAreaIds)
        const taIds = new Set(data?.map((t: any) => t.companyId) ?? [])
        ids = initialized ? ids.filter(id => taIds.has(id)) : [...taIds]
      }

      companyIdFilter = ids
    }

    let query = supabase
      .from('companies')
      .select('*, verticals:company_verticals(id, verticalSlug, isPrimary), therapeuticAreas:company_therapeutic_areas(id, therapeuticArea)', { count: 'exact' })

    if (filters.query) {
      query = query.or(`name.ilike.%${filters.query}%,description.ilike.%${filters.query}%,legalName.ilike.%${filters.query}%`)
    }

    if (filters.companyTypes?.length) query = query.in('companyType', filters.companyTypes)
    if (filters.ownershipStatus?.length) query = query.in('ownershipStatus', filters.ownershipStatus)
    if (filters.countries?.length) query = query.in('headquartersCountry', filters.countries)
    if (filters.cities?.length) query = query.in('headquartersCity', filters.cities)
    if (filters.employeeRanges?.length) query = query.in('employeeCountRange', filters.employeeRanges)
    if (filters.revenueRanges?.length) query = query.in('annualRevenueRange', filters.revenueRanges)
    if (filters.foundedYearMin !== undefined) query = query.gte('foundedYear', filters.foundedYearMin)
    if (filters.foundedYearMax !== undefined) query = query.lte('foundedYear', filters.foundedYearMax)

    if (companyIdFilter !== undefined) {
      if (companyIdFilter.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize, totalPages: 0 })
      }
      query = query.in('id', companyIdFilter)
    }

    if (filters.tags?.length) {
      query = query.or(filters.tags.map(t => `tags.ilike.%${t}%`).join(','))
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, count, error } = await query
      .order(sortBy, { ascending: sortDir === 'asc' })
      .range(from, to)

    if (error) throw error

    const total = count ?? 0
    return NextResponse.json({
      data: data ?? [],
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
