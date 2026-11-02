// GET /api/marketing/content/briefings?series=&label=
//   → { briefings: [{ slug, title, published_at, ai, big, posted }] }: the
//   page's recent Insights briefings for the Content tab's "Which briefing"
//   picker, each marked as about AI, big general news, or already posted on
//   this edition (lib/contentFocus). Picking one writes it whatever it is
//   about; left to itself the page posts AI first.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { NEXUS_URL } from '@/lib/marketingSource'
import { FRESH_DAYS, isAiStory, isBigNews } from '@/lib/contentFocus'
import type { PublicInsight } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const series = req.nextUrl.searchParams.get('series') || ''
  const label = req.nextUrl.searchParams.get('label') || ''
  if (!series) return NextResponse.json({ error: 'series is required' }, { status: 400 })
  let articles: PublicInsight[] = []
  try {
    const r = await fetch(`${NEXUS_URL}/api/public/insights?series=${encodeURIComponent(series)}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (r.ok) articles = ((await r.json()) as { articles?: PublicInsight[] }).articles ?? []
  } catch {
    return NextResponse.json({ error: 'The Insights could not be read from worldnexusgroup.com just now.' }, { status: 502 })
  }
  const since = Date.now() - FRESH_DAYS * 86400000
  const recent = articles.filter((a) => !a.published_at || Date.parse(a.published_at) >= since).slice(0, 60)
  const { data } = label
    ? await supabase.from('marketing_content').select('ref').eq('edition', label).eq('kind', 'insight').in('ref', recent.map((a) => a.slug))
    : { data: [] as { ref: string }[] }
  const posted = new Set((data ?? []).map((r) => r.ref))
  return NextResponse.json({
    briefings: recent.map((a) => ({ slug: a.slug, title: a.title, published_at: a.published_at, ai: isAiStory(a), big: !isAiStory(a) && isBigNews(a), posted: posted.has(a.slug) })),
  })
}
