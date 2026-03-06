import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Returns all taxonomy reference data needed by filter sidebars
// Cached at edge for performance

export const revalidate = 3600 // 1 hour

export async function GET() {
  try {
    const [verticals, therapeuticAreas, jobFunctions, regions] = await Promise.all([
      prisma.healthcareVertical.findMany({
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
        include: {
          children: {
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
          },
        },
        where: { parent_id: null }, // top-level only
      }),
      prisma.therapeuticArea.findMany({
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      }),
      prisma.jobFunction.findMany({
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      }),
      prisma.region.findMany({
        where: { parent_id: null },
        include: {
          children: {
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({ verticals, therapeuticAreas, jobFunctions, regions })
  } catch (error) {
    console.error('Taxonomy API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
