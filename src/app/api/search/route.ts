import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('q')
    if (!query || query.length < 2) {
      return NextResponse.json({ contacts: [], companies: [], deals: [], insights: [] })
    }

    const q = `%${query}%`
    const limit = 5

    const [contactsRes, companiesRes, dealsRes, insightsRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('*, company:companies(name)')
        .or(`firstName.ilike.${q},lastName.ilike.${q},jobTitle.ilike.${q}`)
        .order('engagementScore', { ascending: false })
        .limit(limit),
      supabase
        .from('companies')
        .select('id, name, companyType, headquartersCity, headquartersCountry')
        .or(`name.ilike.${q},description.ilike.${q}`)
        .limit(limit),
      supabase
        .from('deals')
        .select('*, acquirerCompany:companies!deals_acquirerCompanyId_fkey(name), targetCompany:companies!deals_targetCompanyId_fkey(name)')
        .or(`title.ilike.${q}`)
        .order('announcedDate', { ascending: false })
        .limit(limit),
      supabase
        .from('insights')
        .select('id, title, contentType, publishedAt')
        .or(`title.ilike.${q},summary.ilike.${q}`)
        .order('publishedAt', { ascending: false })
        .limit(limit),
    ])

    return NextResponse.json({
      contacts: contactsRes.data ?? [],
      companies: companiesRes.data ?? [],
      deals: dealsRes.data ?? [],
      insights: insightsRes.data ?? [],
    })
  } catch (error) {
    console.error('Global search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
