// GET /api/marketing/content/<id>/image → the post's card, a 1080 by 1080
// PNG drawn from the row (lib/contentCard). ?download=1 saves it. For a
// carousel, one of its 1080 by 1350 slides (?slide=1, the first by default).
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { renderCard } from '@/lib/contentCard'
import { renderSlide } from '@/lib/contentCarousel'
import { CARD_LAYOUTS, type CardLayout } from '@/lib/contentBrand'
import type { ContentPost } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase.from('marketing_content').select('series, kicker, headline, subline, source, edition').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  const post = data as Pick<ContentPost, 'series' | 'kicker' | 'headline' | 'subline' | 'source' | 'edition'>
  const asked = req.nextUrl.searchParams.get('layout')
  const carousel = (post.source as { format?: string } | null)?.format === 'carousel'
  const slideNo = Math.max(1, parseInt(req.nextUrl.searchParams.get('slide') || '1', 10) || 1)
  const image = carousel
    ? await renderSlide(post as Parameters<typeof renderSlide>[0], slideNo - 1)
    : await renderCard(post, CARD_LAYOUTS.some((l) => l.value === asked) ? (asked as CardLayout) : undefined)
  const download = req.nextUrl.searchParams.get('download') === '1'
  if (download) {
    const name = `${post.edition} - ${post.headline}${carousel ? ` - slide ${slideNo}` : ''}`.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120)
    image.headers.set('Content-Disposition', `attachment; filename="${name}.png"`)
  }
  image.headers.set('Cache-Control', 'private, no-store')
  return image
}
