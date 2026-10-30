// One post: edit its words or its state, or remove it.
//   PATCH  /api/marketing/content/<id> { kicker?, headline?, subline?, caption?, hashtags?, link?, forDate?, status?, postUrl?, slides? }
//          slides: a carousel's words, slide by slide, as the team corrected
//          them (each slide keeps its kind, its link and its source).
//          mentions: the companies tagged on the post, [{ urn, name, vanity }]
//          from /api/linkedin/company, mentioned in the text when it goes up.
//   DELETE /api/marketing/content/<id>
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { tidy } from '@/lib/contentStudio'
import { mentionsOf } from '@/lib/linkedin'
import { fitText } from '@/lib/contentText'
import type { Slide } from '@/lib/contentCarousel'

export const dynamic = 'force-dynamic'

const TEXT = ['kicker', 'headline', 'subline', 'caption', 'link', 'postUrl'] as const

// A slide's words over the one saved: only its own fields, and a quotation
// as typed (house style would change its words).
function edited(was: Slide, x: Record<string, unknown>): Slide {
  const t = (k: string, fallback: string) => (typeof x[k] === 'string' ? tidy(x[k] as string) : fallback)
  const raw = (k: string, fallback: string) => (typeof x[k] === 'string' ? (x[k] as string).trim() : fallback)
  switch (was.kind) {
    case 'news': return { ...was, kicker: t('kicker', was.kicker), headline: t('headline', was.headline), summary: t('summary', was.summary) }
    case 'statistic': return { ...was, figure: t('figure', was.figure), label: t('label', was.label), context: t('context', was.context) }
    case 'data': {
      const points = Array.isArray(x.points)
        ? (x.points as { figure?: unknown; label?: unknown }[]).map((p) => ({ figure: tidy(String(p?.figure ?? '')), label: tidy(String(p?.label ?? '')) })).filter((p) => p.figure && p.label)
        : was.points
      return { ...was, title: t('title', was.title), points: points.length ? points : was.points }
    }
    case 'quote': return { ...was, text: raw('text', was.text).replace(/^["“]+|["”]+$/g, ''), speaker: raw('speaker', was.speaker), role: raw('role', was.role) }
    case 'end': return { ...was, headline: t('headline', was.headline) }
  }
}

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
  if (Array.isArray(body.slides) || Array.isArray(body.mentions)) {
    const { data: was, error: readError } = await supabase.from('marketing_content').select('source').eq('id', id).maybeSingle()
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
    const source = (was?.source ?? {}) as { slides?: Slide[] } & Record<string, unknown>
    const next: Record<string, unknown> = { ...source }
    if (Array.isArray(body.slides)) {
      const slides = Array.isArray(source.slides) ? source.slides : []
      if (!slides.length) return NextResponse.json({ error: 'This post has no slides to edit.' }, { status: 400 })
      const edits = slides.map((s, i) => (body.slides[i] && typeof body.slides[i] === 'object' ? edited(s, body.slides[i]) : s))
      next.slides = edits
      // The post's own words follow the news slide, as when it was written.
      const news = edits[0]?.kind === 'news' ? edits[0] : null
      if (news) Object.assign(patch, { kicker: news.kicker, headline: news.headline, subline: fitText(news.summary, 120) })
    }
    if (Array.isArray(body.mentions)) {
      // One tag per company page.
      next.mentions = mentionsOf({ mentions: body.mentions }).filter((m, i, all) => all.findIndex((x) => x.urn === m.urn) === i).slice(0, 20)
    }
    patch.source = next
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
