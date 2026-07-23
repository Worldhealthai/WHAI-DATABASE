import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { EVENT_OPTIONS } from '@/types'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Distinct event labels in the data, so the assistant knows every event —
// not just the legacy UK/US Forum pair.
async function getEventNames(): Promise<string[]> {
  const names = new Set<string>(EVENT_OPTIONS)
  try {
    const [d, s] = await Promise.all([
      supabase.from('delegates').select('event').not('event', 'is', null),
      supabase.from('speakers').select('event').not('event', 'is', null),
    ])
    for (const rows of [d.data, s.data]) {
      for (const r of rows ?? []) {
        const v = (r as { event?: string }).event?.trim()
        if (v) names.add(v)
      }
    }
  } catch {
    // fall back to the base pair
  }
  return [...names]
}

async function getCRMContext(): Promise<string> {
  try {
    const [speakersRes, delegatesRes, sponsorsRes, partnersRes, contactsRes, partnerContactsRes] = await Promise.all([
      supabase.from('speakers')
        .select('firstName, lastName, organization, jobTitle, status, event, subType, sessionTitle, tags')
        .limit(500),
      supabase.from('delegates')
        .select('firstName, lastName, organization, jobTitle, status, event, subType')
        .limit(500),
      supabase.from('sponsors')
        .select('id, companyName, tier, status, event, country, contactFirstName, contactLastName, contactJobTitle, tags')
        .is('companyId', null)
        .limit(500),
      supabase.from('partners')
        .select('id, companyName, tier, status, event, country, contactFirstName, contactLastName, contactJobTitle, tags')
        .is('companyId', null)
        .limit(500),
      supabase.from('sponsors')
        .select('companyId, contactFirstName, contactLastName, contactJobTitle')
        .not('companyId', 'is', null)
        .limit(1000),
      supabase.from('partners')
        .select('companyId, contactFirstName, contactLastName, contactJobTitle')
        .not('companyId', 'is', null)
        .limit(1000),
    ])

    const countBy = (rows: any[], key: string) =>
      (rows ?? []).reduce((acc: Record<string, number>, r: any) => {
        const v = r[key] ?? 'Unknown'; acc[v] = (acc[v] ?? 0) + 1; return acc
      }, {})

    const contactMap: Record<string, string[]> = {}
    for (const c of [...(contactsRes.data ?? []), ...(partnerContactsRes.data ?? [])]) {
      const name = [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ')
      if (name) {
        if (!contactMap[c.companyId]) contactMap[c.companyId] = []
        contactMap[c.companyId].push(c.contactJobTitle ? `${name} (${c.contactJobTitle})` : name)
      }
    }

    const speakers  = speakersRes.data  ?? []
    const delegates = delegatesRes.data ?? []
    const sponsors  = sponsorsRes.data  ?? []
    const partners  = partnersRes.data  ?? []

    // Compact one-liner per record to minimise tokens
    const fmtSp = (r: any) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || '?'
      const org  = [r.organization, r.jobTitle].filter(Boolean).join(', ')
      const session = r.sessionTitle ? ` | "${r.sessionTitle}"` : ''
      return `${name} | ${org} | ${r.status ?? '?'} | ${r.event ?? '?'}${session}`
    }
    const fmtDel = (r: any) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || '?'
      const org  = [r.organization, r.jobTitle].filter(Boolean).join(', ')
      return `${name} | ${org} | ${r.status ?? '?'} | ${r.event ?? '?'}`
    }
    const fmtCo = (r: any) => {
      const primary = [r.contactFirstName, r.contactLastName].filter(Boolean).join(' ')
      const primaryFull = primary ? (r.contactJobTitle ? `${primary} (${r.contactJobTitle})` : primary) : ''
      const linked = contactMap[r.id] ?? []
      const contacts = [...new Set([primaryFull, ...linked].filter(Boolean))].join(', ')
      return `${r.companyName ?? '?'} | ${r.tier ?? '?'} | ${r.status ?? '?'} | ${r.event ?? '?'} | ${r.country ?? '?'}${contacts ? ' | ' + contacts : ''}`
    }

    return `LIVE CRM DATA (${new Date().toISOString().slice(0, 10)}):

SPEAKERS (${speakers.length}) — ${JSON.stringify(countBy(speakers, 'status'))}
${speakers.map(fmtSp).join('\n') || '(none)'}

DELEGATES (${delegates.length}) — ${JSON.stringify(countBy(delegates, 'status'))}
${delegates.map(fmtDel).join('\n') || '(none yet)'}

SPONSORS (${sponsors.length}) — ${JSON.stringify(countBy(sponsors, 'status'))}
${sponsors.map(fmtCo).join('\n') || '(none)'}

PARTNERS (${partners.length}) — ${JSON.stringify(countBy(partners, 'status'))}
${partners.map(fmtCo).join('\n') || '(none)'}`
  } catch {
    return 'CRM data temporarily unavailable.'
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    const crmContext = await getCRMContext()
    const eventNames = await getEventNames()

    const systemPrompt = `You are Pulse, the AI assistant for World Health AI (WHAI) events.

${crmContext}

Events: ${eventNames.join(', ')}.

RULES:
1. When the user refers to "my speakers", "my sponsors", "my CRM", "go through all of them" — always scan EVERY record in the data above, across ALL statuses (Not Contacted, Invited, Discussing, Confirmed, Rejected, etc.), unless they explicitly ask to filter by a specific status.
2. For simple CRM count/status questions, answer directly from the data above without web search.
3. For questions that benefit from external context — researching speakers, profiling companies, finding panel candidates, competitor events — use web_search to enrich your answer alongside the CRM data.
4. Write in plain clear text. No markdown symbols (no **, ##, >, ---). Use numbered lists and dashes for structure.
5. Be concise and specific.`

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1200,
            system: [
              {
                type: 'text',
                text: systemPrompt,
                cache_control: { type: 'ephemeral' } as any,
              },
            ],
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            tools: [{ type: 'web_search_20260209' as any, name: 'web_search', max_uses: 2 }],
            stream: true,
          } as any)

          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`))
            } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'searching' })}\n\n`))
            } else if (event.type === 'message_stop') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
            }
          }
        } catch (err: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', text: err.message ?? 'Unknown error' })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
