// The Content tab's posts for one edition.
//   GET  /api/marketing/content?edition=World%20Health%20AI%20London%202027   → { data }
//   POST /api/marketing/content { series, city, year, label, kind?, brief?, forDate? } → { post }
//        drafts one post (lib/contentStudio) and stores it
import { NextRequest, NextResponse } from 'next/server'
import { setupHint, supabase } from '@/lib/supabase'
import { CONTENT_KINDS, ContentError, draftPost, type ContentKind } from '@/lib/contentStudio'
import { LineupError } from '@/lib/marketingSource'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const edition = (req.nextUrl.searchParams.get('edition') || '').trim()
  if (!edition) return NextResponse.json({ error: 'edition is required' }, { status: 400 })
  const { data, error } = await supabase.from('marketing_content').select('*').eq('edition', edition).order('forDate', { ascending: false, nullsFirst: false }).order('createdAt', { ascending: false })
  if (error) {
    const hint = setupHint('marketing_content', error)
    if (hint) return NextResponse.json({ error: hint, migration: true }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const series = String(body.series || '').trim()
  const city = String(body.city || '').trim()
  const year = String(body.year || '').trim()
  const label = String(body.label || `${series} ${city} ${year}`).trim()
  if (!series || !year) return NextResponse.json({ error: 'series and year are required' }, { status: 400 })
  const kind = CONTENT_KINDS.some((k) => k.value === body.kind) ? (body.kind as ContentKind) : null
  const forDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.forDate || '')) ? String(body.forDate) : null
  try {
    const post = await draftPost({ series, city, year, label }, { kind, brief: body.brief ? String(body.brief) : null, forDate })
    return NextResponse.json({ post }, { status: 201 })
  } catch (error: any) {
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof LineupError) return NextResponse.json({ error: error.message }, { status: error.status })
    const hint = setupHint('marketing_content', error)
    if (hint) return NextResponse.json({ error: hint, migration: true }, { status: 400 })
    console.error('Content draft error:', error)
    return NextResponse.json({ error: error?.message || 'The post could not be written' }, { status: 500 })
  }
}
