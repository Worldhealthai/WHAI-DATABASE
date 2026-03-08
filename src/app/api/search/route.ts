import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Global search across all entities
export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('q')
    if (!query || query.length < 2) {
      return NextResponse.json({ contacts: [], companies: [], deals: [], insights: [] })
    }

    const q = { contains: query }
    const limit = 5

    const [contacts, companies, deals, insights] = await Promise.all([
      prisma.contact.findMany({
        where: {
          OR: [
            { firstName: q },
            { lastName: q },
            { jobTitle: q },
            { company: { name: q } },
          ],
        },
        take: limit,
        include: {
          company: { select: { name: true } },
        },
        orderBy: { engagementScore: 'desc' },
      }),
      prisma.company.findMany({
        where: { OR: [{ name: q }, { description: q }] },
        take: limit,
        select: {
          id: true, name: true, companyType: true,
          headquartersCity: true, headquartersCountry: true,
        },
      }),
      prisma.deal.findMany({
        where: {
          OR: [
            { title: q },
            { acquirerCompany: { name: q } },
            { targetCompany: { name: q } },
          ],
        },
        take: limit,
        include: {
          acquirerCompany: { select: { name: true } },
          targetCompany: { select: { name: true } },
        },
        orderBy: { announcedDate: 'desc' },
      }),
      prisma.insight.findMany({
        where: { OR: [{ title: q }, { summary: q }] },
        take: limit,
        select: { id: true, title: true, contentType: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
      }),
    ])

    return NextResponse.json({ contacts, companies, deals, insights })
  } catch (error) {
    console.error('Global search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
