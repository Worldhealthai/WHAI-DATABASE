// POST /api/marketing/content/<id>/design { style? } → the post's next
// designed card (lib/contentDesign), with fresh event photos; each press
// moves on to another design.
// DELETE → back to the everyday layout.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DESIGN_STYLES, nextDesign, type DesignStyle } from '@/lib/contentDesign'
import type { ContentPost } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'

async function load(id: string) {
  const { data, error } = await supabase.from('marketing_content').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as ContentPost | null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { style?: string }
  const post = await load(id)
  if (!post) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  const wanted = DESIGN_STYLES.some((s) => s.value === body.style) ? (body.style as DesignStyle) : null
  const design = await nextDesign(post, wanted)
  const { data, error } = await supabase
    .from('marketing_content')
    .update({ source: { ...post.source, design }, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data, design })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await load(id)
  if (!post) return NextResponse.json({ error: 'No such post' }, { status: 404 })
  const { data, error } = await supabase
    .from('marketing_content')
    .update({ source: { ...post.source, design: null }, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}
