// POST /api/intel/describe?key=… — writes a company's description with
// Claude, from what the intelligence layer already holds and the company's
// own homepage, and saves it as an AI-written description (description_kind
// 'ai') with the pages and records it was written from. The panel shows it
// with the note "AI generated description" until a person verifies it.
//
// Inputs, and nothing else: the Lusha or dataset description, the
// one-liner, the homepage text (20 KB at most, 8 seconds at most) and the
// latest signals. The output is three to five sentences in British
// English, plain words, only facts present in the inputs. Server side only.
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import type { IntelCompany, Source } from '@/lib/intel'
import { readIntelCompany, reviewerOf } from '@/lib/intelServer'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const HOMEPAGE_BYTES = 20 * 1024
const HOMEPAGE_TIMEOUT_MS = 8000

// The homepage as text: tags, scripts and styles gone, whitespace folded.
async function homepageText(website: string | null): Promise<{ url: string; text: string } | null> {
  if (!website) return null
  const url = /^https?:\/\//i.test(website) ? website : `https://${website}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(HOMEPAGE_TIMEOUT_MS), headers: { 'User-Agent': 'WNG-CRM/1.0 (company description)', Accept: 'text/html' }, redirect: 'follow' })
    if (!res.ok || !res.body) return null
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let got = 0
    while (got < HOMEPAGE_BYTES) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) { chunks.push(value); got += value.byteLength }
    }
    await reader.cancel().catch(() => {})
    const html = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, HOMEPAGE_BYTES))
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
    return text.length > 80 ? { url: res.url || url, text } : null
  } catch {
    return null
  }
}

const SYSTEM = [
  'You write short company descriptions for an internal CRM used by a conference organiser in health and pharma AI.',
  'Write in British English, in plain words, with no hype, no marketing adjectives and no claims of leadership.',
  'Use only facts that are present in the material you are given. Never add a number, a date, a customer, a product or a place that is not in it.',
  'If the material does not say what the company does, say so in one plain sentence rather than guessing.',
  'Three to five sentences, one paragraph, no headings, no bullet points, no quotation marks around the whole text.',
  'Say "the company" or its name; never "we".',
].join(' ')

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['description', 'used'],
  properties: {
    description: { type: 'string', description: 'Three to five sentences, British English, only facts from the inputs.' },
    used: { type: 'array', items: { type: 'string', enum: ['dataset_description', 'one_liner', 'homepage', 'signals'] }, description: 'Which of the inputs the description draws on.' },
  },
} as const

export async function POST(req: NextRequest) {
  const key = (req.nextUrl.searchParams.get('key') ?? '').trim()
  if (!key) return NextResponse.json({ error: 'key is needed' }, { status: 400 })
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the CRM, so nothing can be written.' }, { status: 400 })

  let company: IntelCompany | null
  try {
    company = await readIntelCompany(key, null)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read the company' }, { status: 500 })
  }
  if (!company) return NextResponse.json({ error: 'The intelligence layer has nothing on this company yet' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)
  const home = await homepageText(company.website)
  const existing = company.description.kind !== 'ai' ? company.description.value : null
  const signals = company.signals.slice(0, 8)

  const parts: string[] = [`Company name: ${company.name}`]
  if (company.hq) parts.push(`Headquarters, from the dataset: ${company.hq}`)
  if (company.categories.length) parts.push(`Categories in our dataset: ${company.categories.join(', ')}`)
  if (company.oneLiner) parts.push(`One-liner (one_liner): ${company.oneLiner}`)
  if (existing) parts.push(`Existing ${company.description.kind === 'lusha' ? 'Lusha' : 'dataset'} description (dataset_description): ${existing}`)
  if (home) parts.push(`Homepage text (homepage), ${home.url}:\n${home.text}`)
  if (signals.length) parts.push(`Latest signals (signals):\n${signals.map((s) => `- ${s.date ?? 'undated'} · ${s.type}: ${s.headline}`).join('\n')}`)
  if (parts.length === 1) return NextResponse.json({ error: 'There is nothing on file to write from: no description, one-liner, homepage or signals.' }, { status: 409 })

  const client = new Anthropic({ apiKey })
  let draft: { description: string; used: string[] }
  try {
    // Sonnet 5.5 with the server-side fallback, as the Content tab does: a
    // benign health or pharma brief can trip a safety classifier, and the
    // fallback re-runs it on the model Anthropic recommends.
    const res = await client.beta.messages.create({
      model: process.env.INTEL_DESCRIBE_MODEL?.trim() || 'claude-sonnet-5-5',
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Write the description for this company from the material below and nothing else.\n\n${parts.join('\n\n')}` }],
    })
    if (res.stop_reason === 'refusal') return NextResponse.json({ error: 'Claude declined to write this one.' }, { status: 502 })
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    draft = JSON.parse(text)
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `Claude answered with an error (${e.status}): ${e.message}` : e instanceof Error ? e.message : 'Claude did not answer'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
  const description = String(draft.description ?? '').replace(/\s+/g, ' ').trim()
  if (description.split(/[.!?](\s|$)/).filter((s) => s.trim()).length < 2) return NextResponse.json({ error: 'Claude did not write a usable description. Try again.' }, { status: 502 })

  // The pages and records the description was written from, with today's date.
  const used = new Set(draft.used ?? [])
  const sources: Source[] = []
  if (home && (used.size === 0 || used.has('homepage'))) sources.push({ kind: 'website', label: home.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), url: home.url, date: today })
  if (existing && (used.size === 0 || used.has('dataset_description'))) sources.push({ kind: company.description.kind === 'lusha' ? 'lusha' : 'seed', label: company.description.kind === 'lusha' ? 'Lusha company description' : 'WNG Intelligence dataset description', url: company.linkedinUrl ?? null, date: today })
  if (company.oneLiner && (used.size === 0 || used.has('one_liner'))) sources.push({ kind: 'seed', label: 'WNG Intelligence dataset one-liner', url: null, date: today })
  if (signals.length && (used.size === 0 || used.has('signals'))) for (const s of signals) sources.push({ kind: s.source.kind, label: `Signal: ${s.headline}`.slice(0, 160), url: s.source.url, date: s.date })

  const { data, error } = await supabase.rpc('intel_review', { p_action: 'set_description', p_payload: { key: company.key, description, kind: 'ai', sources, by: reviewerOf(req) } })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result = (data ?? {}) as { ok?: boolean; error?: string }
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'The description was not saved' }, { status: 400 })

  const fresh = await readIntelCompany(company.key, null).catch(() => null)
  return NextResponse.json({ ok: true, description, sources, company: fresh })
}
