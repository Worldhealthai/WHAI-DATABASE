import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getCRMContext(): Promise<string> {
  try {
    const PARTNER_TIERS = ['Media Partner', 'Association Partner']

    const [speakersRes, delegatesRes, companiesRes, contactsRes] = await Promise.all([
      supabase.from('speakers')
        .select('firstName, lastName, organization, jobTitle, status, event, subType, sessionTitle, tags')
        .limit(500),
      supabase.from('delegates')
        .select('firstName, lastName, organization, jobTitle, status, event, subType')
        .limit(500),
      // Parent company rows (companyId IS NULL)
      supabase.from('sponsors')
        .select('id, companyName, tier, status, event, country, city, contactFirstName, contactLastName, contactJobTitle, tags')
        .is('companyId', null)
        .limit(500),
      // Linked contact rows (companyId IS NOT NULL)
      supabase.from('sponsors')
        .select('companyId, contactFirstName, contactLastName, contactJobTitle')
        .not('companyId', 'is', null)
        .limit(1000),
    ])

    const countBy = (rows: any[], key: string) =>
      (rows ?? []).reduce((acc: Record<string, number>, r: any) => {
        const v = r[key] ?? 'Unknown'
        acc[v] = (acc[v] ?? 0) + 1
        return acc
      }, {})

    // Build contact map: companyId → contact names
    const contactMap: Record<string, string[]> = {}
    for (const c of contactsRes.data ?? []) {
      const name = [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ')
      if (name) {
        if (!contactMap[c.companyId]) contactMap[c.companyId] = []
        contactMap[c.companyId].push(`${name}${c.contactJobTitle ? ' (' + c.contactJobTitle + ')' : ''}`)
      }
    }

    const speakers  = speakersRes.data  ?? []
    const delegates = delegatesRes.data ?? []
    const allCompanies = companiesRes.data ?? []
    const sponsors = allCompanies.filter((c: any) => !PARTNER_TIERS.includes(c.tier))
    const partners = allCompanies.filter((c: any) => PARTNER_TIERS.includes(c.tier))

    const spByStatus = countBy(speakers, 'status')
    const dByStatus  = countBy(delegates, 'status')
    const snByStatus = countBy(sponsors, 'status')
    const ptByStatus = countBy(partners, 'status')

    const fmtSpeaker = (r: any) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Unknown'
      const org  = r.organization ? ` (${r.organization}${r.jobTitle ? ', ' + r.jobTitle : ''})` : ''
      const meta = [r.status, r.event].filter(Boolean).join(' | ')
      const session = r.sessionTitle ? ` — "${r.sessionTitle}"` : ''
      const tags = r.tags ? ` [${r.tags}]` : ''
      return `  - ${name}${org} | ${meta}${session}${tags}`
    }

    const fmtDelegate = (r: any) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Unknown'
      const org  = r.organization ? ` (${r.organization}${r.jobTitle ? ', ' + r.jobTitle : ''})` : ''
      const meta = [r.status, r.event, r.subType].filter(Boolean).join(' | ')
      return `  - ${name}${org} | ${meta}`
    }

    const fmtCompany = (r: any) => {
      const loc  = [r.city, r.country].filter(Boolean).join(', ')
      const meta = [r.status, r.tier, r.event, loc].filter(Boolean).join(' | ')
      // Primary contact on the company record
      const primaryName = [r.contactFirstName, r.contactLastName].filter(Boolean).join(' ')
      const primaryTitle = r.contactJobTitle ? ` (${r.contactJobTitle})` : ''
      const primary = primaryName ? `${primaryName}${primaryTitle}` : ''
      // Additional linked contacts
      const linked = contactMap[r.id] ?? []
      const allContacts = [...new Set([primary, ...linked].filter(Boolean))]
      const contacts = allContacts.length ? ` | Contacts: ${allContacts.join(', ')}` : ''
      const tags = r.tags ? ` [${r.tags}]` : ''
      return `  - ${r.companyName ?? 'Unknown'} | ${meta}${contacts}${tags}`
    }

    return `LIVE CRM DATA:

SPEAKERS (${speakers.length} total) — pipeline: ${JSON.stringify(spByStatus)}
${speakers.map(fmtSpeaker).join('\n') || '  (none)'}

DELEGATES (${delegates.length} total) — pipeline: ${JSON.stringify(dByStatus)}
${delegates.map(fmtDelegate).join('\n') || '  (none yet)'}

SPONSORS (${sponsors.length} total) — pipeline: ${JSON.stringify(snByStatus)}
${sponsors.map(fmtCompany).join('\n') || '  (none)'}

PARTNERS & MEDIA (${partners.length} total) — pipeline: ${JSON.stringify(ptByStatus)}
${partners.map(fmtCompany).join('\n') || '  (none)'}`
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

    const systemPrompt = `You are Pulse, the AI assistant for World Health AI (WHAI) events.

${crmContext}

Events: UK Forum, US Forum.

RULES:
1. For simple CRM count/status questions ("how many sponsors in discussion?", "show me the pipeline"), answer directly from the data above. No web search needed.
2. For questions that combine CRM data with external knowledge — such as researching speakers, profiling companies, identifying panel candidates, finding competitor events, or any question where real-world context helps — use web_search to enrich your answer.
3. Write in plain clear text. No markdown symbols (no **, ##, >, ---). Use numbered lists (1. 2. 3.) and dashes (- item) for structure.
4. Be concise and specific.`

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1200,
            system: systemPrompt,
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            tools: [{ type: 'web_search_20260209' as any, name: 'web_search', max_uses: 2 }],
            stream: true,
          })

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
