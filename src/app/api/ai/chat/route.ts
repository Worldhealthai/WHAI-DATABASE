import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getCRMContext(): Promise<string> {
  try {
    const [delegates, speakers, sponsors] = await Promise.all([
      supabase.from('delegates').select('status, event, subType').limit(2000),
      supabase.from('speakers').select('status, event, subType').limit(2000),
      supabase.from('companies').select('status, event, tier, name').limit(2000),
    ])

    const countBy = (rows: any[], key: string) =>
      rows?.reduce((acc: Record<string, number>, r: any) => {
        const v = r[key] ?? 'Unknown'
        acc[v] = (acc[v] ?? 0) + 1
        return acc
      }, {}) ?? {}

    const delegatesByStatus = countBy(delegates.data ?? [], 'status')
    const speakersByStatus  = countBy(speakers.data ?? [], 'status')
    const sponsorsByStatus  = countBy(
      (sponsors.data ?? []).filter((c: any) => !['Media Partner', 'Association Partner'].includes(c.tier)),
      'status',
    )

    const totalDelegates = delegates.data?.length ?? 0
    const totalSpeakers  = speakers.data?.length ?? 0
    const totalSponsors  = Object.values(sponsorsByStatus).reduce((a, b) => a + b, 0)

    return `
WHAI CRM LIVE DATA (as of now):
- Delegates: ${totalDelegates} total | ${JSON.stringify(delegatesByStatus)}
- Speaker Leads: ${totalSpeakers} total | ${JSON.stringify(speakersByStatus)}
- Sponsors: ${totalSponsors} total | ${JSON.stringify(sponsorsByStatus)}
Events: UK Forum, US Forum
`.trim()
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

    const systemPrompt = `You are WHAI AI Assistant for the World Health AI events team. Be concise and professional.

LIVE CRM DATA:
${crmContext}

Events: UK Forum, US Forum. Use web search for live industry info, competitors, and speaker research.`

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            tools: [{ type: 'web_search_20260209' as any, name: 'web_search', max_uses: 3 }],
            stream: true,
          })

          let buffer = ''
          for await (const event of response) {
            if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                buffer += event.delta.text
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`))
              }
            } else if (event.type === 'content_block_start') {
              if (event.content_block.type === 'tool_use' && event.content_block.name === 'web_search') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'searching' })}\n\n`))
              }
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
