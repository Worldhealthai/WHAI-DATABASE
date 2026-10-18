// The Content tab's drafts: one LinkedIn post at a time, in the brand's
// voice, from what the group already holds. Server side only.
//
// Two tracks share the tab:
//   · An event's edition (World Health AI London 2027, …): the kinds are
//     insight, session, speaker, sponsor, countdown and theme, drawn from
//     the Insights desk, the digital agenda, the line-up and the date.
//   · World Nexus Group itself, the parent, whose page is about the
//     intelligence platform: the kinds are insight (every briefing),
//     platform (what it tracks, in its own figures), signal (the kinds of
//     market movement it watches) and event (the next summit).
// A kind that is not asked for is chosen in turn, skipping the kinds and
// the articles or people the last posts used, so a run of days does not
// repeat itself.
//
// Claude writes the words (the card's kicker, headline and subline, the
// caption and the hashtags) against a voice guide drawn from the sites;
// the card is drawn here (lib/contentCard.tsx) in one of three styles (an
// event photo, the night, ink on white), the next one each time, so it is
// always in the brand's own look and a run of posts does not look the same.

import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { NEXUS_URL, fetchLineup, absoluteUrl, type Edition, type LineupSpeaker, type LineupSponsor } from '@/lib/marketingSource'
import { normaliseAgenda, type Agenda, type Session } from '@/lib/agenda/model'
import { eventLook } from '@/lib/portals'
import { BRANDS, brandFor, nextStyle, photosFor, type BrandKey, type CardStyle } from '@/lib/contentBrand'
import type { Slide } from '@/lib/contentCarousel'
import { describeOverruns, fitText, overruns, type Limit } from '@/lib/contentText'

export type ContentKind = 'insight' | 'speaker' | 'session' | 'sponsor' | 'countdown' | 'theme' | 'platform' | 'signal' | 'event'
export const EVENT_KINDS: ContentKind[] = ['insight', 'session', 'speaker', 'theme', 'countdown', 'sponsor']
export const NEXUS_KINDS: ContentKind[] = ['insight', 'platform', 'signal', 'event']

// The group's own page: the edition the tab files its posts under.
export const NEXUS_EDITION: Edition = { series: 'World Nexus Group', city: '', year: '', label: 'World Nexus Group' }
export const isNexus = (ed: Edition) => brandFor(ed.series) === 'nexus'

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

// ── What the group holds ────────────────────────────────────────────────────

interface PublicEvent { slug: string; series: string; label: string; city: string | null; country: string | null; date: string | null; status: string }
export interface PublicInsight { site?: string | null; slug: string; title: string; dek: string | null; category: string | null; published_at: string | null; cover_image?: string | null }
interface PublicArticle { body?: string | null; references_json?: unknown }

// The briefing's own text, so a post can carry a real finding or figure
// from it rather than restating the title: the first part of the body,
// without its markdown furniture.
async function readArticle(slug: string): Promise<string> {
  const a = await readJson<PublicArticle | null>(`${NEXUS_URL}/api/public/insights/${encodeURIComponent(slug)}`, null)
  const body = String(a?.body ?? '')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*?/g, '')
    .replace(/\[(\d+)\]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
  return body.slice(0, 2200)
}

// A post about a briefing takes a different angle each time it comes round.
const INSIGHT_ANGLES = [
  'the single most important finding or decision in the piece, with its figure or date',
  'what it changes for the people who buy, build or run AI in this field, in one plain consequence',
  'the question the piece leaves open, as something the summit will debate',
  'the number: one figure from the piece and what it measures',
  'the regulator, journal or company at the centre of it, and what they did',
]

interface GalleryPhoto { image_url: string; title: string | null }

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

// What the group's own site says about the intelligence platform
// (worldnexusgroup.com/intelligence). Figures as published there; the
// writer may use these and nothing else.
const PLATFORM = {
  name: 'The Nexus intelligence platform',
  what: 'A live intelligence system for the AI economy in healthcare and pharma: every AI-first vendor, the capital behind them, the operators running them, and the health systems deploying them, reconciled against the public record and refreshed continuously.',
  stats: [
    { n: '290+', label: 'AI vendors tracked' },
    { n: '1,280+', label: 'named operators' },
    { n: '2,900+', label: 'live market signals' },
    { n: '45+', label: 'deployments mapped' },
    { n: '15', label: 'coverage categories' },
  ],
  signals: [
    { kind: 'Funding', watches: 'rounds closed by AI-first vendors in healthcare and pharma, and the investors behind them' },
    { kind: 'Deployment', watches: 'AI going live inside health systems and pharma companies, and at what scale' },
    { kind: 'Hiring', watches: 'clinical and technical AI teams growing or shrinking at vendors and operators' },
    { kind: 'M&A', watches: 'vendors acquired, merged or folded into larger platforms' },
    { kind: 'Partnership', watches: 'vendors and health systems or pharma companies announcing work together' },
  ],
  link: 'https://www.worldnexusgroup.com/intelligence',
}

export interface EditionContext {
  ed: Edition
  brand: BrandKey
  site: string
  event: PublicEvent | null
  upcoming: PublicEvent[]
  daysToGo: number | null
  insights: PublicInsight[]
  speakers: LineupSpeaker[]
  sponsors: LineupSponsor[]
  sessions: Session[]
  photos: string[]
  recent: Pick<ContentPost, 'kind' | 'ref' | 'headline' | 'caption' | 'source'>[]
}

const parseDay = (date: string | null | undefined) => {
  const t = date ? Date.parse(date.replace(/^[A-Za-z]+,?\s+/, '')) : NaN
  return Number.isFinite(t) ? t : null
}

export async function gatherContext(ed: Edition): Promise<EditionContext> {
  const brand = brandFor(ed.series)
  const nexus = brand === 'nexus'
  const [events, insightsRes, lineup, agenda, gallery, recentRes] = await Promise.all([
    readJson<{ events: PublicEvent[] }>(`${NEXUS_URL}/api/public-events`, { events: [] }),
    readJson<{ articles?: PublicInsight[] }>(`${NEXUS_URL}/api/public/insights?series=${encodeURIComponent(ed.series)}`, { articles: [] }),
    nexus ? Promise.resolve({ event: null, speakers: [] as LineupSpeaker[], sponsors: [] as LineupSponsor[] }) : fetchLineup(ed).catch(() => ({ event: null, speakers: [] as LineupSpeaker[], sponsors: [] as LineupSponsor[] })),
    nexus ? Promise.resolve(null) : readAgenda(ed.label),
    readJson<{ photos: GalleryPhoto[] }>(`${NEXUS_URL}/api/public/gallery?site=${brand === 'nexus' ? 'all' : brand}`, { photos: [] }),
    supabase.from('marketing_content').select('kind, ref, headline, caption, source').eq('edition', ed.label).order('createdAt', { ascending: false }).limit(40),
  ])
  const now = Date.now()
  const upcoming = events.events
    .filter((e) => e.status !== 'draft' && e.status !== 'past' && (parseDay(e.date) ?? Infinity) > now)
    .sort((a, b) => (parseDay(a.date) ?? Infinity) - (parseDay(b.date) ?? Infinity))
  const event = nexus
    ? null
    : events.events.find((e) => e.series === ed.series && (e.city || '') === ed.city && e.label.endsWith(ed.year)) ??
      events.events.find((e) => e.series === ed.series && e.label.endsWith(ed.year)) ??
      null
  const when = parseDay(event?.date)
  return {
    ed,
    brand,
    site: BRANDS[brand].url,
    event,
    upcoming,
    daysToGo: when ? Math.ceil((when - now) / 86400000) : null,
    insights: (insightsRes.articles ?? []).slice(0, 20),
    speakers: lineup.speakers,
    sponsors: lineup.sponsors,
    sessions: agenda?.sessions.filter((s) => s.type !== 'break' && s.title) ?? [],
    photos: gallery.photos.map((p) => p.image_url).filter(Boolean),
    recent: ((recentRes.data ?? []) as Pick<ContentPost, 'kind' | 'ref' | 'headline' | 'caption' | 'source'>[]),
  }
}

// ── Choosing what today's post is about ─────────────────────────────────────

export interface Choice { kind: ContentKind; ref: string | null; source: Record<string, unknown>; link: string }

// Photos for the card, different from the last few posts' where they can
// be: `n` of them, distinct, chosen by the seed so a post keeps its own.
export function pickPhotos(ctx: EditionContext, seed: string, n: number): string[] {
  if (!ctx.photos.length || n <= 0) return []
  const used = new Set(ctx.recent.slice(0, 6).flatMap((r) => {
    const src = r.source as { photo?: string; photos?: string[] } | undefined
    return [...(Array.isArray(src?.photos) ? src!.photos! : []), ...(src?.photo ? [src.photo] : [])]
  }))
  const fresh = ctx.photos.filter((p) => !used.has(p))
  const pool = fresh.length >= n ? fresh : ctx.photos
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const out: string[] = []
  for (let i = 0; i < pool.length && out.length < n; i++) out.push(pool[(h + i * 7) % pool.length])
  return [...new Set(out)]
}

// A look asked for by name that takes more photos than the gallery has.
function needsPhotos(style: CardStyle | 'rotate' | null | undefined, photoCount: number, kind?: string) {
  if (!style || style === 'rotate') return
  if (kind === 'speaker' && style === 'mosaic') throw new ContentError('A speaker\'s card shows their own photo and no other, so the mosaic look is not one of theirs. Choose another look.')
  if (photosFor(style) <= photoCount) return
  throw new ContentError(`The ${style} look needs ${photosFor(style)} event photo${photosFor(style) === 1 ? '' : 's'} and the gallery on worldnexusgroup.com has ${photoCount}. Choose another look, or add photos to the gallery first.`)
}

// What a card with this style carries: its photo, or the mosaic's three.
export function photoFields(ctx: EditionContext, seed: string, style: CardStyle): { photo?: string; photos?: string[] } {
  const photos = pickPhotos(ctx, seed, photosFor(style))
  return photos.length ? { photo: photos[0], photos } : {}
}

export function pools(ctx: EditionContext): Partial<Record<ContentKind, Choice[]>> {
  const used = new Set(ctx.recent.map((r) => `${r.kind}:${r.ref}`))
  const fresh = (kind: ContentKind, items: Choice[]) => {
    const unused = items.filter((i) => !used.has(`${kind}:${i.ref}`))
    return unused.length ? unused : items
  }
  const site = ctx.site
  const confirmedIn = (s: Session) => s.speakers.filter((x) => x.status === 'confirmed' && x.name.trim() && !x.backup)
  // A briefing's card. The pharma and health pages lead with their own
  // field: a piece on a deal or a funding round (category "Markets") comes
  // after the others, as those belong to the group's page first.
  const insightChoice = (i: PublicInsight): Choice => ({ kind: 'insight', ref: i.slug, source: { title: i.title, dek: i.dek, category: i.category, published_at: i.published_at }, link: `${site}/insights/${i.slug}` })
  const isMarkets = (i: PublicInsight) => (i.category || '').toLowerCase() === 'markets'
  const insights = ctx.brand === 'nexus' ? ctx.insights : [...ctx.insights.filter((i) => !isMarkets(i)), ...ctx.insights.filter(isMarkets)]

  if (ctx.brand === 'nexus') {
    return {
      insight: fresh('insight', insights.map(insightChoice)),
      platform: fresh('platform', [
        { kind: 'platform', ref: 'what', source: { platform: PLATFORM.name, what: PLATFORM.what, stats: PLATFORM.stats }, link: PLATFORM.link },
        ...PLATFORM.stats.map((s) => ({ kind: 'platform' as const, ref: `stat:${s.label}`, source: { platform: PLATFORM.name, what: PLATFORM.what, figure: s.n, label: s.label }, link: PLATFORM.link })),
      ]),
      signal: fresh('signal', PLATFORM.signals.map((s) => ({ kind: 'signal', ref: s.kind, source: { platform: PLATFORM.name, what: PLATFORM.what, signal: s.kind, watches: s.watches, note: 'Write about this kind of signal and why it matters to decision-makers. Do not invent any specific company, deal, figure or date.' }, link: PLATFORM.link }))),
      event: fresh('event', ctx.upcoming.map((e) => {
        const days = parseDay(e.date)
        const look = eventLook(`${e.series} ${e.city ?? ''}`.trim())
        return { kind: 'event' as const, ref: e.slug, source: { series: e.series, city: e.city, date: e.date, daysToGo: days ? Math.ceil((days - Date.now()) / 86400000) : null, site: look.key === 'pharma' ? BRANDS.pharma.url : BRANDS.health.url }, link: look.key === 'pharma' ? `${BRANDS.pharma.url}/book` : `${BRANDS.health.url}/book` }
      })),
    }
  }

  return {
    insight: fresh('insight', insights.map(insightChoice)),
    session: fresh('session', ctx.sessions.map((s) => ({ kind: 'session' as const, ref: s.id, source: { title: s.title, type: s.type, talkTitle: s.talkTitle, points: s.points, speakers: confirmedIn(s).map((x) => ({ name: x.name, role: x.role, org: x.org, moderator: x.moderator })) }, link: `${site}/events` }))),
    speaker: fresh('speaker', ctx.speakers.filter((s) => s.linkedin_consent === true && s.name).map((s) => {
      const image = absoluteUrl(s.image)
      return { kind: 'speaker' as const, ref: s.id, source: { name: s.name, role: s.role, org: s.org, bio: (s.bio || '').slice(0, 600), image }, link: `${site}/speakers` }
    })),
    theme: fresh('theme', ctx.sessions.flatMap((s) => s.points.map((p, i) => ({ kind: 'theme' as const, ref: `${s.id}:${i}`, source: { question: p, session: s.title }, link: `${site}/events` })))),
    countdown: ctx.daysToGo != null && ctx.daysToGo > 0 ? [{ kind: 'countdown', ref: String(ctx.daysToGo), source: { daysToGo: ctx.daysToGo, figure: String(ctx.daysToGo), label: ctx.daysToGo === 1 ? 'day to go' : 'days to go' }, link: `${site}/book` }] : [],
    sponsor: fresh('sponsor', ctx.sponsors.filter((s) => s.name).map((s) => {
      const logo = absoluteUrl(s.logo)
      return { kind: 'sponsor' as const, ref: s.id, source: { name: s.name, tier: s.tier, category: s.category, website: s.website, logo }, link: `${site}/partners` }
    })),
  }
}

function choose(ctx: EditionContext, wanted: ContentKind | null): Choice {
  const all = pools(ctx)
  const rotation = ctx.brand === 'nexus' ? NEXUS_KINDS : EVENT_KINDS
  // Among what has not been used lately, the newest few are all fair
  // game, so two runs in a row do not land on the same item.
  // A briefing on a deal or a funding round (category "Markets") is taken
  // only when the page has nothing else left to post about.
  const vary = (pool: Choice[]): Choice => {
    const own = ctx.brand === 'nexus' ? pool : pool.filter((c) => String(c.source.category || '').toLowerCase() !== 'markets' || c.kind !== 'insight')
    const from = own.length ? own : pool
    return from[Math.floor(Math.random() * Math.min(from.length, 3))]
  }
  if (wanted) {
    const pool = all[wanted] ?? []
    if (!pool.length) throw new ContentError(emptyPoolMessage(wanted, ctx))
    return vary(pool)
  }
  const lastKinds = ctx.recent.slice(0, 2).map((r) => r.kind)
  const order = [...rotation.filter((k) => !lastKinds.includes(k)), ...rotation.filter((k) => lastKinds.includes(k))]
  for (const k of order) if (all[k]?.length) return vary(all[k]!)
  throw new ContentError('There is nothing to write from yet: no published Insights, no agenda, no speakers who agreed to a post, and no event date. Add some of those first.')
}

export function emptyPoolMessage(kind: ContentKind, ctx: EditionContext): string {
  switch (kind) {
    case 'insight': return `No published Insights for ${ctx.ed.series} yet. Publish one on worldnexusgroup.com first.`
    case 'session': return `No sessions in the ${ctx.ed.label} agenda yet. Build it in the Production portal first.`
    case 'speaker': return 'No confirmed speaker on the line-up has agreed to a LinkedIn post yet.'
    case 'theme': return 'The agenda has no discussion points yet to draw a theme from.'
    case 'countdown': return ctx.daysToGo != null && ctx.daysToGo <= 0 ? 'The event date has passed, so there is no countdown.' : 'The event has no date on worldnexusgroup.com yet.'
    case 'sponsor': return 'No sponsors on the line-up yet.'
    case 'event': return 'No upcoming event with a date on worldnexusgroup.com yet.'
    case 'platform':
    case 'signal': return 'Nothing to draw on for that kind.'
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
export const VOICE = `You write LinkedIn posts for World Nexus Group and its executive AI summits: World Health AI (clinical leaders, the NHS, health systems and health-tech) and World Pharma AI (AI across pharma R&D, manufacturing and commercial). World Nexus Group is the parent: its own page is about its intelligence platform, a live map of the AI economy in healthcare and pharma (the vendors, the capital behind them, the operators, the deployments, and the market signals: funding, deployments, hiring, M&A, partnerships). Each post goes out from the page named in the brief.

Voice:
- Short, plain British English. Say what it is. Specific beats grand.
- No hype words (unlock, elevate, seamless, revolutionise, cutting-edge, game-changing, excited, thrilled, delighted). No exclamation marks. No rhetorical questions. No emoji. No em-dashes anywhere: use commas, colons or full stops.
- Sentence case throughout. Never shout in capitals.
- Never invent figures, quotations, names, titles, companies, deals or claims. Use only what the brief supplies. If a detail is not supplied, leave it out.
- Speak as the page, in the first person plural where natural ("we", "our London summit", "our platform"), never as an individual.

The card (the image) carries: a kicker (2 to 4 words, e.g. "Panel discussion", "On the line-up", "42 days to go", "From our Insights desk", "Inside the platform"), a headline (at most 70 characters, one idea, no full stop) and a subline (at most 90 characters: the supporting fact, a name and role, a question, or the date and city). When the brief gives a figure for a number card, the headline is the label of that figure, not the figure itself. The headline is never the briefing's title restated: it is the finding, the figure, the consequence or the question, as the brief's angle asks.

The caption (the post text): 70 to 140 words. The first line must stand on its own, because LinkedIn folds the rest. Short paragraphs, one blank line between them. End with one line that points to the link, as a plain verb phrase ("Book your pass:", "Read the briefing:", "See who's speaking:", "See the platform:") followed by the URL given. Then the hashtags on their own final line: 3 to 5, CamelCase, no spaces, always including the page's own tag (#WorldHealthAI, #WorldPharmaAI or #WorldNexusGroup) and, for an event, the city.

Every word is checked before it goes out. Keep each field within its limit (count the characters) as a complete phrase: nothing is ever cut to fit, so a field that runs over comes back to be rewritten. Spell every word in full and correctly, and copy every figure, name and title exactly.`

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

function brief(ctx: EditionContext, pick: Choice, extra: string | null, angle: string | null): string {
  const ev = ctx.event
  const page = ctx.brand === 'nexus' ? 'World Nexus Group (the group page, about the intelligence platform)' : `${ctx.ed.series}, ${ctx.ed.city || ev?.city || ''} ${ctx.ed.year}`.trim()
  const { photo: _photo, image: _image, logo: _logo, ...material } = pick.source as Record<string, unknown>
  const lines = [
    `Page the post goes out from: ${page}`,
    ctx.brand !== 'nexus' ? (ev?.date ? `Date: ${ev.date}` : 'Date: not announced yet (do not mention a date)') : '',
    ctx.daysToGo != null && ctx.daysToGo > 0 ? `Days to go: ${ctx.daysToGo}` : '',
    `Website: ${ctx.site}`,
    `Link to end the caption with: ${pick.link}`,
    `Post type: ${pick.kind}`,
    `The card: ${pick.kind === 'countdown' || (pick.kind === 'platform' && pick.source.figure) ? 'the figure is shown large, so the headline is its label' : pick.kind === 'speaker' ? 'the headshot, name, role and organisation are shown, so the headline need not repeat them' : pick.kind === 'session' ? 'the speakers on the session are listed on the card, so the headline is about the session itself' : 'the kicker, headline and subline over the brand look'}`,
    `Material (use only this): ${JSON.stringify(material)}`,
    angle ? `Angle for this post: ${angle}` : '',
    ctx.recent.length ? `Headlines of the last posts, not to repeat or echo: ${ctx.recent.slice(0, 12).map((r) => JSON.stringify(r.headline)).join(', ')}` : '',
    ctx.recent.length ? `Opening lines of the last posts, so this one opens differently: ${ctx.recent.slice(0, 6).map((r) => JSON.stringify(String(r.caption || '').split('\n')[0].slice(0, 120))).join(', ')}` : '',
    extra ? `The marketing team's own steer for this post: ${extra}` : '',
    'Return the post as JSON with kicker, headline, subline, caption and hashtags.',
  ]
  return lines.filter(Boolean).join('\n')
}

// The room each of the card's words has: a little over what the voice
// asks for. A draft that runs over is rewritten, never cut.
const cardLimits = (d: { kicker?: string; headline?: string; subline?: string }, at = ''): Limit[] => [
  { field: `${at}kicker`, text: tidy(d.kicker || ''), max: 40 },
  { field: `${at}headline`, text: tidy(d.headline || ''), max: 90 },
  { field: `${at}subline`, text: tidy(d.subline || ''), max: 120 },
]

interface Ask { system: string; schema: Record<string, unknown>; brief: string; maxTokens: number; refused: (category: string | null) => string }

// Claude's draft as JSON. When any of its words run over the room they
// have, it goes back once with the fields named, to be rewritten whole: a
// word or a figure is never cut to fit. Still over after that, nothing is
// saved.
async function draftWithin<T>(ask: Ask, limits: (d: T) => Limit[]): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new ContentError('ANTHROPIC_API_KEY is not set on the CRM, so nothing can be written.', 400)
  const client = new Anthropic({ apiKey })
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: ask.brief }]
  for (let round = 0; ; round++) {
    // Opus 5.5 with the server-side fallback: a benign life-sciences brief
    // can trip its safety classifiers, and the fallback re-runs it on the
    // model Anthropic recommends for that category.
    const res = await client.beta.messages.create({
      model: process.env.CONTENT_MODEL?.trim() || 'claude-opus-5-5',
      max_tokens: ask.maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ask.schema } },
      system: ask.system,
      messages,
    })
    if (res.stop_reason === 'refusal') throw new ContentError(ask.refused(res.stop_details?.category ?? null), 502)
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    if (!text) throw new ContentError(`Claude answered without any text (${res.stop_reason ?? 'unknown'}).`, 502)
    let d: T
    try {
      d = JSON.parse(text) as T
    } catch {
      throw new ContentError('Claude did not answer in the expected shape. Try again.', 502)
    }
    const over = overruns(limits(d))
    if (!over.length) return d
    if (round >= 1) throw new ContentError(`The draft's words ran over the space on the image twice, so it was not saved rather than cut short (${over.map((l) => l.field).join(', ')}). Try again.`, 502)
    messages.push(
      { role: 'assistant', content: text },
      {
        role: 'user',
        content: `These run over the space they have on the image:\n${describeOverruns(over)}\n\nRewrite each of them as a complete phrase within its limit (count the characters). Never cut a word short or drop the end of a figure, never abbreviate a figure the text gives in full, and keep every figure and quotation exact. Return the whole JSON again, with everything else unchanged.`,
      },
    )
  }
}

async function write(ctx: EditionContext, pick: Choice, extra: string | null, angle: string | null): Promise<Draft> {
  const draft = await draftWithin<Draft>(
    {
      system: VOICE,
      schema: SCHEMA,
      brief: brief(ctx, pick, extra, angle),
      maxTokens: 8000,
      refused: (category) => `Claude declined to write this one (${category ?? 'no category given'}). Try another post type or a different steer.`,
    },
    (d) => cardLimits(d),
  )
  return {
    kicker: tidy(draft.kicker),
    headline: tidy(draft.headline),
    subline: tidy(draft.subline),
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

export async function draftPost(ed: Edition, opts: { kind?: ContentKind | null; brief?: string | null; forDate?: string | null; style?: CardStyle | 'rotate' | null }): Promise<ContentPost> {
  const ctx = await gatherContext(ed)
  const pick = choose(ctx, opts.kind ?? null)
  // A briefing is written from its own text, from an angle that moves on
  // each time the same briefing comes round.
  let angle: string | null = null
  if (pick.kind === 'insight' && pick.ref) {
    const text = await readArticle(pick.ref)
    if (text) pick.source = { ...pick.source, text }
    const before = ctx.recent.filter((r) => r.kind === 'insight' && r.ref === pick.ref).length
    angle = INSIGHT_ANGLES[before % INSIGHT_ANGLES.length]
  }
  const draft = await write(ctx, pick, opts.brief?.trim() || null, angle)
  // The card's style: the one asked for, else the one the last posts did
  // not use. The photo style takes an event photo (a speaker's own headshot
  // will do), chosen now so the post keeps it.
  // A speaker's headshot stands in for one photo (the photo and frame styles).
  const photoCount = Math.max(ctx.photos.length, pick.kind === 'speaker' && pick.source.image ? 1 : 0)
  needsPhotos(opts.style, photoCount, pick.kind)
  const style = nextStyle(ctx.recent, opts.style ?? null, photoCount, pick.kind)
  const photos = photoFields(ctx, pick.ref ?? pick.kind, style)
  const { text: _text, ...sourceKept } = pick.source as Record<string, unknown>
  const row = {
    edition: ed.label,
    series: ed.series,
    kind: pick.kind,
    ref: pick.ref,
    forDate: opts.forDate || (await nextFreeDay(ed.label)),
    ...draft,
    link: pick.link,
    source: { ...sourceKept, style, ...photos, angle, city: ctx.ed.city, date: ctx.event?.date ?? null, site: ctx.site },
    brief: opts.brief?.trim() || null,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('marketing_content').insert(row).select('*').single()
  if (error) throw error
  return data as ContentPost
}

// The first day from today with no post planned for this edition.
export async function nextFreeDay(edition: string): Promise<string> {
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

// ── Carousels ───────────────────────────────────────────────────────────────
//
// A LinkedIn carousel from one Insights briefing: the news, one statistic,
// the data, a quote from someone in it, and a last slide pointing to the
// briefing (lib/contentCarousel draws them and binds the PDF). Written from
// the article's full text; every figure and the quote are then checked
// against that text, and a slide that fails is left out rather than posted.

export interface ArticleText { body: string; publishers: string[] }

export async function readArticleFull(slug: string): Promise<ArticleText> {
  const a = await readJson<(PublicArticle & { references_json?: { publisher?: string; label?: string }[] }) | null>(
    `${NEXUS_URL}/api/public/insights/${encodeURIComponent(slug)}`,
    null,
  )
  const body = String(a?.body ?? '')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*?/g, '')
    .replace(/\[(\d+)\]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
  const publishers = (Array.isArray(a?.references_json) ? a!.references_json! : [])
    .map((r) => String(r?.publisher || '').trim())
    .filter(Boolean)
  return { body: body.slice(0, 9000), publishers: [...new Set(publishers)] }
}

const CAROUSEL_VOICE = `${VOICE}

This time you are writing a LinkedIn carousel: a few portrait slides the reader swipes through, and the post's caption. The slides, in order:
- news: what happened, as a kicker (2 to 4 words, e.g. "From our Insights desk", "Policy", "Market data"), a headline (at most 80 characters, the development itself, never the briefing's title restated word for word) and a summary (at most 200 characters: who, what, when).
- statistic: the single most striking figure in the piece, as the figure itself exactly as the text gives it ("$311m", "29%", "1,451"), a label saying what it measures (at most 70 characters) and one line of context (at most 140 characters).
- data: two to four further figures from the piece under a short title (at most 60 characters), each a figure exactly as the text gives it and a label (at most 60 characters). Different figures from the statistic slide.
- quote: words a named person or organisation said, copied exactly, character for character, from a passage the text puts in quotation marks, with the speaker's name and role as the text gives them. Choose the most telling line, at most 220 characters; you may stop at the end of a sentence but never change a word. If the text quotes nobody, return empty strings.
- end: a closing headline (at most 70 characters) that gives the reader a reason to read the full briefing: a complete statement, specific to this piece, of what the briefing gives the people the post is written for (the same readers as the rest of the post, never another party such as the suppliers when the post speaks to buyers), and only what the briefing really holds. Not a vague fragment and not a label for the article, e.g. "The reporting gaps to check before you buy an LLM tool", not "What suppliers should expect evaluators to ask for".
Keep every field within its limit (count the characters) as a complete phrase: nothing is cut to fit. Every figure must appear in the text exactly, written in full as the text gives it. If the piece has too few figures for a slide, return empty strings (and an empty points list) for it. Never invent or round a figure, never paraphrase inside quotation marks.

The caption: 60 to 120 words, the first line standing on its own, ending with "Read the briefing:" and the link given, then 3 to 5 hashtags on their own line.`

const STR = { type: 'string' }
export const CAROUSEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['news', 'statistic', 'data', 'quote', 'end', 'caption', 'hashtags'],
  properties: {
    news: { type: 'object', additionalProperties: false, required: ['kicker', 'headline', 'summary'], properties: { kicker: STR, headline: STR, summary: STR } },
    statistic: { type: 'object', additionalProperties: false, required: ['figure', 'label', 'context'], properties: { figure: STR, label: STR, context: STR } },
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'points'],
      properties: { title: STR, points: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['figure', 'label'], properties: { figure: STR, label: STR } } } },
    },
    quote: { type: 'object', additionalProperties: false, required: ['text', 'speaker', 'role'], properties: { text: STR, speaker: STR, role: STR } },
    end: { type: 'object', additionalProperties: false, required: ['headline'], properties: { headline: STR } },
    caption: STR,
    hashtags: { type: 'array', items: STR },
  },
}

export interface CarouselDraft {
  news: { kicker: string; headline: string; summary: string }
  statistic: { figure: string; label: string; context: string }
  data: { title: string; points: { figure: string; label: string }[] }
  quote: { text: string; speaker: string; role: string }
  end: { headline: string }
  caption: string
  hashtags: string[]
}

// For comparing with the article: quotes and dashes made plain, spaces
// collapsed, case ignored.
export const plain = (s: string) =>
  s
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// A figure is in the text when each of its numbers is, as written there
// ("$311 million" and "$311m" both rest on "311").
export function figureInText(figure: string, text: string): boolean {
  const nums = figure.match(/\d[\d,.]*/g)
  if (!nums) return false
  const t = plain(text)
  return nums.every((n) => t.includes(n.replace(/[.,]$/, '')))
}

export const FIGURE_MAX = 24

// The room each of a carousel's words has: a little over what the voice
// asks for. Figures have room for the longest a text writes out in full
// ("EUR 680 million", "$1.2 billion"), and are never shortened.
export const carouselLimits = (d: Partial<CarouselDraft>): Limit[] => [
  { field: 'news.kicker', text: tidy(d.news?.kicker || ''), max: 40 },
  { field: 'news.headline', text: tidy(d.news?.headline || ''), max: 110 },
  { field: 'news.summary', text: tidy(d.news?.summary || ''), max: 240 },
  { field: 'statistic.figure', text: tidy(d.statistic?.figure || ''), max: FIGURE_MAX },
  { field: 'statistic.label', text: tidy(d.statistic?.label || ''), max: 90 },
  { field: 'statistic.context', text: tidy(d.statistic?.context || ''), max: 170 },
  { field: 'data.title', text: tidy(d.data?.title || ''), max: 80 },
  ...(d.data?.points || []).flatMap((p, i) => [
    { field: `data.points[${i}].figure`, text: tidy(p?.figure || ''), max: FIGURE_MAX },
    { field: `data.points[${i}].label`, text: tidy(p?.label || ''), max: 80 },
  ]),
  { field: 'quote.text', text: (d.quote?.text || '').trim(), max: 260 },
  { field: 'quote.speaker', text: (d.quote?.speaker || '').trim(), max: 80 },
  { field: 'quote.role', text: (d.quote?.role || '').trim(), max: 120 },
  { field: 'end.headline', text: tidy(d.end?.headline || ''), max: 90 },
]

// The carousel's slides, held to the article: the news slide always; the
// statistic, the data and the quote only when every figure, and the quote
// word for word, are in the article's text (else listed in `dropped`); and
// the closing slide.
export function checkSlides(
  d: CarouselDraft,
  article: ArticleText,
  o: { title: string; publishedAt: string | null; fallbackDate: string | null; link: string },
): { news: Slide; extras: Slide[]; end: Slide; dropped: string[] } {
  const body = article.body
  const source = article.publishers.slice(0, 2).join(', ') || null
  const dropped: string[] = []
  const extras: Slide[] = []
  const news: Slide = {
    kind: 'news',
    kicker: fitText(tidy(d.news?.kicker || ''), 40) || 'From our Insights desk',
    headline: fitText(tidy(d.news?.headline || ''), 110) || o.title,
    summary: fitText(tidy(d.news?.summary || ''), 240),
    date: o.publishedAt ? new Date(o.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : o.fallbackDate,
  }
  // A figure is shown whole or not at all: one too long for its slide is
  // left out, never shortened.
  const statFigure = tidy(d.statistic?.figure || '')
  if (statFigure.length > FIGURE_MAX) dropped.push(`statistic "${statFigure}" is too long to show`)
  else if (statFigure && figureInText(statFigure, body)) {
    extras.push({ kind: 'statistic', figure: statFigure, label: fitText(tidy(d.statistic.label || ''), 90), context: fitText(tidy(d.statistic.context || ''), 170), source })
  } else if (statFigure) dropped.push(`statistic "${statFigure}" is not in the briefing`)
  const points = (d.data?.points || [])
    .map((p) => ({ figure: tidy(p.figure || ''), label: fitText(tidy(p.label || ''), 80) }))
    .filter((p) => p.figure && p.label && p.figure !== statFigure && p.figure.length <= FIGURE_MAX)
  const kept = points.filter((p) => figureInText(p.figure, body)).slice(0, 4)
  if (points.length > kept.length) dropped.push(`${points.length - kept.length} data point(s) not in the briefing`)
  if (kept.length >= 2) extras.push({ kind: 'data', title: fitText(tidy(d.data.title || ''), 80) || 'The data', points: kept, source })
  else if (kept.length) dropped.push('only one data point checked out, too few for a data slide')
  const quote = (d.quote?.text || '').trim().replace(/^["“]+|["”]+$/g, '')
  const speaker = (d.quote?.speaker || '').trim()
  // A quotation is never shortened: one too long for the slide is left out.
  if (quote.length > 260) dropped.push('the quote is too long for its slide')
  else if (quote && speaker && plain(body).includes(plain(quote))) {
    extras.push({ kind: 'quote', text: quote, speaker: fitText(speaker, 80), role: fitText((d.quote.role || '').trim(), 120), source })
  } else if (quote) dropped.push('the quote is not word for word in the briefing')
  const end: Slide = { kind: 'end', headline: fitText(tidy(d.end?.headline || ''), 90) || 'Read the full briefing', link: o.link }
  return { news, extras, end, dropped }
}

export async function draftCarousel(ed: Edition, opts: { brief?: string | null; forDate?: string | null; ref?: string | null; style?: CardStyle | 'rotate' | null }): Promise<ContentPost> {
  const ctx = await gatherContext(ed)
  const pool = pools(ctx).insight ?? []
  if (!pool.length) throw new ContentError(emptyPoolMessage('insight', ctx))
  // The briefing asked for, else one of the newest not turned into a
  // carousel lately.
  const usedForCarousel = new Set(ctx.recent.filter((r) => (r.source as { format?: string } | undefined)?.format === 'carousel').map((r) => r.ref))
  const fresh = pool.filter((c) => !usedForCarousel.has(c.ref))
  // As for a single post: the page's own field before a piece on a deal.
  const candidates = fresh.length ? fresh : pool
  const own = ctx.brand === 'nexus' ? candidates : candidates.filter((c) => String(c.source.category || '').toLowerCase() !== 'markets')
  const from = own.length ? own : candidates
  const pick = (opts.ref && pool.find((c) => c.ref === opts.ref)) || from[Math.floor(Math.random() * Math.min(from.length, 3))]
  const article = await readArticleFull(pick.ref!)
  if (article.body.length < 200) throw new ContentError('The briefing could not be read from worldnexusgroup.com just now, so there is nothing to build slides from. Try again in a minute.', 502)

  const src = pick.source as { title?: string; dek?: string; category?: string; published_at?: string }
  const briefText = [
    `Page the post goes out from: ${ctx.brand === 'nexus' ? 'World Nexus Group' : `${ctx.ed.series}, ${ctx.ed.city || ctx.event?.city || ''} ${ctx.ed.year}`.trim()}`,
    `Link to end the caption with: ${pick.link}`,
    `The briefing's title: ${src.title ?? ''}`,
    src.dek ? `Its standfirst: ${src.dek}` : '',
    src.category ? `Its category: ${src.category}` : '',
    `The briefing's full text (the only material; every figure and quote must come from it):\n"""\n${article.body}\n"""`,
    opts.brief?.trim() ? `The marketing team's own steer: ${opts.brief.trim()}` : '',
    'Return the carousel as JSON.',
  ].filter(Boolean).join('\n\n')
  const d = await draftWithin<CarouselDraft>(
    { system: CAROUSEL_VOICE, schema: CAROUSEL_SCHEMA, brief: briefText, maxTokens: 12000, refused: () => 'Claude declined to write this one. Try again, or pick another briefing.' },
    carouselLimits,
  )

  // Held to the article: a figure or a quote not in it drops its slide.
  const date = ctx.event?.date ?? null
  const { news, extras, end, dropped } = checkSlides(d, article, { title: src.title ?? '', publishedAt: src.published_at ?? null, fallbackDate: date, link: pick.link })
  const slides: Slide[] = [news, ...extras, end]
  // The slides' style, as for a single card; a photo goes behind the cover.
  needsPhotos(opts.style, ctx.photos.length)
  const style = nextStyle(ctx.recent, opts.style ?? null, ctx.photos.length)
  const photos = photoFields(ctx, pick.ref!, style)

  const row = {
    edition: ed.label,
    series: ed.series,
    kind: 'insight' as ContentKind,
    ref: pick.ref,
    forDate: opts.forDate || (await nextFreeDay(ed.label)),
    kicker: slides[0].kind === 'news' ? slides[0].kicker : '',
    headline: slides[0].kind === 'news' ? slides[0].headline : '',
    subline: slides[0].kind === 'news' ? fitText(slides[0].summary, 120) : '',
    caption: tidy(d.caption),
    hashtags: (d.hashtags || []).map((h) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')).filter((h) => h.length > 1).slice(0, 5),
    link: pick.link,
    source: { ...pick.source, format: 'carousel', style, ...photos, slides, dropped, publishers: article.publishers, city: ctx.ed.city, date, site: ctx.site },
    brief: opts.brief?.trim() || null,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('marketing_content').insert(row).select('*').single()
  if (error) throw error
  return data as ContentPost
}

// ── Revising a post ─────────────────────────────────────────────────────────
//
// The team's own instruction for a post that is already written ("end on
// what buyers should check", "add that registration opens on 3 March"):
// Claude rewrites the post as asked, from the same material, and the image
// is drawn again from the new words. Facts the instruction gives may be
// used as given; everything else is held to the material as when it was
// first written, and a carousel's figures and quote are checked again
// (against the briefing and the instruction), a slide that fails keeping
// its old words. The words before the last revision are kept, so it can be
// undone.

export interface Revision { post: ContentPost; notes: string[] }

type Snapshot = Pick<ContentPost, 'kicker' | 'headline' | 'subline' | 'caption' | 'hashtags'> & { slides?: Slide[] }
export type Revisable = ContentPost & { source: { slides?: Slide[]; format?: string; pages?: string; before?: Snapshot; steers?: { text: string; at: string }[] } & Record<string, unknown> }

const snapshot = (p: Revisable): Snapshot => ({
  kicker: p.kicker,
  headline: p.headline,
  subline: p.subline,
  caption: p.caption,
  hashtags: p.hashtags,
  ...(Array.isArray(p.source?.slides) ? { slides: p.source.slides } : {}),
})

const hashtagsOf = (tags: string[] | undefined) => (tags || []).map((h) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')).filter((h) => h.length > 1).slice(0, 5)

// A carousel's slides as the draft they came from, for Claude to revise;
// a section with no slide is left empty.
function draftOf(p: Revisable): CarouselDraft {
  const slides = p.source.slides ?? []
  const of = <K extends Slide['kind']>(k: K) => slides.find((s) => s.kind === k) as Extract<Slide, { kind: K }> | undefined
  const news = of('news'), stat = of('statistic'), data = of('data'), quote = of('quote'), end = of('end')
  return {
    news: { kicker: news?.kicker ?? '', headline: news?.headline ?? '', summary: news?.summary ?? '' },
    statistic: { figure: stat?.figure ?? '', label: stat?.label ?? '', context: stat?.context ?? '' },
    data: { title: data?.title ?? '', points: data?.points ?? [] },
    quote: { text: quote?.text ?? '', speaker: quote?.speaker ?? '', role: quote?.role ?? '' },
    end: { headline: end?.headline ?? '' },
    caption: p.caption,
    hashtags: p.hashtags.map((h) => h.replace(/^#+/, '')),
  }
}

export async function readPost(id: string): Promise<Revisable> {
  const { data, error } = await supabase.from('marketing_content').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new ContentError('No such post.', 404)
  return data as Revisable
}

// A revised carousel's slides: each slide takes its new words; one whose
// new figure or quote did not check out keeps its old words; one Claude
// left empty, as asked, goes; and a full carousel can gain a slide the
// instruction asked for. What changed beyond the words goes in notes.
export function mergeSlides(old: Slide[], checked: ReturnType<typeof checkSlides>, d: CarouselDraft, twoPage: boolean, notes: string[]): Slide[] {
  const fresh = new Map<string, Slide>([[checked.news.kind, checked.news], ...checked.extras.map((s) => [s.kind, s] as [string, Slide]), [checked.end.kind, checked.end]])
  const asked = (k: string) => (k === 'statistic' ? d.statistic?.figure : k === 'data' ? d.data?.points?.length : k === 'quote' ? d.quote?.text : true)
  const kept = old.flatMap((s) => {
    const next = fresh.get(s.kind)
    if (next) return [next]
    if (!asked(s.kind)) {
      notes.push(`the ${s.kind} slide was taken out`)
      return []
    }
    notes.push(`the ${s.kind} slide kept its old words: the new ones did not check out against the briefing`)
    return [s]
  })
  const added = twoPage ? [] : checked.extras.filter((s) => !old.some((o) => o.kind === s.kind))
  if (added.length) notes.push(`added ${added.map((s) => `a ${s.kind} slide`).join(' and ')}`)
  const order = ['news', 'statistic', 'data', 'quote', 'end']
  return [...kept, ...added].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
}

// A post's words (and slides) rewritten by an instruction, held to its
// material and checked as when it was written; with `to`, rewritten for
// another page, ending on that page's link.
export async function rewritePost(post: Revisable, steer: string, to?: { page: string; link: string | null; facts: Record<string, unknown> }): Promise<{ patch: Record<string, unknown>; notes: string[] }> {
  const page = to ? to.page : post.edition
  const link = to ? to.link : post.link
  const { photo: _p, photos: _ps, image: _i, logo: _l, style: _s, before: _b, steers: _st, linkedin: _li, slides: _sl, dropped: _d, by: _by, movedFrom: _m, ...held } = post.source
  // On another page, that page's own site, city and date.
  const material: Record<string, unknown> = { ...held, ...(to?.facts ?? {}) }
  const carousel = Array.isArray(post.source.slides) && post.source.slides.length > 0
  const ask = (current: unknown, more: string[]) =>
    [
      `Page the post goes out from: ${page}`,
      link ? `Link to end the caption with: ${link}` : '',
      `Post type: ${post.kind}`,
      ...more,
      `The post as it stands:\n${JSON.stringify(current, null, 2)}`,
      `The marketing team's instruction for this revision: ${steer}`,
      'Revise the post as the instruction asks. Facts the team gives in the instruction may be used as given; everything else must come from the material, as before. Change what the instruction asks for and anything that must change with it to read right; keep the rest word for word. Return the whole post as JSON.',
    ].filter(Boolean).join('\n\n')
  const notes: string[] = []
  let patch: Record<string, unknown>

  if (carousel) {
    if (!post.ref) throw new ContentError('This carousel has no briefing to check its figures against, so it cannot be revised.', 400)
    const article = await readArticleFull(post.ref)
    if (article.body.length < 200) throw new ContentError('The briefing could not be read from worldnexusgroup.com just now, so the revision could not be checked. Try again in a minute.', 502)
    const d = await draftWithin<CarouselDraft>(
      {
        system: CAROUSEL_VOICE,
        schema: CAROUSEL_SCHEMA,
        brief: ask(draftOf(post), [
          `The briefing's title: ${String(material.title ?? '')}`,
          `The briefing's full text (with the instruction, the only material; every figure and quote must come from them):\n"""\n${article.body}\n"""`,
          'A section left empty has no slide on the post: keep it empty unless the instruction asks for it.',
        ]),
        maxTokens: 12000,
        refused: () => 'Claude declined to make this change. Try putting it another way.',
      },
      carouselLimits,
    )
    // Held to the briefing and the instruction, as when it was written.
    const checked = checkSlides(d, { ...article, body: `${article.body}\n\n${steer}` }, {
      title: String(material.title ?? post.headline),
      publishedAt: (material.published_at as string | undefined) ?? null,
      fallbackDate: (material.date as string | undefined) ?? null,
      link: link ?? '',
    })
    const slides = mergeSlides(post.source.slides ?? [], checked, d, post.source.pages === 'two-page', notes)
    notes.push(...checked.dropped)
    const news = slides[0]?.kind === 'news' ? slides[0] : null
    patch = {
      ...(news ? { kicker: news.kicker, headline: news.headline, subline: fitText(news.summary, 120) } : {}),
      caption: tidy(d.caption) || post.caption,
      hashtags: hashtagsOf(d.hashtags).length ? hashtagsOf(d.hashtags) : post.hashtags,
      source: { ...post.source, slides },
    }
  } else {
    const text = post.kind === 'insight' && post.ref ? await readArticle(post.ref) : ''
    const d = await draftWithin<Draft>(
      {
        system: VOICE,
        schema: SCHEMA,
        brief: ask(
          { kicker: post.kicker, headline: post.headline, subline: post.subline, caption: post.caption, hashtags: post.hashtags },
          [`Material (with the instruction, use only this): ${JSON.stringify(text ? { ...material, text } : material)}`],
        ),
        maxTokens: 8000,
        refused: (category) => `Claude declined to make this change (${category ?? 'no category given'}). Try putting it another way.`,
      },
      (x) => cardLimits(x),
    )
    patch = { kicker: tidy(d.kicker), headline: tidy(d.headline), subline: tidy(d.subline), caption: tidy(d.caption) || post.caption, hashtags: hashtagsOf(d.hashtags).length ? hashtagsOf(d.hashtags) : post.hashtags }
  }

  return { patch, notes }
}

export async function revisePost(id: string, instruction: string): Promise<Revision> {
  const steer = instruction.trim()
  if (!steer) throw new ContentError('Say what to change in the post.', 400)
  const post = await readPost(id)
  const { patch, notes } = await rewritePost(post, steer)
  const source = (patch.source as Record<string, unknown> | undefined) ?? post.source
  const row = {
    ...patch,
    source: { ...source, before: snapshot(post), steers: [...(post.source.steers ?? []), { text: steer, at: new Date().toISOString() }].slice(-10) },
    updatedAt: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('marketing_content').update(row).eq('id', id).select('*').single()
  if (error) throw error
  return { post: data as ContentPost, notes }
}

// Back to the words before the last revision.
export async function undoRevision(id: string): Promise<ContentPost> {
  const post = await readPost(id)
  const before = post.source.before
  if (!before) throw new ContentError('There is no revision to undo.', 409)
  const { slides, ...words } = before
  const { before: _b, ...source } = post.source
  const row = { ...words, source: slides ? { ...source, slides } : source, updatedAt: new Date().toISOString() }
  const { data, error } = await supabase.from('marketing_content').update(row).eq('id', id).select('*').single()
  if (error) throw error
  return data as ContentPost
}
