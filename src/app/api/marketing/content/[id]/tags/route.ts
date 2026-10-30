// POST /api/marketing/content/<id>/tags → { found, missing }: the companies
// the post names, as LinkedIn pages to tag (lib/contentTags). Nothing is
// saved; the team picks which to tag.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ContentError, type ContentPost } from '@/lib/contentStudio'
import { LinkedInError } from '@/lib/linkedin'
import { suggestTags } from '@/lib/contentTags'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase.from('marketing_content').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  try {
    return NextResponse.json(await suggestTags(data as ContentPost))
  } catch (e) {
    if (e instanceof LinkedInError || e instanceof ContentError) return NextResponse.json({ error: e.message }, { status: (e as { status?: number }).status ?? 500 })
    console.error('Tag suggestions error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'The post could not be read for companies' }, { status: 500 })
  }
}
