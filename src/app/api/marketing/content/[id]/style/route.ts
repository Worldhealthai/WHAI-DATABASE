// POST /api/marketing/content/<id>/style { style?: one of CARD_STYLES (lib/contentBrand) }
// Draws the post in another of the styles (lib/contentCard): the one
// asked for, else the next in turn. A style that takes photos gets fresh
// event photos each time, so asking for it again shuffles them.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { brandFor, isCardStyle, photosFor, photosOf, styleOf, stylesFor, type CardStyle } from '@/lib/contentBrand'
import { NEXUS_URL } from '@/lib/marketingSource'
import type { ContentPost } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'

async function galleryPhotos(series: string): Promise<string[]> {
  const brand = brandFor(series)
  try {
    const r = await fetch(`${NEXUS_URL}/api/public/gallery?site=${brand === 'nexus' ? 'all' : brand}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const j = (await r.json()) as { photos?: { image_url?: string }[] }
    return [...new Set((j.photos ?? []).map((p) => p.image_url || '').filter(Boolean))]
  } catch {
    return []
  }
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { style?: unknown }
  const { data, error } = await supabase.from('marketing_content').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  const post = data as ContentPost
  const source = (post.source ?? {}) as Record<string, unknown>
  const current = styleOf(source)
  const gallery = await galleryPhotos(post.series)
  // A speaker's headshot stands in for one photo (the photo and frame styles).
  const own = post.kind === 'speaker' && typeof source.image === 'string' && source.image ? 1 : 0
  const possible = stylesFor(post.kind).filter((s) => photosFor(s) <= Math.max(gallery.length, own))
  let style: CardStyle
  if (isCardStyle(body.style)) {
    if (!possible.includes(body.style)) {
      if (!stylesFor(post.kind).includes(body.style)) return NextResponse.json({ error: 'A speaker\'s card shows their own photo and no other, so the mosaic look is not one of theirs.' }, { status: 409 })
      return NextResponse.json({ error: `The ${body.style} look needs ${photosFor(body.style)} event photo${photosFor(body.style) === 1 ? '' : 's'} and the gallery on worldnexusgroup.com has ${gallery.length}.` }, { status: 409 })
    }
    style = body.style
  } else {
    style = possible[(possible.indexOf(current) + 1) % possible.length] ?? 'night'
  }

  // Fresh photos for a style that takes them: ones the post is not showing.
  const had = photosOf(source)
  const need = photosFor(style)
  let photos = had.slice(0, need)
  if (need) {
    const fresh = gallery.filter((p) => !had.includes(p))
    photos = shuffle(fresh.length >= need ? fresh : gallery).slice(0, need)
  }
  // The old layout and design fields no longer decide anything.
  const { layout: _layout, design: _design, photo: _photo, photos: _photos, ...rest } = source
  const next = { ...rest, style, ...(photos.length ? { photo: photos[0], photos } : {}) }
  const { data: saved, error: saveErr } = await supabase
    .from('marketing_content')
    .update({ source: next, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })
  return NextResponse.json({ post: saved, style })
}
