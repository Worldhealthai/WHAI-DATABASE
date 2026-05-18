import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { SponsorFilters } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '25'), 100)
    const sortBy = searchParams.get('sortBy') ?? 'createdAt'
    const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc'

    const filters: SponsorFilters = {
      query: searchParams.get('query') ?? undefined,
      statuses: searchParams.getAll('statuses').filter(Boolean),
      events: searchParams.getAll('events').filter(Boolean),
      tiers: searchParams.getAll('tiers').filter(Boolean),
      contractStatuses: searchParams.getAll('contractStatuses').filter(Boolean),
      countries: searchParams.getAll('countries').filter(Boolean),
      tags: searchParams.getAll('tags').filter(Boolean),
    }

    const excludeTiers = searchParams.getAll('excludeTiers').filter(Boolean)

    let query = supabase
      .from('sponsors')
      .select('*', { count: 'exact' })
      .is('companyId', null)

    if (filters.query) {
      const q = filters.query

      // Also search linked contacts — find their parent company IDs
      const { data: linkedMatches } = await supabase
        .from('sponsors')
        .select('companyId')
        .not('companyId', 'is', null)
        .or(`contactFirstName.ilike.%${q}%,contactLastName.ilike.%${q}%,contactEmail.ilike.%${q}%,contactJobTitle.ilike.%${q}%`)

      const parentIds = [...new Set((linkedMatches ?? []).map((c: any) => c.companyId).filter(Boolean))]

      // Build OR: match company-level fields OR be a parent of a matching linked contact
      const companyFieldMatch = `companyName.ilike.%${q}%,contactFirstName.ilike.%${q}%,contactLastName.ilike.%${q}%,contactEmail.ilike.%${q}%,contactJobTitle.ilike.%${q}%`
      if (parentIds.length > 0) {
        query = query.or(`${companyFieldMatch},id.in.(${parentIds.join(',')})`)
      } else {
        query = query.or(companyFieldMatch)
      }
    }
    if (filters.statuses?.length) query = query.in('status', filters.statuses)
    if (filters.events?.length) query = query.in('event', filters.events)
    if (filters.tiers?.length) query = query.in('tier', filters.tiers)
    if (excludeTiers.length) {
      // Include rows where tier IS NULL (untiered sponsors) OR tier is not one of the excluded values
      query = query.or(`tier.is.null,not.tier.in.(${excludeTiers.map((t) => `"${t}"`).join(',')})`)
    }
    if (filters.contractStatuses?.length) query = query.in('contractStatus', filters.contractStatuses)
    if (filters.countries?.length) query = query.in('country', filters.countries)
    if (filters.tags?.length) {
      query = query.or(filters.tags.map((t) => `tags.ilike.%${t}%`).join(','))
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, count, error } = await query
      .order(sortBy, { ascending: sortDir === 'asc' })
      .range(from, to)

    if (error) throw error

    // Fetch contact counts for the returned companies
    const companyIds = (data ?? []).map((s: any) => s.id)
    let contactCounts: Record<string, number> = {}
    if (companyIds.length) {
      const { data: contacts } = await supabase
        .from('sponsors')
        .select('companyId')
        .in('companyId', companyIds)
      if (contacts) {
        contacts.forEach((c: any) => {
          if (c.companyId) contactCounts[c.companyId] = (contactCounts[c.companyId] ?? 0) + 1
        })
      }
    }

    const enriched = (data ?? []).map((s: any) => ({ ...s, contactCount: contactCounts[s.id] ?? 0 }))

    const total = count ?? 0
    return NextResponse.json({
      data: enriched,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Sponsors API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await supabase
      .from('sponsors')
      .insert(body)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Sponsors POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
