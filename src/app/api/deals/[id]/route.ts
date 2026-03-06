import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: params.id },
      include: {
        acquirer_company: {
          include: {
            verticals: { include: { vertical: true }, where: { is_primary: true }, take: 3 },
          },
        },
        target_company: {
          include: {
            verticals: { include: { vertical: true }, where: { is_primary: true }, take: 3 },
          },
        },
        investors: {
          include: {
            company: {
              select: { id: true, name: true, logo_url: true, company_type: true },
            },
          },
        },
        verticals: { include: { vertical: true } },
      },
    })

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Related deals (same companies or verticals)
    const verticalIds = deal.verticals.map((v) => v.vertical_id)
    const relatedDeals = await prisma.deal.findMany({
      where: {
        id: { not: deal.id },
        OR: [
          ...(deal.acquirer_company_id
            ? [{ acquirer_company_id: deal.acquirer_company_id }]
            : []),
          ...(deal.target_company_id
            ? [{ target_company_id: deal.target_company_id }]
            : []),
          ...(verticalIds.length
            ? [{ verticals: { some: { vertical_id: { in: verticalIds } } } }]
            : []),
        ],
      },
      take: 5,
      orderBy: { announced_date: 'desc' },
      include: {
        acquirer_company: { select: { name: true } },
        target_company: { select: { name: true } },
      },
    })

    return NextResponse.json({ deal, relatedDeals })
  } catch (error) {
    console.error('Deal detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
