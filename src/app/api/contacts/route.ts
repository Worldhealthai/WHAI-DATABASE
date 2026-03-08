import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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
      seniorities: searchParams.getAll('seniorities').filter(Boolean),
      departments: searchParams.getAll('departments').filter(Boolean),
      companyTypes: searchParams.getAll('companyTypes').filter(Boolean),
      verticalSlugs: searchParams.getAll('verticalSlugs').filter(Boolean),
      therapeuticAreas: searchParams.getAll('therapeuticAreas').filter(Boolean),
      countries: searchParams.getAll('countries').filter(Boolean),
      cities: searchParams.getAll('cities').filter(Boolean),
      tags: searchParams.getAll('tags').filter(Boolean),
      engagementMin: searchParams.has('engagementMin')
        ? parseInt(searchParams.get('engagementMin')!)
        : undefined,
      engagementMax: searchParams.has('engagementMax')
        ? parseInt(searchParams.get('engagementMax')!)
        : undefined,
    }

    // If filtering by company-level attributes, get matching company IDs first
    let companyIdFilter: string[] | undefined
    if (filters.companyTypes?.length || filters.verticalSlugs?.length || filters.therapeuticAreas?.length) {
      let companyIds: string[] = []
      let initialized = false

      if (filters.companyTypes?.length) {
        const { data } = await supabase.from('companies').select('id').in('companyType', filters.companyTypes)
        companyIds = data?.map((c: any) => c.id) ?? []
        initialized = true
      }

      if (filters.verticalSlugs?.length) {
        const { data } = await supabase.from('company_verticals').select('companyId').in('verticalSlug', filters.verticalSlugs)
        const ids = new Set(data?.map((v: any) => v.companyId) ?? [])
        companyIds = initialized ? companyIds.filter(id => ids.has(id)) : [...ids]
        initialized = true
      }

      if (filters.therapeuticAreas?.length) {
        const { data } = await supabase.from('company_therapeutic_areas').select('companyId').in('therapeuticArea', filters.therapeuticAreas)
        const ids = new Set(data?.map((t: any) => t.companyId) ?? [])
        companyIds = initialized ? companyIds.filter(id => ids.has(id)) : [...ids]
      }

      companyIdFilter = companyIds
    }

    // Build main query — fetch contacts WITHOUT embedded company join
    // (the join can silently fail if the FK relationship isn't detected)
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })

    if (filters.query) {
      query = query.or(`firstName.ilike.%${filters.query}%,lastName.ilike.%${filters.query}%,jobTitle.ilike.%${filters.query}%,bio.ilike.%${filters.query}%`)
    }

    if (filters.seniorities?.length) query = query.in('seniority', filters.seniorities)
    if (filters.departments?.length) query = query.in('department', filters.departments)
    if (filters.countries?.length) query = query.in('country', filters.countries)
    if (filters.cities?.length) query = query.in('city', filters.cities)
    if (filters.engagementMin !== undefined) query = query.gte('engagementScore', filters.engagementMin)
    if (filters.engagementMax !== undefined) query = query.lte('engagementScore', filters.engagementMax)

    if (companyIdFilter !== undefined) {
      if (companyIdFilter.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize, totalPages: 0 })
      }
      query = query.in('companyId', companyIdFilter)
    }

    if (filters.tags?.length) {
      query = query.or(filters.tags.map(t => `tags.ilike.%${t}%`).join(','))
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data: contacts, count, error } = await query
      .order(sortBy, { ascending: sortDir === 'asc' })
      .range(from, to)

    if (error) {
      console.error('Supabase contacts query error:', JSON.stringify(error))
      throw error
    }

    // Fetch companies separately for the returned contacts
    let contactsWithCompany = contacts ?? []
    if (contactsWithCompany.length > 0) {
      const companyIds = [...new Set(contactsWithCompany.map((c: any) => c.companyId).filter(Boolean))]
      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name, companyType, headquartersCity, headquartersCountry')
          .in('id', companyIds)

        if (companies) {
          const companyMap = new Map(companies.map((co: any) => [co.id, co]))
          contactsWithCompany = contactsWithCompany.map((c: any) => ({
            ...c,
            company: c.companyId ? companyMap.get(c.companyId) ?? null : null,
          }))
        }
      }
    }

    const total = count ?? 0
    return NextResponse.json({
      data: contactsWithCompany,
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
