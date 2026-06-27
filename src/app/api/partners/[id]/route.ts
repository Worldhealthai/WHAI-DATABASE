import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: sponsor, error } = await supabase
      .from('partners')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !sponsor) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [{ data: activities }, { data: contacts }] = await Promise.all([
      supabase.from('activities').select('*').eq('partnerId', params.id).order('createdAt', { ascending: false }),
      supabase.from('partners').select('*').eq('companyId', params.id).order('createdAt', { ascending: true }),
    ])

    return NextResponse.json({ ...sponsor, activities: activities ?? [], contacts: contacts ?? [] })
  } catch (error) {
    console.error('Sponsor GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { data, error } = await supabase
      .from('partners')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Sponsor PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sponsor DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
