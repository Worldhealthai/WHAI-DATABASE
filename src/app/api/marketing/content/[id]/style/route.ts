// POST /api/marketing/content/<id>/style { style?: one of CARD_STYLES (lib/contentBrand) }
// Draws the post in another of the styles (lib/contentCard): the one
// asked for, else the next in turn. A style that takes photos gets fresh
// event photos each time, so asking for it again shuffles them.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isCardStyle, type CardStyle } from '@/lib/contentBrand'
import { LookError, restyle } from '@/lib/contentLook'
import type { ContentPost } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { style?: unknown }
  const { data, error } = await supabase.from('marketing_content').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  const post = data as ContentPost
  let next: Record<string, unknown>
  let style: CardStyle
  try {
    ;({ source: next, style } = await restyle(post, isCardStyle(body.style) ? body.style : null))
  } catch (e) {
    if (e instanceof LookError) return NextResponse.json({ error: e.message }, { status: 409 })
    throw e
  }
  const { data: saved, error: saveErr } = await supabase
    .from('marketing_content')
    .update({ source: next, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })
  return NextResponse.json({ post: saved, style })
}
