import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getCRMContext(): Promise<string> {
  try {
    const [delegates, speakers, sponsors] = await Promise.all([
      supabase.from('delegates').select('status, event').limit(2000),
      supabase.from('speakers').select('status, event').limit(2000),
      supabase.from('companies').select('status, tier').limit(2000),
    ])

    const countBy = (rows: any[], key: string) =>
      (rows ?? []).reduce((acc: Record<string, number>, r: any) => {
        const v = r[key] ?? 'Unknown'
        acc[v] = (acc[v] ?? 0) + 1
        return acc
      }, {})

    const dByStatus = countBy(delegates.data ?? [], 'status')
    const spByStatus = countBy(speakers.data ?? [], 'status')
    const sponsorRows = (sponsors.data ?? []).filter((c: any) => !['Media Partner', 'Association Partner'].includes(c.tier))
    const snByStatus = countBy(sponsorRows, 'status')

    const fmt = (obj: Record<string, number>) =>
      Object.entries(obj).map(([k, v]) => `  - ${k}: ${v}`).join('\n') || '  - (none)'

    return `LIVE CRM DATA:
Delegates (${delegates.data?.length ?? 0} total):
${fmt(dByStatus)}

Speakers (${speakers.data?.length ?? 0} total):
${fmt(spByStatus)}

Sponsors (${sponsorRows.length} total):
${fmt(snByStatus)}`
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
            max_tokens: 800,
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
