// GET /api/marketing/content/<id>/image → the post's card, a 1080 by 1080
// PNG drawn from the row (lib/contentCard) in the post's style (?style=
// one of the looks to see it in another: the look gallery's previews).
// ?download=1 saves it. For a carousel, one of its 1080 by 1350 slides
// (?slide=1, the first by default; ?style= draws the cover in a look).
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { renderCard } from '@/lib/contentCard'
import { attachment, renderSlide } from '@/lib/contentCarousel'
import { isCardStyle, photosFor, photosOf, type CardStyle } from '@/lib/contentBrand'
import { galleryPhotos } from '@/lib/contentGallery'
import type { ContentPost } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'

type Row = Pick<ContentPost, 'series' | 'kind' | 'kicker' | 'headline' | 'subline' | 'source' | 'edition'>

// A preview in a look that takes more photos than the post holds borrows
// them from the gallery, so every look can be seen before it is chosen.
async function withPhotos(post: Row, style: CardStyle): Promise<Row> {
  const source = (post.source ?? {}) as Record<string, unknown>
  const own = post.kind === 'speaker' && typeof source.image === 'string' && source.image ? 1 : 0
  const need = photosFor(style) - own
  const had = photosOf(source)
  if (had.length >= need) return post
  const more = (await galleryPhotos(post.series)).filter((p) => !had.includes(p))
  const photos = [...had, ...more].slice(0, Math.max(need, 1))
  return { ...post, source: { ...source, photo: photos[0], photos } }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase.from('marketing_content').select('series, kind, kicker, headline, subline, source, edition').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  let post = data as Row
  const asked = req.nextUrl.searchParams.get('style')
  const style = isCardStyle(asked) ? asked : undefined
  if (style) post = await withPhotos(post, style)
  const carousel = (post.source as { format?: string } | null)?.format === 'carousel'
  const slideNo = Math.max(1, parseInt(req.nextUrl.searchParams.get('slide') || '1', 10) || 1)
  const image = carousel
    ? await renderSlide(post as Parameters<typeof renderSlide>[0], slideNo - 1, style)
    : await renderCard(post, style)
  const download = req.nextUrl.searchParams.get('download') === '1'
  if (download) {
    image.headers.set('Content-Disposition', attachment(`${post.edition} - ${post.headline}${carousel ? ` - slide ${slideNo}` : ''}.png`))
  }
  image.headers.set('Cache-Control', 'private, no-store')
  return image
}
