import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: params.id },
      include: {
        verticals: { include: { vertical: true } },
        therapeutic_areas: { include: { therapeutic_area: true } },
        parent_company: { select: { id: true, name: true, logo_url: true } },
        subsidiaries: { select: { id: true, name: true, logo_url: true, company_type: true } },
        _count: {
          select: { contacts: true, deals_as_acquirer: true, deals_as_target: true },
        },
      },
    })

    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [contacts, deals] = await Promise.all([
      prisma.contact.findMany({
        where: { company_id: params.id },
        take: 20,
        orderBy: [{ seniority_level: 'asc' }, { engagement_score: 'desc' }],
        include: { job_function: { select: { name: true } } },
      }),
      prisma.deal.findMany({
        where: {
          OR: [
            { acquirer_company_id: params.id },
            { target_company_id: params.id },
            { investors: { some: { company_id: params.id } } },
          ],
        },
        take: 10,
        orderBy: { announced_date: 'desc' },
        include: {
          acquirer_company: { select: { id: true, name: true } },
          target_company: { select: { id: true, name: true } },
          verticals: { include: { vertical: { select: { name: true } } } },
        },
      }),
    ])

    return NextResponse.json({ company, contacts, deals })
  } catch (error) {
    console.error('Company detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
