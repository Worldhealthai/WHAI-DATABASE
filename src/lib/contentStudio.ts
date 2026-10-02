// The Content tab's drafts: one LinkedIn post at a time for an edition, in
// the brand's voice, from what the group already holds about it. Server
// side only.
//
// Where a post's idea comes from (its `kind`):
//   insight   — a published Insights briefing on worldnexusgroup.com
//   speaker   — a confirmed speaker on the line-up who agreed to a post
//   session   — a session in the digital agenda and its questions
//   sponsor   — a sponsor on the line-up
//   countdown — the days to go, and booking
//   theme     — a topic drawn from the agenda's questions
// A kind that is not asked for is chosen in turn, skipping the kinds and
// the people or articles the last posts used, so a run of days does not
// repeat itself.
//
// Claude writes the words (the card's kicker, headline and subline, the
// caption and the hashtags) against a voice guide drawn from the event
// sites; the card itself is drawn here (lib/contentCard.tsx), so it is
// always in the brand's own look.

import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { NEXUS_URL, fetchLineup, type Edition, type LineupSpeaker, type LineupSponsor } from '@/lib/marketingSource'
import { normaliseAgenda, type Agenda, type Session } from '@/lib/agenda/model'
import { eventLook } from '@/lib/portals'

export type ContentKind = 'insight' | 'speaker' | 'session' | 'sponsor' | 'countdown' | 'theme'
export const CONTENT_KINDS: { value: ContentKind; label: string; hint: string }[] = [
  { value: 'insight', label: 'Insight', hint: 'A published Insights briefing' },
  { value: 'session', label: 'Session', hint: 'A session on the agenda and its questions' },
  { value: 'speaker', label: 'Speaker', hint: 'A confirmed speaker who agreed to a post' },
  { value: 'theme', label: 'Theme', hint: 'A topic the agenda raises' },
  { value: 'countdown', label: 'Countdown', hint: 'Days to go, and booking' },
  { value: 'sponsor', label: 'Sponsor', hint: 'A sponsor on the line-up' },
]
const ROTATION: ContentKind[] = ['insight', 'session', 'speaker', 'theme', 'countdown', 'sponsor']

export interface ContentPost {
  id: string
  edition: string
  series: string
  kind: ContentKind
  ref: string | null
  forDate: string | null
  kicker: string
  headline: string
  subline: string
  caption: string
  hashtags: string[]
  link: string | null
  source: Record<string, unknown>
  brief: string | null
  status: 'draft' | 'posted'
  postUrl: string | null
  postedAt: string | null
  createdAt: string
  updatedAt: string
}

// The brand site each series posts for.
export function brandSite(series: string): string {
  return /pharma/i.test(series) ? 'https://worldpharma.ai' : 'https://worldhealth.ai'
}

// ── What the group holds about the edition ──────────────────────────────────

interface PublicEvent { slug: string; series: string; label: string; city: string | null; country: string | null; date: string | null; status: string }
interface PublicInsight { slug: string; title: string; dek: string | null; category: string | null; published_at: string | null }

async function readJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!r.ok) return fallback
    return (await r.json()) as T
  } catch {
    return fallback
  }
}

async function readAgenda(edition: string): Promise<Agenda | null> {
  const { data, error } = await supabase.from('agendas').select('data').eq('edition', edition).maybeSingle()
  if (error || !data) return null
  return normaliseAgenda(data.data as Agenda)
}

export interface EditionContext {
  ed: Edition
  look: ReturnType<typeof eventLook>
  site: string
  event: PublicEvent | null
  daysToGo: number | null
  insights: PublicInsight[]
  speakers: LineupSpeaker[]
  sponsors: LineupSponsor[]
  sessions: Session[]
  recent: Pick<ContentPost, 'kind' | 'ref' | 'headline'>[]
}

export async function gatherContext(ed: Edition): Promise<EditionContext> {
  const look = eventLook(`${ed.series} ${ed.city}`.trim())
  const [events, insightsRes, lineup, agenda, recentRes] = await Promise.all([
    readJson<{ events: PublicEvent[] }>(`${NEXUS_URL}/api/public-events`, { events: [] }),
    readJson<{ items?: PublicInsight[] } | PublicInsight[]>(`${NEXUS_URL}/api/public/insights?series=${encodeURIComponent(ed.series)}`, []),
    fetchLineup(ed).catch(() => ({ event: null, speakers: [], sponsors: [] })),
    readAgenda(ed.label),
    supabase.from('marketing_content').select('kind, ref, headline').eq('edition', ed.label).order('createdAt', { ascending: false }).limit(30),
  ])
  const event =
    events.events.find((e) => e.series === ed.series && (e.city || '') === ed.city && e.label.endsWith(ed.year)) ??
    events.events.find((e) => e.series === ed.series && e.label.endsWith(ed.year)) ??
    null
  const insights = Array.isArray(insightsRes) ? insightsRes : (insightsRes.items ?? [])
  // Days to go, from the event's date line ("22 September 2027").
  let daysToGo: number | null = null
  const when = event?.date ? Date.parse(event.date.replace(/^[A-Za-z]+,?\s+/, '')) : NaN
  if (Number.isFinite(when)) daysToGo = Math.ceil((when - Date.now()) / 86400000)
  return {
    ed,
    look,
    site: brandSite(ed.series),
    event,
    daysToGo,
    insights: insights.slice(0, 20),
    speakers: lineup.speakers,
    sponsors: lineup.sponsors,
    sessions: agenda?.sessions.filter((s) => s.type !== 'break' && s.title) ?? [],
    recent: ((recentRes.data ?? []) as Pick<ContentPost, 'kind' | 'ref' | 'headline'>[]),
  }
}

// ── Choosing what today's post is about ─────────────────────────────────────

interface Pick_ { kind: ContentKind; ref: string | null; source: Record<string, unknown>; link: string }

function pools(ctx: EditionContext): Record<ContentKind, Pick_[]> {
  const used = new Set(ctx.recent.map((r) => `${r.kind}:${r.ref}`))
  const fresh = (kind: ContentKind, items: Pick_[]) => {
    const unused = items.filter((i) => !used.has(`${kind}:${i.ref}`))
    return unused.length ? unused : items
  }
  const site = ctx.site
  const confirmedIn = (s: Session) => s.speakers.filter((x) => x.status === 'confirmed' && x.name.trim())
  return {
    insight: fresh('insight', ctx.insights.map((i) => ({ kind: 'insight', ref: i.slug, source: { title: i.title, dek: i.dek, category: i.category, published_at: i.published_at }, link: `${site}/insights/${i.slug}` }))),
    session: fresh('session', ctx.sessions.map((s) => ({ kind: 'session', ref: s.id, source: { title: s.title, type: s.type, talkTitle: s.talkTitle, points: s.points, speakers: confirmedIn(s).map((x) => ({ name: x.name, role: x.role, org: x.org, moderator: x.moderator })) }, link: `${site}/events` }))),
    speaker: fresh('speaker', ctx.speakers.filter((s) => s.linkedin_consent === true && s.name).map((s) => ({ kind: 'speaker', ref: s.id, source: { name: s.name, role: s.role, org: s.org, bio: (s.bio || '').slice(0, 600) }, link: `${site}/speakers` }))),
    theme: fresh('theme', ctx.sessions.flatMap((s) => s.points.map((p, i) => ({ kind: 'theme' as const, ref: `${s.id}:${i}`, source: { question: p, session: s.title }, link: `${site}/events` })))),
    countdown: ctx.daysToGo != null && ctx.daysToGo > 0 ? [{ kind: 'countdown', ref: String(ctx.daysToGo), source: { daysToGo: ctx.daysToGo }, link: `${site}/book` }] : [],
    sponsor: fresh('sponsor', ctx.sponsors.filter((s) => s.name).map((s) => ({ kind: 'sponsor', ref: s.id, source: { name: s.name, tier: s.tier, category: s.category, website: s.website }, link: `${site}/partners` }))),
  }
}

function choose(ctx: EditionContext, wanted: ContentKind | null): Pick_ {
  const all = pools(ctx)
  if (wanted) {
    const pool = all[wanted]
    if (!pool.length) throw new ContentError(emptyPoolMessage(wanted, ctx))
    return pool[0]
  }
  const lastKinds = ctx.recent.slice(0, 2).map((r) => r.kind)
  const order = [...ROTATION.filter((k) => !lastKinds.includes(k)), ...ROTATION.filter((k) => lastKinds.includes(k))]
  for (const k of order) if (all[k].length) return all[k][0]
  throw new ContentError('There is nothing to write from yet: no published Insights, no agenda, no speakers who agreed to a post, and no event date. Add some of those first.')
}

function emptyPoolMessage(kind: ContentKind, ctx: EditionContext): string {
  switch (kind) {
    case 'insight': return `No published Insights for ${ctx.ed.series} yet. Publish one on worldnexusgroup.com first.`
    case 'session': return `No sessions in the ${ctx.ed.label} agenda yet. Build it in the Production portal first.`
    case 'speaker': return 'No confirmed speaker on the line-up has agreed to a LinkedIn post yet.'
    case 'theme': return 'The agenda has no discussion points yet to draw a theme from.'
    case 'countdown': return ctx.daysToGo != null && ctx.daysToGo <= 0 ? 'The event date has passed, so there is no countdown.' : 'The event has no date on worldnexusgroup.com yet.'
    case 'sponsor': return 'No sponsors on the line-up yet.'
  }
}

export class ContentError extends Error {
  status: number
  constructor(message: string, status = 409) {
    super(message)
    this.status = status
  }
}

// ── Writing it ──────────────────────────────────────────────────────────────

// The voice, as the event sites keep it (world-event-sites, anti-slop) and
// the Insights desk writes (Nexus, insights/generate).
const VOICE = `You write LinkedIn posts for World Nexus Group's executive AI summits: World Health AI (clinical leaders, the NHS, health systems and health-tech) and World Pharma AI (AI across pharma R&D, manufacturing and commercial). The posts go out from the event's own page.

Voice:
- Short, plain British English. Say what it is. Specific beats grand.
- No hype words (unlock, elevate, seamless, revolutionise, cutting-edge, game-changing, excited, thrilled, delighted). No exclamation marks. No rhetorical questions. No emoji. No em-dashes anywhere: use commas, colons or full stops.
- Sentence case throughout. Never shout in capitals.
- Never invent figures, quotations, names, titles or claims. Use only what the brief supplies. If a detail is not supplied, leave it out.
- Speak as the event, in the first person plural where natural ("we", "our London summit"), never as an individual.

The card (the image) carries: a kicker (2 to 4 words, e.g. "Panel discussion", "On the line-up", "42 days to go", "From our Insights desk"), a headline (at most 70 characters, one idea, no full stop), and a subline (at most 90 characters: the supporting fact, a name and role, a question, or the date and city).

The caption (the post text): 70 to 140 words. The first line must stand on its own, because LinkedIn folds the rest. Short paragraphs, one blank line between them. End with one line that points to the link, as a plain verb phrase ("Book your pass:", "Read the briefing:", "See who's speaking:") followed by the URL given. Then the hashtags on their own final line: 3 to 5, CamelCase, no spaces, always including the event's own tag (#WorldHealthAI or #WorldPharmaAI) and the city.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kicker', 'headline', 'subline', 'caption', 'hashtags'],
  properties: {
    kicker: { type: 'string' },
    headline: { type: 'string' },
    subline: { type: 'string' },
    caption: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
  },
}

interface Draft { kicker: string; headline: string; subline: string; caption: string; hashtags: string[] }

function brief(ctx: EditionContext, pick: Pick_, extra: string | null): string {
  const ev = ctx.event
  const lines = [
    `Event: ${ctx.ed.series}, ${ctx.ed.city || ev?.city || ''} ${ctx.ed.year}`.trim(),
    ev?.date ? `Date: ${ev.date}` : 'Date: not announced yet (do not mention a date)',
    ctx.daysToGo != null && ctx.daysToGo > 0 ? `Days to go: ${ctx.daysToGo}` : '',
    `Website: ${ctx.site}`,
    `Link to end the caption with: ${pick.link}`,
    `Post type: ${pick.kind}`,
    `Material (use only this): ${JSON.stringify(pick.source)}`,
    ctx.recent.length ? `Headlines of the last posts, not to repeat: ${ctx.recent.slice(0, 8).map((r) => JSON.stringify(r.headline)).join(', ')}` : '',
    extra ? `The marketing team's own steer for this post: ${extra}` : '',
    'Return the post as JSON with kicker, headline, subline, caption and hashtags.',
  ]
  return lines.filter(Boolean).join('\n')
}

async function write(ctx: EditionContext, pick: Pick_, extra: string | null): Promise<Draft> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new ContentError('ANTHROPIC_API_KEY is not set on the CRM, so nothing can be written.', 400)
  const client = new Anthropic({ apiKey })
  // Opus 5.5 with the server-side fallback: a benign life-sciences brief can
  // trip its safety classifiers, and the fallback re-runs it on the model
  // Anthropic recommends for that category.
  const res = await client.beta.messages.create({
    model: process.env.CONTENT_MODEL?.trim() || 'claude-opus-5-5',
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: VOICE,
    messages: [{ role: 'user', content: brief(ctx, pick, extra) }],
  })
  if (res.stop_reason === 'refusal') {
    throw new ContentError(`Claude declined to write this one (${res.stop_details?.category ?? 'no category given'}). Try another post type or a different steer.`, 502)
  }
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
  if (!text) throw new ContentError(`Claude answered without any text (${res.stop_reason ?? 'unknown'}).`, 502)
  let draft: Draft
  try {
    draft = JSON.parse(text) as Draft
  } catch {
    throw new ContentError('Claude did not answer in the expected shape. Try again.', 502)
  }
  return {
    kicker: tidy(draft.kicker).slice(0, 40),
    headline: tidy(draft.headline).slice(0, 90),
    subline: tidy(draft.subline).slice(0, 120),
    caption: tidy(draft.caption),
    hashtags: (draft.hashtags || []).map((h) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')).filter((h) => h.length > 1).slice(0, 5),
  }
}

// House style the model is asked for, held to anyway.
export function tidy(s: string): string {
  return String(s || '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/!/g, '.')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── The whole run ───────────────────────────────────────────────────────────

export async function draftPost(ed: Edition, opts: { kind?: ContentKind | null; brief?: string | null; forDate?: string | null }): Promise<ContentPost> {
  const ctx = await gatherContext(ed)
  const pick = choose(ctx, opts.kind ?? null)
  const draft = await write(ctx, pick, opts.brief?.trim() || null)
  const row = {
    edition: ed.label,
    series: ed.series,
    kind: pick.kind,
    ref: pick.ref,
    forDate: opts.forDate || (await nextFreeDay(ed.label)),
    ...draft,
    link: pick.link,
    source: { ...pick.source, city: ctx.ed.city, date: ctx.event?.date ?? null, site: ctx.site },
    brief: opts.brief?.trim() || null,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('marketing_content').insert(row).select('*').single()
  if (error) throw error
  return data as ContentPost
}

// The first day from today with no post planned for this edition.
async function nextFreeDay(edition: string): Promise<string> {
  const { data } = await supabase.from('marketing_content').select('forDate').eq('edition', edition).not('forDate', 'is', null)
  const taken = new Set((data ?? []).map((r: { forDate: string }) => r.forDate))
  const d = new Date()
  for (let i = 0; i < 365; i++) {
    const iso = d.toISOString().slice(0, 10)
    if (!taken.has(iso)) return iso
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return new Date().toISOString().slice(0, 10)
}
