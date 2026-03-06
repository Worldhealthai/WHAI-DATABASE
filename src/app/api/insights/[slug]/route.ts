import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const insight = await prisma.insight.findUnique({
      where: { slug: params.slug },
      include: {
        verticals: { include: { vertical: true } },
        therapeutic_areas: { include: { therapeutic_area: true } },
      },
    })

    if (!insight) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Increment view count
    await prisma.insight.update({
      where: { id: insight.id },
      data: { view_count: { increment: 1 } },
    })

    // Related articles (same verticals)
    const verticalIds = insight.verticals.map((v) => v.vertical_id)
    const related = await prisma.insight.findMany({
      where: {
        id: { not: insight.id },
        verticals: { some: { vertical_id: { in: verticalIds } } },
      },
      take: 4,
      orderBy: { published_at: 'desc' },
    })

    return NextResponse.json({ insight, related })
  } catch (error) {
    console.error('Insight detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
