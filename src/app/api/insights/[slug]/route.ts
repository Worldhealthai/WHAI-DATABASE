import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { data: insight, error } = await supabase
      .from('insights')
      .select('*')
      .eq('id', params.slug)
      .single()

    if (error || !insight) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Related articles (same content type)
    let related: any[] = []
    if (insight.contentType) {
      const { data } = await supabase
        .from('insights')
        .select('*')
        .neq('id', insight.id)
        .eq('contentType', insight.contentType)
        .order('publishedAt', { ascending: false })
        .limit(4)
      related = data ?? []
    }

    return NextResponse.json({ insight, related })
  } catch (error) {
    console.error('Insight detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
