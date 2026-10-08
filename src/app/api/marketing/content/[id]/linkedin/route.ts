// POST /api/marketing/content/<id>/linkedin → "Approve and post": the post
// goes up on its brand's LinkedIn page now (lib/linkedin), a single post as
// its image and a carousel as its PDF, and is marked posted with its link.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { renderCard } from '@/lib/contentCard'
import { renderCarouselPdf, slidesOf, type CarouselPost } from '@/lib/contentCarousel'
import { brandFor } from '@/lib/contentBrand'
import { LinkedInError, littleText, publish } from '@/lib/linkedin'
import type { ContentPost } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase.from('marketing_content').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  const post = data as ContentPost
  if (post.status === 'posted') return NextResponse.json({ error: 'This one is already posted.' }, { status: 409 })
  if (!post.caption.trim()) return NextResponse.json({ error: 'The post has no caption.' }, { status: 400 })

  // Claimed before the slow part, so a second click cannot post it twice.
  const running = (post.source as { linkedin?: { state?: string; at?: string } })?.linkedin
  if (running?.state === 'posting' && Date.now() - Date.parse(running.at || '') < 120000) {
    return NextResponse.json({ error: 'This post is already being put up.' }, { status: 409 })
  }
  const { data: claimed } = await supabase
    .from('marketing_content')
    .update({ source: { ...post.source, linkedin: { state: 'posting', at: new Date().toISOString() } } })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id')
  if (!claimed?.length) return NextResponse.json({ error: 'This one is already posted.' }, { status: 409 })

  try {
    const brand = brandFor(post.series)
    const carousel = slidesOf(post as unknown as CarouselPost).length > 0
    const title = post.headline || post.edition
    const bytes = carousel
      ? await renderCarouselPdf(post as unknown as CarouselPost, title)
      : new Uint8Array(await (await renderCard(post as Parameters<typeof renderCard>[0])).arrayBuffer())
    const done = await publish({
      brand,
      commentary: littleText(post.caption, post.hashtags),
      file: carousel ? { kind: 'document', bytes, title } : { kind: 'image', bytes, title, altText: [post.kicker, post.headline, post.subline].filter(Boolean).join('. ') },
    })
    const now = new Date().toISOString()
    const { data: saved, error: saveErr } = await supabase
      .from('marketing_content')
      .update({
        status: 'posted',
        postUrl: done.url,
        postedAt: now,
        updatedAt: now,
        source: { ...post.source, linkedin: { state: 'posted', urn: done.urn, page: done.page.name, at: now } },
      })
      .eq('id', id)
      .select('*')
      .single()
    if (saveErr) return NextResponse.json({ error: `Posted to LinkedIn (${done.url}), but the CRM could not mark it: ${saveErr.message}` }, { status: 500 })
    return NextResponse.json({ post: saved, url: done.url, page: done.page.name })
  } catch (e) {
    await supabase.from('marketing_content').update({ source: { ...post.source, linkedin: { state: 'failed', at: new Date().toISOString() } } }).eq('id', id)
    if (e instanceof LinkedInError) return NextResponse.json({ error: e.message, reconnect: e.reconnect }, { status: e.status })
    console.error('LinkedIn post error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'The post could not be put up' }, { status: 500 })
  }
}
