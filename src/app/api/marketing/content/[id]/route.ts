// One post: edit its words or its state, or remove it.
//   PATCH  /api/marketing/content/<id> { kicker?, headline?, subline?, caption?, hashtags?, link?, forDate?, status?, postUrl? }
//   DELETE /api/marketing/content/<id>
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { tidy } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'

const TEXT = ['kicker', 'headline', 'subline', 'caption', 'link', 'postUrl'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const k of TEXT) if (typeof body[k] === 'string') patch[k] = k === 'link' || k === 'postUrl' ? body[k].trim() || null : tidy(body[k])
  if (Array.isArray(body.hashtags)) patch.hashtags = body.hashtags.map((h: unknown) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')).filter((h: string) => h.length > 1)
  if (body.forDate === null || /^\d{4}-\d{2}-\d{2}$/.test(String(body.forDate || ''))) patch.forDate = body.forDate
  if (body.status === 'draft' || body.status === 'posted') {
    patch.status = body.status
    patch.postedAt = body.status === 'posted' ? new Date().toISOString() : null
    if (body.status === 'draft') patch.postUrl = null
  }
  const { data, error } = await supabase.from('marketing_content').update(patch).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabase.from('marketing_content').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
