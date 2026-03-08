import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET() {
  try {
    const [verticalsRes, taRes, companyTypesRes, dealTypesRes] = await Promise.all([
      supabase.from('company_verticals').select('verticalSlug').order('verticalSlug'),
      supabase.from('company_therapeutic_areas').select('therapeuticArea').order('therapeuticArea'),
      supabase.from('companies').select('companyType').not('companyType', 'is', null).order('companyType'),
      supabase.from('deals').select('dealType').not('dealType', 'is', null).order('dealType'),
    ])

    const verticals = [...new Set((verticalsRes.data ?? []).map((v: any) => v.verticalSlug))]
    const therapeuticAreas = [...new Set((taRes.data ?? []).map((t: any) => t.therapeuticArea))]
    const companyTypes = [...new Set((companyTypesRes.data ?? []).map((c: any) => c.companyType))]
    const dealTypes = [...new Set((dealTypesRes.data ?? []).map((d: any) => d.dealType))]

    return NextResponse.json({ verticals, therapeuticAreas, companyTypes, dealTypes })
  } catch (error) {
    console.error('Taxonomy API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
