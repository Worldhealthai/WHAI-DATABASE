import { NextRequest, NextResponse } from 'next/server'
import marketPulse from '@/data/intelligence-hub/2025-market-pulse-collection.json'
import deepDives from '@/data/intelligence-hub/2025-deep-dives-collection.json'
import dataSnapshots from '@/data/intelligence-hub/2025-data-snapshots-collection.json'
import q1Report from '@/data/intelligence-hub/q1-2025-healthcare-ai-market-pulse.json'

export const dynamic = 'force-dynamic'

// All local intelligence content bundled at build time
const LOCAL_CONTENT: any[] = [
  ...(Array.isArray(marketPulse) ? marketPulse : [marketPulse]),
  ...(Array.isArray(deepDives) ? deepDives : [deepDives]),
  ...(Array.isArray(dataSnapshots) ? dataSnapshots : [dataSnapshots]),
  ...(Array.isArray(q1Report) ? q1Report : [q1Report]),
].filter((i: any) => !i.status || i.status === 'published')

// Map world-health-ai content types to WHAI-DATABASE ContentType enum
const CONTENT_TYPE_MAP: Record<string, string> = {
  'quarterly-report': 'QUARTERLY_REPORT',
  'market-pulse': 'NEWS_BRIEF',
  'deep-dive': 'ANALYSIS',
  'data-snapshot': 'DATA_SNAPSHOT',
  'educational': 'ANALYSIS',
  'market-report': 'MARKET_REPORT',
}

function mapContentType(raw: string | null | undefined): string {
  if (!raw) return 'NEWS_BRIEF'
  return CONTENT_TYPE_MAP[raw.toLowerCase()] ?? 'NEWS_BRIEF'
}

function parsePublishedAt(dateStr: string | null | undefined, createdAt: string | null | undefined): string {
  if (dateStr) {
    const parsed = new Date(dateStr)
    if (!isNaN(parsed.getTime())) return parsed.toISOString()
  }
  if (createdAt) return createdAt
  return new Date().toISOString()
}

// Try HTTP fetch from deployed site; fall back to bundled JSON
async function fetchRawInsights(baseUrl: string): Promise<any[]> {
  try {
    const res = await fetch(`${baseUrl}/api/insights?status=published`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch {
    // network failure — fall through to bundled data
  }
  return LOCAL_CONTENT
}

export async function GET(req: NextRequest) {
  const baseUrl = process.env.WORLD_HEALTH_AI_URL ?? 'https://worldhealthai.com'

  try {
    const { searchParams } = req.nextUrl
    const query = searchParams.get('query') ?? ''
    const contentTypes = searchParams.getAll('contentTypes')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '12'), 100)

    const raw = await fetchRawInsights(baseUrl)

    let mapped = raw.map((item: any, idx: number) => ({
      id: item.id ?? `ext-${idx}`,
      title: item.title ?? '',
      slug: item.slug ?? '',
      content_type: mapContentType(item.content_type ?? item.category),
      summary: item.excerpt ?? '',
      body: item.content ?? '',
      author: item.author ?? 'World Health AI Forum',
      published_at: parsePublishedAt(item.date, item.created_at),
      thumbnail_url: item.image ?? item.thumbnail_url ?? null,
      is_premium: false,
      source_url: `${baseUrl}/insights/${item.slug}`,
      tags: Array.isArray(item.tags)
        ? item.tags
        : (item.keywords ? item.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : []),
      verticals: [],
      therapeutic_areas: [],
      _source: 'intelligence-hub',
      _category: item.category ?? null,
      _report_quarter: item.report_quarter ?? null,
      _newsletter_featured: item.newsletter_featured ?? false,
    }))

    if (query) {
      const q = query.toLowerCase()
      mapped = mapped.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.tags.some((t: string) => t.toLowerCase().includes(q))
      )
    }

    if (contentTypes.length > 0) {
      mapped = mapped.filter((i) => contentTypes.includes(i.content_type))
    }

    const total = mapped.length
    const totalPages = Math.ceil(total / pageSize)
    const data = mapped.slice((page - 1) * pageSize, page * pageSize)

    return NextResponse.json({ data, total, page, pageSize, totalPages })
  } catch (error) {
    console.error('External insights fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
