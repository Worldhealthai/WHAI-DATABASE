import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { DealFilters } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '25'), 100)
    const sortBy = searchParams.get('sortBy') ?? 'announcedDate'
    const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc'

    const filters: DealFilters = {
      query: searchParams.get('query') ?? undefined,
      dealTypes: searchParams.getAll('dealTypes').filter(Boolean),
      dealStages: searchParams.getAll('dealStages').filter(Boolean),
      valueMin: searchParams.has('valueMin') ? parseInt(searchParams.get('valueMin')!) : undefined,
      valueMax: searchParams.has('valueMax') ? parseInt(searchParams.get('valueMax')!) : undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      acquirerQuery: searchParams.get('acquirerQuery') ?? undefined,
      targetQuery: searchParams.get('targetQuery') ?? undefined,
      investorQuery: searchParams.get('investorQuery') ?? undefined,
    }

    // Pre-filter by acquirer/target/investor company name
    let dealIdFilterByCompany: string[] | undefined

    if (filters.acquirerQuery || filters.targetQuery || filters.investorQuery) {
      let dealIds: Set<string> | undefined

      if (filters.acquirerQuery) {
        const { data } = await supabase.from('companies').select('id').ilike('name', `%${filters.acquirerQuery}%`)
        const compIds = data?.map((c: any) => c.id) ?? []
        if (compIds.length) {
          const { data: deals } = await supabase.from('deals').select('id').in('acquirerCompanyId', compIds)
          dealIds = new Set(deals?.map((d: any) => d.id) ?? [])
        } else {
          dealIds = new Set()
        }
      }

      if (filters.targetQuery) {
        const { data } = await supabase.from('companies').select('id').ilike('name', `%${filters.targetQuery}%`)
        const compIds = data?.map((c: any) => c.id) ?? []
        if (compIds.length) {
          const { data: deals } = await supabase.from('deals').select('id').in('targetCompanyId', compIds)
          const targetDealIds = new Set(deals?.map((d: any) => d.id) ?? [])
          dealIds = dealIds ? new Set([...dealIds].filter(id => targetDealIds.has(id))) : targetDealIds
        } else {
          dealIds = new Set()
        }
      }

      if (filters.investorQuery) {
        const { data } = await supabase.from('companies').select('id').ilike('name', `%${filters.investorQuery}%`)
        const compIds = data?.map((c: any) => c.id) ?? []
        if (compIds.length) {
          const { data: investors } = await supabase.from('deal_investors').select('dealId').in('investorCompanyId', compIds)
          const invDealIds = new Set(investors?.map((i: any) => i.dealId) ?? [])
          dealIds = dealIds ? new Set([...dealIds].filter(id => invDealIds.has(id))) : invDealIds
        } else {
          dealIds = new Set()
        }
      }

      dealIdFilterByCompany = dealIds ? [...dealIds] : []
    }

    let query = supabase
      .from('deals')
      .select(`
        *,
        acquirerCompany:companies!deals_acquirerCompanyId_fkey(id, name),
        targetCompany:companies!deals_targetCompanyId_fkey(id, name),
        investors:deal_investors(id, investorCompanyName, investorCompanyId, investorRole, investorCompany:companies(id, name))
      `, { count: 'exact' })

    if (filters.query) {
      query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`)
    }

    if (filters.dealTypes?.length) query = query.in('dealType', filters.dealTypes)
    if (filters.dealStages?.length) query = query.in('dealStage', filters.dealStages)
    if (filters.valueMin !== undefined) query = query.gte('dealValueUsd', filters.valueMin * 100)
    if (filters.valueMax !== undefined) query = query.lte('dealValueUsd', filters.valueMax * 100)
    if (filters.dateFrom) query = query.gte('announcedDate', filters.dateFrom)
    if (filters.dateTo) query = query.lte('announcedDate', filters.dateTo)

    if (dealIdFilterByCompany !== undefined) {
      if (dealIdFilterByCompany.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize, totalPages: 0, stats: { totalDeals: 0, totalValueCents: '0' } })
      }
      query = query.in('id', dealIdFilterByCompany)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, count, error } = await query
      .order(sortBy, { ascending: sortDir === 'asc' })
      .range(from, to)

    if (error) throw error

    const total = count ?? 0
    const totalValue = (data ?? []).reduce((sum: number, d: any) => sum + (Number(d.dealValueUsd) || 0), 0)

    return NextResponse.json({
      data: data ?? [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats: {
        totalDeals: total,
        totalValueCents: String(totalValue),
      },
    })
  } catch (error) {
    console.error('Deals API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
