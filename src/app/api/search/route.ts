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

    const q = { contains: query, mode: 'insensitive' as const }
    const limit = 5

    const [contacts, companies, deals, insights] = await Promise.all([
      prisma.contact.findMany({
        where: {
          OR: [
            { first_name: q },
            { last_name: q },
            { job_title: q },
            { company: { name: q } },
          ],
        },
        take: limit,
        include: {
          company: { select: { name: true } },
        },
        orderBy: { engagement_score: 'desc' },
      }),
      prisma.company.findMany({
        where: { OR: [{ name: q }, { description: q }] },
        take: limit,
        select: {
          id: true, name: true, company_type: true, logo_url: true,
          headquarters_city: true, headquarters_country: true,
        },
      }),
      prisma.deal.findMany({
        where: {
          OR: [
            { title: q },
            { acquirer_company: { name: q } },
            { target_company: { name: q } },
          ],
        },
        take: limit,
        include: {
          acquirer_company: { select: { name: true } },
          target_company: { select: { name: true } },
        },
        orderBy: { announced_date: 'desc' },
      }),
      prisma.insight.findMany({
        where: { OR: [{ title: q }, { summary: q }] },
        take: limit,
        select: { id: true, title: true, slug: true, content_type: true, published_at: true },
        orderBy: { published_at: 'desc' },
      }),
    ])

    return NextResponse.json({ contacts, companies, deals, insights })
  } catch (error) {
    console.error('Global search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
