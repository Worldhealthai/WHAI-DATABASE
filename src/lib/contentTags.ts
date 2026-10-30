// The companies a post names, as LinkedIn pages to tag (the Content tab's
// "Suggest from the post"). Claude reads the post's words and names the
// companies in it, with its best guess at each one's LinkedIn page; the
// pages the team tagged on earlier posts are used first, and every other
// guess is checked on LinkedIn, so only a page that exists is suggested.

import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { ContentError, type ContentPost } from '@/lib/contentStudio'
import { findCompany, mentionsOf, type Mention } from '@/lib/linkedin'

export interface Suggested { found: Mention[]; missing: string[] }

// Everything on the post that a reader sees: the caption and the words on
// the image or on each slide.
function wordsOf(post: ContentPost): string {
  const slides = ((post.source as { slides?: Record<string, unknown>[] })?.slides ?? [])
    .flatMap((s) => Object.entries(s).filter(([k, v]) => typeof v === 'string' && !['kind', 'link', 'source', 'photo', 'image', 'logo'].includes(k)).map(([, v]) => v as string))
  return [post.kicker, post.headline, post.subline, ...slides, post.caption].filter(Boolean).join('\n')
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['companies'],
  properties: {
    companies: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'pages'],
        properties: {
          name: { type: 'string' },
          pages: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const

async function companiesIn(text: string): Promise<{ name: string; pages: string[] }[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new ContentError('ANTHROPIC_API_KEY is not set on the CRM, so the post cannot be read for companies.', 400)
  const client = new Anthropic({ apiKey })
  const res = await client.beta.messages.create({
    model: process.env.CONTENT_MODEL?.trim() || 'claude-opus-5-5',
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system:
      'You find the organisations a LinkedIn post names, so the team can tag their company pages. List each company, health system, regulator, university or other organisation the post names, once, written exactly as the post writes it. Leave out people, products, places, the post\'s own brand (World Health AI, World Pharma AI, World Nexus Group) and anything only hinted at. For each, give up to three guesses at its LinkedIn company page short name, the part after linkedin.com/company/ (for example gsk, novartis, nhs-england, johnson-&-johnson), most likely first.',
    messages: [{ role: 'user', content: text }],
  })
  if (res.stop_reason === 'refusal') return []
  const out = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
  try {
    return ((JSON.parse(out) as { companies?: { name: string; pages: string[] }[] }).companies ?? []).filter((c) => c.name?.trim())
  } catch {
    throw new ContentError('Claude did not answer in the expected shape. Try again.', 502)
  }
}

const plain = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/\b(plc|ltd|limited|inc|llc|group|the)\b/g, '').replace(/[^a-z0-9]+/g, '')

// A page LinkedIn found for a guess is taken only when its name matches the
// one in the post, so a near-miss short name never tags the wrong company.
const alike = (a: string, b: string) => {
  const x = plain(a), y = plain(b)
  return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x))))
}

// The pages tagged on earlier posts, by name.
async function knownPages(): Promise<Mention[]> {
  const { data } = await supabase.from('marketing_content').select('source').not('source->mentions', 'is', null).order('updatedAt', { ascending: false }).limit(300)
  const seen = new Map<string, Mention>()
  for (const row of data ?? []) for (const m of mentionsOf(row.source)) if (!seen.has(m.urn)) seen.set(m.urn, m)
  return [...seen.values()]
}

export async function suggestTags(post: ContentPost): Promise<Suggested> {
  const tagged = mentionsOf(post.source)
  const [named, known] = await Promise.all([companiesIn(wordsOf(post)), knownPages()])
  const found: Mention[] = []
  const missing: string[] = []
  for (const c of named.slice(0, 12)) {
    if (tagged.some((t) => alike(t.name, c.name)) || found.some((f) => alike(f.name, c.name))) continue
    let page = known.find((k) => alike(k.name, c.name))
    const guesses = [...new Set([...c.pages, c.name.toLowerCase().replace(/\s+/g, '-'), plain(c.name)].map((g) => g.trim().replace(/^.*linkedin\.com\/company\//i, '').replace(/\/+$/, '')).filter(Boolean))]
    for (const g of guesses) {
      if (page) break
      const hit = await findCompany(g).catch(() => null)
      if (hit && alike(hit.name, c.name)) page = hit
    }
    if (page && !tagged.some((t) => t.urn === page.urn) && !found.some((f) => f.urn === page.urn)) found.push(page)
    else if (!page) missing.push(c.name)
  }
  return { found, missing }
}
