// POST /api/agent/intake — Control Room's "Add to CRM".
//
// Auth: Authorization: Bearer <AGENT_WRITE_TOKEN> (src/proxy.ts). The key
// opens this route only, and only for POST.
//
// Body:
//   { "agent": "bumble", "agent_name": "Bumble - WHAI Sales",
//     "event": "World Health AI London 2027",            // optional default
//     "sponsors": [ { company, website, contact_name, contact_title,
//                     contact_linkedin, contact_why, country, event, why,
//                     evidence[], competitor_events[], fit, offer, sector,
//                     other_contacts[], source, source_url } ],
//     "speakers": [ { name, role, organisation, linkedin_url, country, bio,
//                     event, panel, topics[], talking_points[], why,
//                     source, source_url } ] }
// Up to 100 of each. Each becomes a Sales (sponsor) or Production (speaker)
// record at Not Contacted, marked with the agent. One already in the CRM
// for the same event (a company by name, a person by LinkedIn or by name)
// is left as it is: it is reported as "existing", and takes the agent's
// mark only if it had none.
//
// Answer: { sponsors: [{ company, id, status: "added" | "existing" }],
//           speakers: [{ name, id, status }], skipped: n }
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { agentOf, speakerRow, sponsorRow } from '@/lib/agentIntake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/\b(ltd|limited|inc|plc|llc|gmbh|ag|sa)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'The body must be JSON.' }, { status: 400 })
  const who = agentOf(body)
  if (!who) return NextResponse.json({ error: 'Name the agent ("agent").' }, { status: 400 })
  const sponsorsIn = (Array.isArray(body.sponsors) ? body.sponsors : []).slice(0, 100) as Record<string, unknown>[]
  const speakersIn = (Array.isArray(body.speakers) ? body.speakers : []).slice(0, 100) as Record<string, unknown>[]
  if (!sponsorsIn.length && !speakersIn.length) return NextResponse.json({ error: 'Send "sponsors" or "speakers".' }, { status: 400 })

  let skipped = 0
  const sponsors: { company: string; id: string; status: 'added' | 'existing'; event: string }[] = []
  const speakers: { name: string; id: string; status: 'added' | 'existing'; event: string }[] = []

  for (const x of sponsorsIn) {
    const made = x && typeof x === 'object' ? sponsorRow(x, who, body.event) : null
    if (!made) { skipped++; continue }
    const { data: same } = await supabase.from('sponsors').select('id, companyName, agent').is('companyId', null).eq('event', made.event).ilike('companyName', made.row.companyName)
    const hit = (same ?? []).find((r) => norm(r.companyName) === norm(made.row.companyName))
    if (hit) {
      if (!hit.agent) await supabase.from('sponsors').update({ agent: who.agent, agentName: who.agentName, agentAddedAt: made.row.agentAddedAt }).eq('id', hit.id)
      sponsors.push({ company: made.row.companyName, id: hit.id, status: 'existing', event: made.event })
      continue
    }
    const { data, error } = await supabase.from('sponsors').insert(made.row).select('id').single()
    if (error || !data) return NextResponse.json({ error: `Could not add ${made.row.companyName}: ${error?.message ?? 'no row'}`, sponsors, speakers }, { status: 500 })
    sponsors.push({ company: made.row.companyName, id: data.id, status: 'added', event: made.event })
  }

  for (const x of speakersIn) {
    const made = x && typeof x === 'object' ? speakerRow(x, who, body.event) : null
    if (!made) { skipped++; continue }
    const name = `${made.row.firstName} ${made.row.lastName}`.trim()
    let hit: { id: string; agent: string | null } | undefined
    if (made.row.linkedinUrl) {
      const slug = made.row.linkedinUrl.replace(/\/+$/, '').split('/').pop()
      if (slug) {
        const { data } = await supabase.from('speakers').select('id, agent').eq('event', made.event).ilike('linkedinUrl', `%${slug}%`).limit(1)
        hit = data?.[0]
      }
    }
    if (!hit) {
      const { data } = await supabase.from('speakers').select('id, agent, firstName, lastName').eq('event', made.event).ilike('firstName', made.row.firstName).limit(20)
      hit = (data ?? []).find((r) => norm(`${r.firstName} ${r.lastName}`) === norm(name))
    }
    if (hit) {
      if (!hit.agent) await supabase.from('speakers').update({ agent: who.agent, agentName: who.agentName, agentAddedAt: made.row.agentAddedAt }).eq('id', hit.id)
      speakers.push({ name, id: hit.id, status: 'existing', event: made.event })
      continue
    }
    const { data, error } = await supabase.from('speakers').insert(made.row).select('id').single()
    if (error || !data) return NextResponse.json({ error: `Could not add ${name}: ${error?.message ?? 'no row'}`, sponsors, speakers }, { status: 500 })
    speakers.push({ name, id: data.id, status: 'added', event: made.event })
  }

  return NextResponse.json({ sponsors, speakers, skipped }, { status: 201 })
}
