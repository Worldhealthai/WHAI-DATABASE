import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
      include: {
        company: {
          include: {
            verticals: true,
            therapeuticAreas: true,
          },
        },
      },
    })

    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Fetch related contacts at same company
    const relatedContacts = contact.companyId
      ? await prisma.contact.findMany({
          where: {
            companyId: contact.companyId,
            id: { not: contact.id },
          },
          take: 6,
          orderBy: { engagementScore: 'desc' },
        })
      : []

    // Fetch deals involving their company
    const relatedDeals = contact.companyId
      ? await prisma.deal.findMany({
          where: {
            OR: [
              { acquirerCompanyId: contact.companyId },
              { targetCompanyId: contact.companyId },
            ],
          },
          take: 5,
          orderBy: { announcedDate: 'desc' },
          include: {
            acquirerCompany: { select: { name: true } },
            targetCompany: { select: { name: true } },
          },
        })
      : []

    return NextResponse.json({ contact, relatedContacts, relatedDeals })
  } catch (error) {
    console.error('Contact detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
