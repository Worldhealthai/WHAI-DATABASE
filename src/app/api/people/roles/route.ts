// GET /api/people/roles?email=…&first=…&last=…&org=… — every record one
// person has in the CRM: speaker, delegate, sponsor or partner contact,
// in any event. Matched on email; without one, on first and last name at
// the same company. Read only. Profiles use it to link a person's records
// to each other ("Also a speaker at London 2027…"), and the delegate form
// to know whether they are speaking.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { companyKey } from '@/lib/segments'

export const dynamic = 'force-dynamic'

export interface PersonRole {
  kind: 'speaker' | 'delegate' | 'sponsor' | 'partner'
  id: string           // the record to open (a company's row for a sponsor or partner contact)
  event: string | null
  status: string | null
  company: string | null
  ticketType?: string | null
}

const esc = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const email = (q.get('email') || '').trim().toLowerCase()
  const first = (q.get('first') || '').trim()
  const last = (q.get('last') || '').trim()
  const org = companyKey(q.get('org'))
  if (!email && !(first && last)) return NextResponse.json({ roles: [] })
  try {
    const roles: PersonRole[] = []
    for (const [kind, table] of [['speaker', 'speakers'], ['delegate', 'delegates']] as const) {
      const cols = `id, event, status, organization, email, "firstName", "lastName"${kind === 'delegate' ? ', "ticketType"' : ''}`
      const query = email
        ? supabase.from(table).select(cols).ilike('email', esc(email))
        : supabase.from(table).select(cols).ilike('firstName', esc(first)).ilike('lastName', esc(last))
      const { data, error } = await query.limit(50)
      if (error) throw error
      for (const r of (data ?? []) as any[]) {
        if (!email && org && companyKey(r.organization) !== org) continue
        roles.push({ kind, id: r.id, event: r.event, status: r.status, company: r.organization, ...(kind === 'delegate' ? { ticketType: r.ticketType ?? null } : {}) })
      }
    }
    for (const [kind, table] of [['sponsor', 'sponsors'], ['partner', 'partners']] as const) {
      const cols = 'id, "companyId", "companyName", event, status, "contactEmail", "contactFirstName", "contactLastName"'
      const query = email
        ? supabase.from(table).select(cols).ilike('contactEmail', esc(email))
        : supabase.from(table).select(cols).ilike('contactFirstName', esc(first)).ilike('contactLastName', esc(last))
      const { data, error } = await query.limit(50)
      if (error) throw error
      const rows = (data ?? []) as any[]
      // A contact row stands for its company: show the company's event and stage.
      const parentIds = Array.from(new Set(rows.map((r) => r.companyId).filter(Boolean)))
      const parents = new Map<string, any>()
      if (parentIds.length) {
        const { data: ps } = await supabase.from(table).select('id, "companyName", event, status').in('id', parentIds)
        for (const p of ps ?? []) parents.set(p.id, p)
      }
      for (const r of rows) {
        const c = r.companyId ? parents.get(r.companyId) ?? r : r
        if (!email && org && companyKey(c.companyName) !== org) continue
        roles.push({ kind, id: c.id, event: c.event, status: c.status, company: c.companyName })
      }
    }
    // One entry per record.
    const seen = new Set<string>()
    const unique = roles.filter((r) => (seen.has(`${r.kind}:${r.id}`) ? false : (seen.add(`${r.kind}:${r.id}`), true)))
    unique.sort((a, b) => String(b.event ?? '').localeCompare(String(a.event ?? '')))
    return NextResponse.json({ roles: unique })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 })
  }
}
