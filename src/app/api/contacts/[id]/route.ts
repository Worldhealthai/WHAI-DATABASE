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
            verticals: { include: { vertical: true } },
            therapeutic_areas: { include: { therapeutic_area: true } },
          },
        },
        job_function: true,
        region: true,
      },
    })

    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Fetch related contacts at same company
    const relatedContacts = contact.company_id
      ? await prisma.contact.findMany({
          where: {
            company_id: contact.company_id,
            id: { not: contact.id },
          },
          take: 6,
          include: {
            job_function: { select: { name: true } },
          },
          orderBy: { engagement_score: 'desc' },
        })
      : []

    // Fetch deals involving their company
    const relatedDeals = contact.company_id
      ? await prisma.deal.findMany({
          where: {
            OR: [
              { acquirer_company_id: contact.company_id },
              { target_company_id: contact.company_id },
            ],
          },
          take: 5,
          orderBy: { announced_date: 'desc' },
          include: {
            acquirer_company: { select: { name: true } },
            target_company: { select: { name: true } },
          },
        })
      : []

    return NextResponse.json({ contact, relatedContacts, relatedDeals })
  } catch (error) {
    console.error('Contact detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
