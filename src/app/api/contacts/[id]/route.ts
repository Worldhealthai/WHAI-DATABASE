import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*, company:companies(*, verticals:company_verticals(*), therapeuticAreas:company_therapeutic_areas(*))')
      .eq('id', params.id)
      .single()

    if (error || !contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Fetch related contacts at same company
    let relatedContacts: any[] = []
    if (contact.companyId) {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('companyId', contact.companyId)
        .neq('id', contact.id)
        .order('engagementScore', { ascending: false })
        .limit(6)
      relatedContacts = data ?? []
    }

    // Fetch deals involving their company
    let relatedDeals: any[] = []
    if (contact.companyId) {
      const { data } = await supabase
        .from('deals')
        .select('*, acquirerCompany:companies!deals_acquirerCompanyId_fkey(name), targetCompany:companies!deals_targetCompanyId_fkey(name)')
        .or(`acquirerCompanyId.eq.${contact.companyId},targetCompanyId.eq.${contact.companyId}`)
        .order('announcedDate', { ascending: false })
        .limit(5)
      relatedDeals = data ?? []
    }

    return NextResponse.json({ contact, relatedContacts, relatedDeals })
  } catch (error) {
    console.error('Contact detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
