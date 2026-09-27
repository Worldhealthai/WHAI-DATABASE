import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const { data: speaker, error } = await supabase
      .from('speakers')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !speaker) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('speakerId', params.id)
      .order('createdAt', { ascending: false })

    return NextResponse.json({ ...speaker, activities: activities ?? [] })
  } catch (error) {
    console.error('Speaker GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const body = await req.json()
    const { data, error } = await supabase
      .from('speakers')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      // Surface duplicate email as a readable message
      if (error.code === '23505' || error.message?.includes('unique')) {
        return NextResponse.json({ error: 'This email address is already used by another speaker. Please use a different email or leave it blank.' }, { status: 409 })
      }
      throw error
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Speaker PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const { error } = await supabase
      .from('speakers')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Speaker DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
