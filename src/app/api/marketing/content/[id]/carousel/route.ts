// GET /api/marketing/content/<id>/carousel → the carousel's slides, as a
// PDF (one 1080 by 1350 page per slide: what LinkedIn's "Add a document"
// posts as a swipeable carousel) or, with ?format=png, as a zip of PNGs,
// one per slide, to upload as the images of a post by hand.
import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { supabase } from '@/lib/supabase'
import { fitText } from '@/lib/contentText'
import { attachment, renderCarouselPdf, renderSlidePngs, slideFileName, slidesOf, type CarouselPost } from '@/lib/contentCarousel'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase.from('marketing_content').select('series, headline, source, edition').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  const post = data as CarouselPost & { headline: string; edition: string }
  const slides = slidesOf(post)
  if (!slides.length) return NextResponse.json({ error: 'This post is not a carousel.' }, { status: 400 })
  const title = fitText(`${post.edition} - ${post.headline}`, 120)
  const headers = { 'Cache-Control': 'private, no-store' }
  if (req.nextUrl.searchParams.get('format') === 'png') {
    const zip = new JSZip()
    const pngs = await renderSlidePngs(post)
    pngs.forEach((png, i) => zip.file(slideFileName(slides[i], i), png))
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
    return new NextResponse(Buffer.from(bytes), {
      headers: { ...headers, 'Content-Type': 'application/zip', 'Content-Disposition': attachment(`${title} - slides.zip`) },
    })
  }
  const pdf = await renderCarouselPdf(post, title)
  return new NextResponse(Buffer.from(pdf), {
    headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': attachment(`${title}.pdf`) },
  })
}
