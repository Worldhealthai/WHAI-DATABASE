import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: delegate, error } = await supabase
      .from('delegates')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !delegate) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('delegateId', params.id)
      .order('createdAt', { ascending: false })

    return NextResponse.json({ ...delegate, activities: activities ?? [] })
  } catch (error) {
    console.error('Delegate GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { data, error } = await supabase
      .from('delegates')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Delegate PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase
      .from('delegates')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delegate DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
