// POST /api/marketing/content/<id>/style { style?: "photo" | "night" | "light" }
// Draws the post in another of the three styles (lib/contentCard): the one
// asked for, else the next in turn. The photo style takes a fresh event
// photo each time, so asking for it again shuffles the photo.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { STYLE_ORDER, brandFor, isCardStyle, styleOf, type CardStyle } from '@/lib/contentBrand'
import { NEXUS_URL } from '@/lib/marketingSource'
import type { ContentPost } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'

async function galleryPhotos(series: string): Promise<string[]> {
  const brand = brandFor(series)
  try {
    const r = await fetch(`${NEXUS_URL}/api/public/gallery?site=${brand === 'nexus' ? 'all' : brand}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const j = (await r.json()) as { photos?: { image_url?: string }[] }
    return (j.photos ?? []).map((p) => p.image_url || '').filter(Boolean)
  } catch {
    return []
  }
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
  const style: CardStyle = isCardStyle(body.style) ? body.style : STYLE_ORDER[(STYLE_ORDER.indexOf(current) + 1) % STYLE_ORDER.length]

  // A fresh photo for the photo style: one the post is not showing already.
  // A speaker's card has the headshot to show, so it needs none.
  let photo = typeof source.photo === 'string' ? source.photo : null
  if (style === 'photo') {
    const photos = await galleryPhotos(post.series)
    const fresh = photos.filter((p) => p !== photo)
    const pool = fresh.length ? fresh : photos
    if (pool.length) photo = pool[Math.floor(Math.random() * pool.length)]
    else if (!(post.kind === 'speaker' && source.image)) {
      return NextResponse.json({ error: 'There are no event photos in the gallery on worldnexusgroup.com yet, so the photo style has nothing to show.' }, { status: 409 })
    }
  }
  // The old layout and design fields no longer decide anything.
  const { layout: _layout, design: _design, ...rest } = source
  const next = { ...rest, style, ...(photo ? { photo } : {}) }
  const { data: saved, error: saveErr } = await supabase
    .from('marketing_content')
    .update({ source: next, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })
  return NextResponse.json({ post: saved, style })
}
