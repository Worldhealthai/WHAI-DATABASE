// GET /api/agent/companies — the CRM's companies, for agents. Read only.
// Reached with the agents' key (Authorization: Bearer AGENT_READ_TOKEN),
// a CRM session, or the shared webhook secret (proxy.ts).
//   ?q=<words>          name, website or country contains every word
//   ?type=solution-provider | end-user
//   ?limit=50 (max 200) &offset=0
// → { total, limit, offset, companies: [...] }, by name. One company with
// its people: /api/agent/companies/<key>.
import { NextRequest, NextResponse } from 'next/server'
import { consolidate } from '@/lib/segments'
import { loadContacts } from '@/lib/segmentData'
import { companyCard, matches, paging, typeFilter } from '@/lib/agentView'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') || '').trim().slice(0, 120)
  const type = typeFilter(sp.get('type'))
  const { limit, offset } = paging(sp)
  try {
    const { accounts } = consolidate(await loadContacts(null))
    const hits = accounts
      .filter((a) => a.key !== '__none')
      .filter((a) => !type || a.firmographic === type)
      .filter((a) => !q || matches(q, a.name, a.website, a.country))
      .sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json(
      { total: hits.length, limit, offset, companies: hits.slice(offset, offset + limit).map(companyCard) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('agent companies:', e)
    return NextResponse.json({ error: 'Could not read companies' }, { status: 500 })
  }
}
