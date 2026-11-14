// GET /api/agents — every sponsor and speaker lead an agent handed over
// (Control Room's "Add to CRM"), newest first, for Tools → Agents' work.
// ?event= narrows to one edition. Signed-in CRM users only (proxy).
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const event = req.nextUrl.searchParams.get('event')
  let sq = supabase.from('sponsors').select('id, companyName, contactFirstName, contactLastName, contactJobTitle, event, status, agent, agentName, agentAddedAt').not('agent', 'is', null).is('companyId', null)
  let pq = supabase.from('speakers').select('id, firstName, lastName, jobTitle, organization, event, status, agent, agentName, agentAddedAt').not('agent', 'is', null)
  if (event) { sq = sq.eq('event', event); pq = pq.eq('event', event) }
  const [s, p] = await Promise.all([sq.order('agentAddedAt', { ascending: false }).limit(2000), pq.order('agentAddedAt', { ascending: false }).limit(2000)])
  if (s.error || p.error) return NextResponse.json({ error: (s.error ?? p.error)!.message }, { status: 500 })
  return NextResponse.json({
    leads: [
      ...(s.data ?? []).map((r) => ({ kind: 'sponsor' as const, id: r.id, name: r.companyName, sub: [[r.contactFirstName, r.contactLastName].filter(Boolean).join(' '), r.contactJobTitle].filter(Boolean).join(', ') || null, event: r.event, status: r.status, agent: r.agent, agentName: r.agentName ?? r.agent, at: r.agentAddedAt })),
      ...(p.data ?? []).map((r) => ({ kind: 'speaker' as const, id: r.id, name: `${r.firstName} ${r.lastName}`.trim(), sub: [r.jobTitle, r.organization].filter(Boolean).join(', ') || null, event: r.event, status: r.status, agent: r.agent, agentName: r.agentName ?? r.agent, at: r.agentAddedAt })),
    ].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? ''))),
  })
}
