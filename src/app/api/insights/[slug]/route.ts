import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Note: This route now looks up by ID since slug was removed from the Insight model.
// The route segment is still named [slug] but accepts an ID value.
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const insight = await prisma.insight.findUnique({
      where: { id: params.slug },
    })

    if (!insight) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Related articles (same content type)
    const related = insight.contentType
      ? await prisma.insight.findMany({
          where: {
            id: { not: insight.id },
            contentType: insight.contentType,
          },
          take: 4,
          orderBy: { publishedAt: 'desc' },
        })
      : []

    return NextResponse.json({ insight, related })
  } catch (error) {
    console.error('Insight detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
