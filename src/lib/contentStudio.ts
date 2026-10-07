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
// the card is drawn here (lib/contentCard.tsx) in one of several layouts,
// so it is always in the brand's own look.

import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { NEXUS_URL, fetchLineup, absoluteUrl, type Edition, type LineupSpeaker, type LineupSponsor } from '@/lib/marketingSource'
import { normaliseAgenda, type Agenda, type Session } from '@/lib/agenda/model'
import { eventLook } from '@/lib/portals'
import { BRANDS, brandFor, type BrandKey, type CardLayout } from '@/lib/contentBrand'
import type { Slide } from '@/lib/contentCarousel'

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

export interface Choice { kind: ContentKind; ref: string | null; source: Record<string, unknown>; link: string; layout: CardLayout }

// A photo for the card, different from the last few posts' where it can be.
function pickPhoto(ctx: EditionContext, seed: string): string | null {
  if (!ctx.photos.length) return null
  const used = new Set(ctx.recent.slice(0, 6).map((r) => String((r.source as { photo?: string } | undefined)?.photo ?? '')))
  const fresh = ctx.photos.filter((p) => !used.has(p))
  const pool = fresh.length ? fresh : ctx.photos
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return pool[h % pool.length]
}

export function pools(ctx: EditionContext): Partial<Record<ContentKind, Choice[]>> {
  const used = new Set(ctx.recent.map((r) => `${r.kind}:${r.ref}`))
  const fresh = (kind: ContentKind, items: Choice[]) => {
    const unused = items.filter((i) => !used.has(`${kind}:${i.ref}`))
    return unused.length ? unused : items
  }
  const site = ctx.site
  const confirmedIn = (s: Session) => s.speakers.filter((x) => x.status === 'confirmed' && x.name.trim())
  // The briefings take turns through four layouts, skipping the ones the
  // last posts used, so a run of days does not look the same.
  const lastLayouts = ctx.recent.slice(0, 3).map((r) => String((r.source as { layout?: string } | undefined)?.layout ?? ''))
  const insightLayouts: CardLayout[] = (['headline', 'quote', 'split', 'photo'] as CardLayout[]).filter((l) => !lastLayouts.includes(l))
  const alternate = (i: number): CardLayout => (insightLayouts.length ? insightLayouts : (['headline', 'quote', 'split'] as CardLayout[]))[i % (insightLayouts.length || 3)]
  // A briefing's card: its layout in turn, with an event photo behind the
  // words when the photo layout comes round and a photo is there.
  const insightChoice = (i: PublicInsight, n: number): Choice => {
    const layout = alternate(n)
    const photo = layout === 'photo' ? pickPhoto(ctx, i.slug) : null
    return { kind: 'insight', ref: i.slug, source: { title: i.title, dek: i.dek, category: i.category, published_at: i.published_at, ...(photo ? { photo } : {}) }, link: `${site}/insights/${i.slug}`, layout: layout === 'photo' && !photo ? 'headline' : layout }
  }
  const withPhoto = (seed: string, otherwise: CardLayout): { layout: CardLayout; photo?: string } => {
    const photo = pickPhoto(ctx, seed)
    return photo ? { layout: 'photo', photo } : { layout: otherwise }
  }

  if (ctx.brand === 'nexus') {
    return {
      insight: fresh('insight', ctx.insights.map(insightChoice)),
      platform: fresh('platform', [
        { kind: 'platform', ref: 'what', source: { platform: PLATFORM.name, what: PLATFORM.what, stats: PLATFORM.stats }, link: PLATFORM.link, layout: 'split' },
        ...PLATFORM.stats.map((s) => ({ kind: 'platform' as const, ref: `stat:${s.label}`, source: { platform: PLATFORM.name, what: PLATFORM.what, figure: s.n, label: s.label }, link: PLATFORM.link, layout: 'number' as const })),
      ]),
      signal: fresh('signal', PLATFORM.signals.map((s) => ({ kind: 'signal', ref: s.kind, source: { platform: PLATFORM.name, what: PLATFORM.what, signal: s.kind, watches: s.watches, note: 'Write about this kind of signal and why it matters to decision-makers. Do not invent any specific company, deal, figure or date.' }, link: PLATFORM.link, layout: 'headline' }))),
      event: fresh('event', ctx.upcoming.map((e) => {
        const days = parseDay(e.date)
        const look = eventLook(`${e.series} ${e.city ?? ''}`.trim())
        const photo = withPhoto(e.slug, 'split')
        return { kind: 'event' as const, ref: e.slug, source: { series: e.series, city: e.city, date: e.date, daysToGo: days ? Math.ceil((days - Date.now()) / 86400000) : null, site: look.key === 'pharma' ? BRANDS.pharma.url : BRANDS.health.url, ...photo }, link: look.key === 'pharma' ? `${BRANDS.pharma.url}/book` : `${BRANDS.health.url}/book`, layout: photo.layout }
      })),
    }
  }

  return {
    insight: fresh('insight', ctx.insights.map(insightChoice)),
    session: fresh('session', ctx.sessions.map((s) => {
      const photo = withPhoto(s.id, 'split')
      return { kind: 'session' as const, ref: s.id, source: { title: s.title, type: s.type, talkTitle: s.talkTitle, points: s.points, speakers: confirmedIn(s).map((x) => ({ name: x.name, role: x.role, org: x.org, moderator: x.moderator })), ...photo }, link: `${site}/events`, layout: photo.layout }
    })),
    speaker: fresh('speaker', ctx.speakers.filter((s) => s.linkedin_consent === true && s.name).map((s) => {
      const image = absoluteUrl(s.image)
      return { kind: 'speaker' as const, ref: s.id, source: { name: s.name, role: s.role, org: s.org, bio: (s.bio || '').slice(0, 600), image }, link: `${site}/speakers`, layout: image ? 'portrait' as const : 'headline' as const }
    })),
    theme: fresh('theme', ctx.sessions.flatMap((s) => s.points.map((p, i) => ({ kind: 'theme' as const, ref: `${s.id}:${i}`, source: { question: p, session: s.title }, link: `${site}/events`, layout: 'split' as const })))),
    countdown: ctx.daysToGo != null && ctx.daysToGo > 0 ? [{ kind: 'countdown', ref: String(ctx.daysToGo), source: { daysToGo: ctx.daysToGo, figure: String(ctx.daysToGo), label: ctx.daysToGo === 1 ? 'day to go' : 'days to go' }, link: `${site}/book`, layout: 'number' }] : [],
    sponsor: fresh('sponsor', ctx.sponsors.filter((s) => s.name).map((s) => {
      const logo = absoluteUrl(s.logo)
      return { kind: 'sponsor' as const, ref: s.id, source: { name: s.name, tier: s.tier, category: s.category, website: s.website, logo }, link: `${site}/partners`, layout: logo ? 'logo' as const : 'split' as const }
    })),
  }
}

function choose(ctx: EditionContext, wanted: ContentKind | null): Choice {
  const all = pools(ctx)
  const rotation = ctx.brand === 'nexus' ? NEXUS_KINDS : EVENT_KINDS
  // Among what has not been used lately, the newest few are all fair
  // game, so two runs in a row do not land on the same item.
  const vary = (pool: Choice[]): Choice => pool[Math.floor(Math.random() * Math.min(pool.length, 3))]
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

The card (the image) carries: a kicker (2 to 4 words, e.g. "Panel discussion", "On the line-up", "42 days to go", "From our Insights desk", "Inside the platform"), a headline (at most 70 characters, one idea, no full stop), a subline (at most 90 characters: the supporting fact, a name and role, a question, or the date and city), and a quote (at most 120 characters: one sentence lifted word for word from the material's text, the most striking plain fact in it; an empty string when the material has no text to quote). When the brief gives a figure for a number card, the headline is the label of that figure, not the figure itself. The headline is never the briefing's title restated: it is the finding, the figure, the consequence or the question, as the brief's angle asks.

The caption (the post text): 70 to 140 words. The first line must stand on its own, because LinkedIn folds the rest. Short paragraphs, one blank line between them. End with one line that points to the link, as a plain verb phrase ("Book your pass:", "Read the briefing:", "See who's speaking:", "See the platform:") followed by the URL given. Then the hashtags on their own final line: 3 to 5, CamelCase, no spaces, always including the page's own tag (#WorldHealthAI, #WorldPharmaAI or #WorldNexusGroup) and, for an event, the city.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kicker', 'headline', 'subline', 'quote', 'caption', 'hashtags'],
  properties: {
    kicker: { type: 'string' },
    headline: { type: 'string' },
    subline: { type: 'string' },
    quote: { type: 'string' },
    caption: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
  },
}

interface Draft { kicker: string; headline: string; subline: string; quote: string; caption: string; hashtags: string[] }

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
    `Card layout: ${pick.layout}${pick.layout === 'number' ? ' (the figure is shown large; the headline is its label)' : ''}`,
    `Material (use only this): ${JSON.stringify(material)}`,
    angle ? `Angle for this post: ${angle}` : '',
    ctx.recent.length ? `Headlines of the last posts, not to repeat or echo: ${ctx.recent.slice(0, 12).map((r) => JSON.stringify(r.headline)).join(', ')}` : '',
    ctx.recent.length ? `Opening lines of the last posts, so this one opens differently: ${ctx.recent.slice(0, 6).map((r) => JSON.stringify(String(r.caption || '').split('\n')[0].slice(0, 120))).join(', ')}` : '',
    extra ? `The marketing team's own steer for this post: ${extra}` : '',
    'Return the post as JSON with kicker, headline, subline, quote, caption and hashtags.',
  ]
  return lines.filter(Boolean).join('\n')
}

async function write(ctx: EditionContext, pick: Choice, extra: string | null, angle: string | null): Promise<Draft> {
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
    messages: [{ role: 'user', content: brief(ctx, pick, extra, angle) }],
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
    quote: tidy(draft.quote).replace(/^["“”']+|["“”']+$/g, '').slice(0, 160),
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
  // A briefing is written from its own text, from an angle that moves on
  // each time the same briefing comes round.
  let angle: string | null = null
  if (pick.kind === 'insight' && pick.ref) {
    const text = await readArticle(pick.ref)
    if (text) pick.source = { ...pick.source, text }
    const before = ctx.recent.filter((r) => r.kind === 'insight' && r.ref === pick.ref).length
    angle = INSIGHT_ANGLES[before % INSIGHT_ANGLES.length]
  }
  const { quote, ...draft } = await write(ctx, pick, opts.brief?.trim() || null, angle)
  // A quote card needs a quote; without one it is set as a headline.
  const layout = pick.layout === 'quote' && !quote ? 'headline' : pick.layout
  const { text: _text, ...sourceKept } = pick.source as Record<string, unknown>
  const row = {
    edition: ed.label,
    series: ed.series,
    kind: pick.kind,
    ref: pick.ref,
    forDate: opts.forDate || (await nextFreeDay(ed.label)),
    ...draft,
    link: pick.link,
    source: { ...sourceKept, layout, quote: quote || null, angle, city: ctx.ed.city, date: ctx.event?.date ?? null, site: ctx.site },
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
- end: a closing headline (at most 70 characters) that gives the reader a reason to read the full briefing.
Every figure must appear in the text exactly. If the piece has too few figures for a slide, return empty strings (and an empty points list) for it. Never invent or round a figure, never paraphrase inside quotation marks.

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
    kicker: tidy(d.news?.kicker || '').slice(0, 40) || 'From our Insights desk',
    headline: tidy(d.news?.headline || '').slice(0, 110) || o.title,
    summary: tidy(d.news?.summary || '').slice(0, 240),
    date: o.publishedAt ? new Date(o.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : o.fallbackDate,
  }
  const statFigure = tidy(d.statistic?.figure || '')
  if (statFigure && figureInText(statFigure, body)) {
    extras.push({ kind: 'statistic', figure: statFigure.slice(0, 14), label: tidy(d.statistic.label || '').slice(0, 90), context: tidy(d.statistic.context || '').slice(0, 170), source })
  } else if (statFigure) dropped.push(`statistic "${statFigure}" is not in the briefing`)
  const points = (d.data?.points || [])
    .map((p) => ({ figure: tidy(p.figure || '').slice(0, 14), label: tidy(p.label || '').slice(0, 80) }))
    .filter((p) => p.figure && p.label && p.figure !== statFigure)
  const kept = points.filter((p) => figureInText(p.figure, body)).slice(0, 4)
  if (points.length > kept.length) dropped.push(`${points.length - kept.length} data point(s) not in the briefing`)
  if (kept.length >= 2) extras.push({ kind: 'data', title: tidy(d.data.title || '').slice(0, 80) || 'The data', points: kept, source })
  else if (kept.length) dropped.push('only one data point checked out, too few for a data slide')
  const quote = (d.quote?.text || '').trim().replace(/^["“]+|["”]+$/g, '')
  const speaker = (d.quote?.speaker || '').trim()
  if (quote && speaker && plain(body).includes(plain(quote))) {
    extras.push({ kind: 'quote', text: quote.slice(0, 260), speaker: speaker.slice(0, 80), role: (d.quote.role || '').trim().slice(0, 120), source })
  } else if (quote) dropped.push('the quote is not word for word in the briefing')
  const end: Slide = { kind: 'end', headline: tidy(d.end?.headline || '').slice(0, 90) || 'Read the full briefing', link: o.link }
  return { news, extras, end, dropped }
}

export async function draftCarousel(ed: Edition, opts: { brief?: string | null; forDate?: string | null; ref?: string | null }): Promise<ContentPost> {
  const ctx = await gatherContext(ed)
  const pool = pools(ctx).insight ?? []
  if (!pool.length) throw new ContentError(emptyPoolMessage('insight', ctx))
  // The briefing asked for, else one of the newest not turned into a
  // carousel lately.
  const usedForCarousel = new Set(ctx.recent.filter((r) => (r.source as { format?: string } | undefined)?.format === 'carousel').map((r) => r.ref))
  const fresh = pool.filter((c) => !usedForCarousel.has(c.ref))
  const pick =
    (opts.ref && pool.find((c) => c.ref === opts.ref)) ||
    (fresh.length ? fresh : pool)[Math.floor(Math.random() * Math.min((fresh.length ? fresh : pool).length, 3))]
  const article = await readArticleFull(pick.ref!)
  if (article.body.length < 200) throw new ContentError('The briefing could not be read from worldnexusgroup.com just now, so there is nothing to build slides from. Try again in a minute.', 502)

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new ContentError('ANTHROPIC_API_KEY is not set on the CRM, so nothing can be written.', 400)
  const client = new Anthropic({ apiKey })
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
  const res = await client.beta.messages.create({
    model: process.env.CONTENT_MODEL?.trim() || 'claude-opus-5-5',
    max_tokens: 12000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: CAROUSEL_SCHEMA } },
    system: CAROUSEL_VOICE,
    messages: [{ role: 'user', content: briefText }],
  })
  if (res.stop_reason === 'refusal') throw new ContentError('Claude declined to write this one. Try again, or pick another briefing.', 502)
  const raw = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
  let d: CarouselDraft
  try {
    d = JSON.parse(raw) as CarouselDraft
  } catch {
    throw new ContentError('Claude did not answer in the expected shape. Try again.', 502)
  }

  // Held to the article: a figure or a quote not in it drops its slide.
  const date = ctx.event?.date ?? null
  const { news, extras, end, dropped } = checkSlides(d, article, { title: src.title ?? '', publishedAt: src.published_at ?? null, fallbackDate: date, link: pick.link })
  const slides: Slide[] = [news, ...extras, end]

  const row = {
    edition: ed.label,
    series: ed.series,
    kind: 'insight' as ContentKind,
    ref: pick.ref,
    forDate: opts.forDate || (await nextFreeDay(ed.label)),
    kicker: slides[0].kind === 'news' ? slides[0].kicker : '',
    headline: slides[0].kind === 'news' ? slides[0].headline : '',
    subline: slides[0].kind === 'news' ? slides[0].summary.slice(0, 120) : '',
    caption: tidy(d.caption),
    hashtags: (d.hashtags || []).map((h) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')).filter((h) => h.length > 1).slice(0, 5),
    link: pick.link,
    source: { ...pick.source, format: 'carousel', layout: 'headline', slides, dropped, city: ctx.ed.city, date, site: ctx.site },
    brief: opts.brief?.trim() || null,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('marketing_content').insert(row).select('*').single()
  if (error) throw error
  return data as ContentPost
}
