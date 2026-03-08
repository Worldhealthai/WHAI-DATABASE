import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('*, verticals:company_verticals(*), therapeuticAreas:company_therapeutic_areas(*)')
      .eq('id', params.id)
      .single()

    if (error || !company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [contactsRes, dealsRes, investorDealsRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('*')
        .eq('companyId', params.id)
        .order('engagementScore', { ascending: false })
        .limit(20),
      supabase
        .from('deals')
        .select('*, acquirerCompany:companies!deals_acquirerCompanyId_fkey(id, name), targetCompany:companies!deals_targetCompanyId_fkey(id, name)')
        .or(`acquirerCompanyId.eq.${params.id},targetCompanyId.eq.${params.id}`)
        .order('announcedDate', { ascending: false })
        .limit(10),
      supabase
        .from('deal_investors')
        .select('dealId')
        .eq('investorCompanyId', params.id),
    ])

    // Merge investor deals with direct deals
    let deals = dealsRes.data ?? []
    const existingDealIds = new Set(deals.map(d => d.id))
    const investorDealIds = (investorDealsRes.data ?? [])
      .map((i: any) => i.dealId)
      .filter((id: string) => !existingDealIds.has(id))

    if (investorDealIds.length > 0) {
      const { data: extraDeals } = await supabase
        .from('deals')
        .select('*, acquirerCompany:companies!deals_acquirerCompanyId_fkey(id, name), targetCompany:companies!deals_targetCompanyId_fkey(id, name)')
        .in('id', investorDealIds)
        .order('announcedDate', { ascending: false })
        .limit(10)
      deals = [...deals, ...(extraDeals ?? [])]
    }

    return NextResponse.json({ company, contacts: contactsRes.data ?? [], deals })
  } catch (error) {
    console.error('Company detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
