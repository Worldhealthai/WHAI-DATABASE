// GET /api/agent/companies/<key> — one company and its people, for agents.
// Read only (see /api/agent/companies). <key> is the `key` the list gives.
// → { company: {...}, contacts: [...] }
import { NextRequest, NextResponse } from 'next/server'
import { consolidate } from '@/lib/segments'
import { loadContacts } from '@/lib/segmentData'
import { companyCard, contactCard } from '@/lib/agentView'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const key = decodeURIComponent((await ctx.params).key || '').trim()
  if (!key || key === '__none') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const { accounts, people } = consolidate(await loadContacts(null))
    const account = accounts.find((a) => a.key === key)
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const contacts = people.filter((p) => p.companyKey === key).sort((a, b) => a.name.localeCompare(b.name)).map(contactCard)
    return NextResponse.json({ company: companyCard(account), contacts }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('agent company:', e)
    return NextResponse.json({ error: 'Could not read the company' }, { status: 500 })
  }
}
