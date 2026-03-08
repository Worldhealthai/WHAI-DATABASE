import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        *,
        acquirerCompany:companies!deals_acquirerCompanyId_fkey(
          *, verticals:company_verticals(id, verticalSlug, isPrimary),
          therapeuticAreas:company_therapeutic_areas(id, therapeuticArea)
        ),
        targetCompany:companies!deals_targetCompanyId_fkey(
          *, verticals:company_verticals(id, verticalSlug, isPrimary),
          therapeuticAreas:company_therapeutic_areas(id, therapeuticArea)
        ),
        investors:deal_investors(*, investorCompany:companies(id, name, companyType, headquartersCountry, headquartersCity))
      `)
      .eq('id', params.id)
      .single()

    if (error || !deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Related deals (same companies)
    const orConditions: string[] = []
    if (deal.acquirerCompanyId) orConditions.push(`acquirerCompanyId.eq.${deal.acquirerCompanyId}`)
    if (deal.targetCompanyId) orConditions.push(`targetCompanyId.eq.${deal.targetCompanyId}`)

    let relatedDeals: any[] = []
    if (orConditions.length > 0) {
      const { data } = await supabase
        .from('deals')
        .select('*, acquirerCompany:companies!deals_acquirerCompanyId_fkey(name), targetCompany:companies!deals_targetCompanyId_fkey(name)')
        .neq('id', deal.id)
        .or(orConditions.join(','))
        .order('announcedDate', { ascending: false })
        .limit(5)
      relatedDeals = data ?? []
    }

    // Key contacts at involved companies
    const companyIds: string[] = []
    if (deal.acquirerCompanyId) companyIds.push(deal.acquirerCompanyId)
    if (deal.targetCompanyId) companyIds.push(deal.targetCompanyId)

    let keyContacts: any[] = []
    if (companyIds.length > 0) {
      const { data } = await supabase
        .from('contacts')
        .select('id, firstName, lastName, jobTitle, seniority, department, companyId, company:companies(id, name)')
        .in('companyId', companyIds)
        .in('seniority', ['C-Suite', 'VP', 'Board', 'Director'])
        .order('engagementScore', { ascending: false })
        .limit(8)
      keyContacts = data ?? []
    }

    return NextResponse.json({ deal, relatedDeals, keyContacts })
  } catch (error) {
    console.error('Deal detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
