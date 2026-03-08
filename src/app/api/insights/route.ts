import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { InsightFilters } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '12'), 100)
    const sortBy = searchParams.get('sortBy') ?? 'publishedAt'
    const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc'

    const filters: InsightFilters = {
      query: searchParams.get('query') ?? undefined,
      contentTypes: searchParams.getAll('contentTypes').filter(Boolean),
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      isPremium: searchParams.has('isPremium')
        ? searchParams.get('isPremium') === 'true'
        : undefined,
    }

    let query = supabase.from('insights').select('*', { count: 'exact' })

    if (filters.query) {
      query = query.or(`title.ilike.%${filters.query}%,summary.ilike.%${filters.query}%,body.ilike.%${filters.query}%`)
    }

    if (filters.contentTypes?.length) query = query.in('contentType', filters.contentTypes)
    if (filters.dateFrom) query = query.gte('publishedAt', filters.dateFrom)
    if (filters.dateTo) query = query.lte('publishedAt', filters.dateTo)
    if (filters.isPremium !== undefined) query = query.eq('isPremium', filters.isPremium)

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, count, error } = await query
      .order(sortBy, { ascending: sortDir === 'asc' })
      .range(from, to)

    if (error) throw error

    const total = count ?? 0
    return NextResponse.json({ data: data ?? [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (error) {
    console.error('Insights API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
