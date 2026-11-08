// GET /api/agent/contacts — the CRM's contacts, for agents. Read only.
// Reached with the agents' key (Authorization: Bearer AGENT_READ_TOKEN),
// a CRM session, or the shared webhook secret (proxy.ts).
//   ?q=<words>          name, job title, company or email contains every word
//   ?title=<words>      job title contains every word ("head digital")
//   ?company=<words>    company name contains every word
//   ?email=<address>    exactly this person
//   ?type=solution-provider | end-user   (their company's type)
//   ?limit=50 (max 200) &offset=0
// → { total, limit, offset, contacts: [...] }, by name.
import { NextRequest, NextResponse } from 'next/server'
import { consolidate } from '@/lib/segments'
import { loadContacts } from '@/lib/segmentData'
import { contactCard, matches, paging, typeFilter } from '@/lib/agentView'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const get = (k: string) => (sp.get(k) || '').trim().slice(0, 120)
  const q = get('q')
  const title = get('title')
  const company = get('company')
  const email = get('email').toLowerCase()
  const type = typeFilter(sp.get('type'))
  const { limit, offset } = paging(sp)
  try {
    const { people } = consolidate(await loadContacts(null))
    const hits = people
      .filter((p) => !email || p.email === email)
      .filter((p) => !type || p.firmographic === type)
      .filter((p) => !title || matches(title, p.jobTitle))
      .filter((p) => !company || matches(company, p.company))
      .filter((p) => !q || matches(q, p.name, p.jobTitle, p.company, p.email))
      .sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json(
      { total: hits.length, limit, offset, contacts: hits.slice(offset, offset + limit).map(contactCard) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('agent contacts:', e)
    return NextResponse.json({ error: 'Could not read contacts' }, { status: 500 })
  }
}
