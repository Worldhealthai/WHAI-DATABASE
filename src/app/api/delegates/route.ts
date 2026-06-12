import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { DelegateFilters } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '25'), 100)
    const sortBy = searchParams.get('sortBy') ?? 'createdAt'
    const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc'

    const filters: DelegateFilters = {
      query: searchParams.get('query') ?? undefined,
      statuses: searchParams.getAll('statuses').filter(Boolean),
      events: searchParams.getAll('events').filter(Boolean),
      subTypes: searchParams.getAll('subTypes').filter(Boolean),
      ticketTypes: searchParams.getAll('ticketTypes').filter(Boolean),
      countries: searchParams.getAll('countries').filter(Boolean),
      tags: searchParams.getAll('tags').filter(Boolean),
      sources: searchParams.getAll('sources').filter(Boolean),
    }

    let query = supabase
      .from('delegates')
      .select('*', { count: 'exact' })

    if (filters.query) {
      query = query.or(
        `firstName.ilike.%${filters.query}%,lastName.ilike.%${filters.query}%,email.ilike.%${filters.query}%,organization.ilike.%${filters.query}%,jobTitle.ilike.%${filters.query}%`
      )
    }
    if (filters.statuses?.length) query = query.in('status', filters.statuses)
    if (filters.events?.length) query = query.in('event', filters.events)
    if (filters.subTypes?.length) query = query.in('subType', filters.subTypes)
    if (filters.ticketTypes?.length) query = query.in('ticketType', filters.ticketTypes)
    if (filters.countries?.length) query = query.in('country', filters.countries)
    if (filters.sources?.length) query = query.in('source', filters.sources)
    if (filters.tags?.length) {
      query = query.or(filters.tags.map((t) => `tags.ilike.%${t}%`).join(','))
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
    console.error('Delegates API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await supabase
      .from('delegates')
      .insert(body)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'This delegate already exists in your CRM — duplicate entries are not allowed.' },
        { status: 409 },
      )
    }
    console.error('Delegates POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
