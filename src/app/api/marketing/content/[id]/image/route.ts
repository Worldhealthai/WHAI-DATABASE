// GET /api/marketing/content/<id>/image → the post's card, a 1080 by 1080
// PNG drawn from the row (lib/contentCard). ?download=1 saves it.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { renderCard } from '@/lib/contentCard'
import type { ContentPost } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase.from('marketing_content').select('series, kicker, headline, subline, source, edition').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  const post = data as Pick<ContentPost, 'series' | 'kicker' | 'headline' | 'subline' | 'source' | 'edition'>
  const image = await renderCard(post)
  const download = req.nextUrl.searchParams.get('download') === '1'
  if (download) {
    const name = `${post.edition} - ${post.headline}`.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120)
    image.headers.set('Content-Disposition', `attachment; filename="${name}.png"`)
  }
  image.headers.set('Cache-Control', 'private, no-store')
  return image
}
