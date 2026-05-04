import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    let query = supabase
      .from('activities')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(limit)

    if (entityType && entityId) {
      if (entityType === 'delegate') query = query.eq('delegateId', entityId)
      else if (entityType === 'speaker') query = query.eq('speakerId', entityId)
      else if (entityType === 'sponsor') query = query.eq('sponsorId', entityId)
    } else if (entityType) {
      query = query.eq('entityType', entityType)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data ?? [] })
  } catch (error) {
    console.error('Activities API GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { entityType, entityId, type, content, createdBy, metadata } = body

    if (!entityType || !entityId || !type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const record: any = {
      entityType,
      type,
      content,
      createdBy: createdBy ?? 'Team',
      metadata: metadata ? JSON.stringify(metadata) : null,
    }

    if (entityType === 'delegate') record.delegateId = entityId
    else if (entityType === 'speaker') record.speakerId = entityId
    else if (entityType === 'sponsor') record.sponsorId = entityId

    const { data, error } = await supabase
      .from('activities')
      .insert(record)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Activities API POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
