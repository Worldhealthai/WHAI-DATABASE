// GET /api/linkedin/company?q=<the page's link, short name or number>
//   → { urn, name, vanity }: a company's LinkedIn page, to tag on a post
//   (lib/linkedin findCompany). Needs the LinkedIn connection.
import { NextRequest, NextResponse } from 'next/server'
import { LinkedInError, findCompany } from '@/lib/linkedin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  try {
    return NextResponse.json(await findCompany(q))
  } catch (e) {
    if (e instanceof LinkedInError) return NextResponse.json({ error: e.message, reconnect: e.reconnect }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'The company could not be found' }, { status: 500 })
  }
}
