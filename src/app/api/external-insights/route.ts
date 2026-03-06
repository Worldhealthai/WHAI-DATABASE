import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

export async function GET(req: NextRequest) {
  const baseUrl = process.env.WORLD_HEALTH_AI_URL
  if (!baseUrl) {
    return NextResponse.json({ error: 'WORLD_HEALTH_AI_URL is not configured' }, { status: 503 })
  }

  try {
    const { searchParams } = req.nextUrl
    const query = searchParams.get('query') ?? ''
    const contentTypes = searchParams.getAll('contentTypes')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '12'), 100)

    // Fetch published insights from world-health-ai website
    const params = new URLSearchParams({ status: 'published' })
    const res = await fetch(`${baseUrl}/api/insights?${params}`, {
      next: { revalidate: 300 }, // cache for 5 minutes
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      console.error(`world-health-ai API error: ${res.status} ${res.statusText}`)
      return NextResponse.json({ error: 'Failed to fetch intelligence insights' }, { status: 502 })
    }

    const raw: any[] = await res.json()

    // Map to WHAI-DATABASE insight shape
    let mapped = raw.map((item) => ({
      id: item.id,
      title: item.title ?? '',
      slug: item.slug ?? '',
      content_type: mapContentType(item.content_type ?? item.category),
      summary: item.excerpt ?? '',
      body: item.content ?? '',
      author: item.author ?? 'World Health AI Forum',
      published_at: parsePublishedAt(item.date, item.created_at),
      thumbnail_url: item.image ?? null,
      is_premium: false,
      source_url: `${baseUrl}/intelligence-hub/${item.slug}`,
      tags: Array.isArray(item.tags) ? item.tags : (item.keywords ? item.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : []),
      verticals: [],
      therapeutic_areas: [],
      // Extra metadata from the source
      _source: 'intelligence-hub',
      _category: item.category ?? null,
      _report_quarter: item.report_quarter ?? null,
      _newsletter_featured: item.newsletter_featured ?? false,
    }))

    // Filter by query
    if (query) {
      const q = query.toLowerCase()
      mapped = mapped.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.tags.some((t: string) => t.toLowerCase().includes(q))
      )
    }

    // Filter by content types
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
