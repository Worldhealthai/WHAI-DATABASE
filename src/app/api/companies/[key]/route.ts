// GET /api/companies/:key?name=… — one company across every event, with
// its whole team: sponsor contacts, speakers, delegates and leads
// (lib/segments). For a company's own page when it has no sponsor record,
// and for a contact's colleagues. Read only.
import { NextRequest, NextResponse } from 'next/server'
import { companyKey, consolidate } from '@/lib/segments'
import { loadContacts } from '@/lib/segmentData'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params
  const name = (req.nextUrl.searchParams.get('name') || '').trim()
  if (!name) return NextResponse.json({ error: 'name is needed' }, { status: 400 })
  try {
    const contacts = await loadContacts(null, { company: name })
    const { accounts, people } = consolidate(contacts)
    const want = decodeURIComponent(key) || companyKey(name)
    const account = accounts.find((a) => a.key === want) ?? accounts.find((a) => a.key === companyKey(name)) ?? null
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ account, people: people.filter((p) => p.companyKey === account.key) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load the company' }, { status: 500 })
  }
}
