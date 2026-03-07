import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: params.id },
      include: {
        verticals: true,
        therapeuticAreas: true,
        _count: {
          select: { contacts: true, dealsAsAcquirer: true, dealsAsTarget: true },
        },
      },
    })

    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [contacts, deals] = await Promise.all([
      prisma.contact.findMany({
        where: { companyId: params.id },
        take: 20,
        orderBy: { engagementScore: 'desc' },
      }),
      prisma.deal.findMany({
        where: {
          OR: [
            { acquirerCompanyId: params.id },
            { targetCompanyId: params.id },
            { investors: { some: { investorCompanyId: params.id } } },
          ],
        },
        take: 10,
        orderBy: { announcedDate: 'desc' },
        include: {
          acquirerCompany: { select: { id: true, name: true } },
          targetCompany: { select: { id: true, name: true } },
        },
      }),
    ])

    return NextResponse.json({ company, contacts, deals })
  } catch (error) {
    console.error('Company detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
