// Leads handed over by Control Room's agents ("Add to CRM" on a sponsor or
// speaker it found). POST /api/agent/intake turns each into an ordinary
// Sales or Production record at Not Contacted, marked with the agent that
// found it (agent, agentName, agentAddedAt), so Tools → Agents' work and
// its filters can say where every lead came from. The agent's reasoning,
// evidence and source go into the record's notes. Nothing is sent to
// anyone.
import { EVENT_OPTIONS, canonicalEventLabel } from '@/types'

const s = (v: unknown, max = 500): string | null => {
  const t = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
  return t ? t.slice(0, max) : null
}
const list = (v: unknown, max = 8): string[] => (Array.isArray(v) ? v.map((x) => s(x, 400)).filter((x): x is string => !!x).slice(0, max) : [])
const url = (v: unknown): string | null => { const t = s(v, 600); return t && /^https?:\/\//i.test(t) ? t : null }

// The edition the lead is for. Control Room names it in words ("World
// Health AI London 2027", "WPAI", "World Pharma AI"); anything short of a
// full label goes to the series' latest edition.
export function intakeEvent(raw: unknown, agentName: string | null): string {
  const t = s(raw, 120) ?? ''
  const canon = canonicalEventLabel(t)
  if (canon && /^World (Health|Pharma) AI [A-Z][a-z]+ 20\d{2}$/.test(canon)) return canon
  const hay = `${t} ${agentName ?? ''}`.toLowerCase()
  const series = /pharma|wpai/.test(hay) ? 'World Pharma AI' : 'World Health AI'
  const of = EVENT_OPTIONS.filter((e) => e.startsWith(series)).sort((a, b) => Number(b.slice(-4)) - Number(a.slice(-4)))
  return of[0] ?? `${series} London ${new Date().getFullYear() + 1}`
}

export const yearOf = (event: string) => Number(event.match(/\b(20\d{2})\b/)?.[1]) || null
export const sideOf = (event: string) => (/pharma/i.test(event) ? 'Pharma' : 'Health')

function splitName(full: string | null): { first: string | null; last: string | null } {
  const parts = (full ?? '').replace(/^(dr|prof|professor|mr|mrs|ms)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { first: null, last: null }
  return { first: parts[0], last: parts.slice(1).join(' ') || null }
}

const block = (title: string, lines: (string | null)[]) => {
  const kept = lines.filter((x): x is string => !!x)
  return kept.length ? `${title}:\n${kept.map((x) => `- ${x}`).join('\n')}` : null
}

export interface AgentWho { agent: string; agentName: string }

export function agentOf(body: Record<string, unknown>): AgentWho | null {
  const agent = (s(body.agent, 80) ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  if (!agent) return null
  return { agent, agentName: s(body.agent_name ?? body.agentName, 120) ?? agent }
}

// A sponsor lead, in the shape Control Room's sponsor bank keeps.
export function sponsorRow(x: Record<string, unknown>, who: AgentWho, eventRaw: unknown) {
  const company = s(x.company, 200)
  if (!company) return null
  const event = intakeEvent(x.event ?? eventRaw, who.agentName)
  const { first, last } = splitName(s(x.contact_name, 160))
  const notes = [
    `Found by ${who.agentName} (Control Room)${s(x.source) ? ` · ${s(x.source)}` : ''}${url(x.source_url) ? ` · ${url(x.source_url)}` : ''}`,
    s(x.why, 2000) && `Why: ${s(x.why, 2000)}`,
    s(x.sector) && `Sells: ${s(x.sector)}`,
    s(x.fit, 600) && `Fit on the agenda: ${s(x.fit, 600)}`,
    s(x.offer, 600) && `Pitch: ${s(x.offer, 600)}`,
    s(x.contact_why, 600) && `Why this contact: ${s(x.contact_why, 600)}`,
    block('Evidence', list(x.evidence)),
    block('Sponsored before', list(x.competitor_events)),
    block('Others to approach', list(x.other_contacts)),
  ].filter(Boolean).join('\n\n')
  return {
    event,
    row: {
      companyName: company,
      website: url(x.website),
      contactFirstName: first,
      contactLastName: last,
      contactJobTitle: s(x.contact_title, 200),
      contactLinkedinUrl: url(x.contact_linkedin),
      country: s(x.country, 80),
      status: 'Not Contacted',
      event,
      tags: `${sideOf(event)}, Agent lead`,
      notes,
      agent: who.agent,
      agentName: who.agentName,
      agentAddedAt: new Date().toISOString(),
    },
  }
}

// A speaker lead, in the shape Control Room's speaker bank keeps.
export function speakerRow(x: Record<string, unknown>, who: AgentWho, eventRaw: unknown) {
  const { first, last } = splitName(s(x.name, 160))
  if (!first) return null
  const event = intakeEvent(x.event ?? eventRaw, who.agentName)
  const notes = [
    `Found by ${who.agentName} (Control Room)${s(x.source) ? ` · ${s(x.source)}` : ''}${url(x.source_url) ? ` · ${url(x.source_url)}` : ''}`,
    s(x.why, 2000) && `Why: ${s(x.why, 2000)}`,
    s(x.panel, 300) && `Suggested for: ${s(x.panel, 300)}`,
    block('Talking points', list(x.talking_points)),
  ].filter(Boolean).join('\n\n')
  return {
    event,
    row: {
      firstName: first,
      lastName: last ?? '',
      jobTitle: s(x.role, 200),
      organization: s(x.organisation ?? x.organization, 200),
      linkedinUrl: url(x.linkedin_url),
      country: s(x.country, 80),
      bio: s(x.bio, 3000),
      expertiseAreas: list(x.topics, 12).join(', ') || null,
      sessionTitle: s(x.panel, 300),
      status: 'Not Contacted',
      event,
      year: yearOf(event),
      tags: `${sideOf(event)}, Agent lead`,
      notes,
      agent: who.agent,
      agentName: who.agentName,
      agentAddedAt: new Date().toISOString(),
    },
  }
}
