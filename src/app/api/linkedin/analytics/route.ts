// GET /api/linkedin/analytics?brand=health|pharma|nexus&days=7|30|90
//   → how the brand's LinkedIn page and its posts did over the period
//   (lib/linkedinAnalytics), read live from LinkedIn.
import { NextRequest, NextResponse } from 'next/server'
import { LinkedInError } from '@/lib/linkedin'
import { pageAnalytics } from '@/lib/linkedinAnalytics'
import type { BrandKey } from '@/lib/contentBrand'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BRANDS: BrandKey[] = ['health', 'pharma', 'nexus']
const PERIODS = [7, 30, 90, 365]

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get('brand') as BrandKey
  const days = Number(req.nextUrl.searchParams.get('days') || 30)
  if (!BRANDS.includes(brand)) return NextResponse.json({ error: 'Unknown brand' }, { status: 400 })
  if (!PERIODS.includes(days)) return NextResponse.json({ error: 'Unknown period' }, { status: 400 })
  try {
    return NextResponse.json(await pageAnalytics(brand, days))
  } catch (e) {
    if (e instanceof LinkedInError) return NextResponse.json({ error: e.message, reconnect: e.reconnect }, { status: e.status })
    console.error('LinkedIn analytics error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'The figures could not be read from LinkedIn' }, { status: 500 })
  }
}
