// GET /api/marketing/content/<id>/carousel → the carousel as a PDF, one
// 1080 by 1350 page per slide (lib/contentCarousel): what LinkedIn's
// "Add a document" posts as a swipeable carousel.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { renderCarouselPdf, slidesOf, type CarouselPost } from '@/lib/contentCarousel'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase.from('marketing_content').select('series, headline, source, edition').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  const post = data as CarouselPost & { headline: string; edition: string }
  if (!slidesOf(post).length) return NextResponse.json({ error: 'This post is not a carousel.' }, { status: 400 })
  const title = `${post.edition} - ${post.headline}`.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120)
  const pdf = await renderCarouselPdf(post, title)
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${title}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
