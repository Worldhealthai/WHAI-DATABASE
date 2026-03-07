import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: params.id },
      include: {
        acquirerCompany: {
          include: {
            verticals: { where: { isPrimary: true }, take: 3 },
          },
        },
        targetCompany: {
          include: {
            verticals: { where: { isPrimary: true }, take: 3 },
          },
        },
        investors: {
          include: {
            investorCompany: {
              select: { id: true, name: true, companyType: true },
            },
          },
        },
      },
    })

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Related deals (same companies)
    const relatedDeals = await prisma.deal.findMany({
      where: {
        id: { not: deal.id },
        OR: [
          ...(deal.acquirerCompanyId
            ? [{ acquirerCompanyId: deal.acquirerCompanyId }]
            : []),
          ...(deal.targetCompanyId
            ? [{ targetCompanyId: deal.targetCompanyId }]
            : []),
        ],
      },
      take: 5,
      orderBy: { announcedDate: 'desc' },
      include: {
        acquirerCompany: { select: { name: true } },
        targetCompany: { select: { name: true } },
      },
    })

    return NextResponse.json({ deal, relatedDeals })
  } catch (error) {
    console.error('Deal detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
