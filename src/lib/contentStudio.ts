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
interface PublicInsight { slug: string; title: string; dek: string | null; category: string | null; published_at: string | null; cover_image?: string | null }
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
  recent: Pick<ContentPost, 'kind' | 'ref' | 'headline'>[]
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
    supabase.from('marketing_content').select('kind, ref, headline').eq('edition', ed.label).order('createdAt', { ascending: false }).limit(30),
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
    recent: ((recentRes.data ?? []) as Pick<ContentPost, 'kind' | 'ref' | 'headline'>[]),
  }
}

// ── Choosing what today's post is about ─────────────────────────────────────

interface Choice { kind: ContentKind; ref: string | null; source: Record<string, unknown>; link: string; layout: CardLayout }

// A photo for the card, different from the last few posts' where it can be.
function pickPhoto(ctx: EditionContext, seed: string): string | null {
  if (!ctx.photos.length) return null
  const used = new Set(ctx.recent.slice(0, 6).map((r) => String((r as { source?: { photo?: string } }).source?.photo ?? '')))
  const fresh = ctx.photos.filter((p) => !used.has(p))
  const pool = fresh.length ? fresh : ctx.photos
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return pool[h % pool.length]
}

function pools(ctx: EditionContext): Partial<Record<ContentKind, Choice[]>> {
  const used = new Set(ctx.recent.map((r) => `${r.kind}:${r.ref}`))
  const fresh = (kind: ContentKind, items: Choice[]) => {
    const unused = items.filter((i) => !used.has(`${kind}:${i.ref}`))
    return unused.length ? unused : items
  }
  const site = ctx.site
  const confirmedIn = (s: Session) => s.speakers.filter((x) => x.status === 'confirmed' && x.name.trim())
  // The headline layout and the split layout take turns on the briefings.
  const alternate = (i: number): CardLayout => (i % 2 ? 'headline' : 'split')
  const withPhoto = (seed: string, otherwise: CardLayout): { layout: CardLayout; photo?: string } => {
    const photo = pickPhoto(ctx, seed)
    return photo ? { layout: 'photo', photo } : { layout: otherwise }
  }

  if (ctx.brand === 'nexus') {
    return {
      insight: fresh('insight', ctx.insights.map((i, n) => ({ kind: 'insight', ref: i.slug, source: { title: i.title, dek: i.dek, category: i.category, published_at: i.published_at }, link: `${site}/insights/${i.slug}`, layout: alternate(n) }))),
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
    insight: fresh('insight', ctx.insights.map((i, n) => ({ kind: 'insight', ref: i.slug, source: { title: i.title, dek: i.dek, category: i.category, published_at: i.published_at }, link: `${site}/insights/${i.slug}`, layout: alternate(n) }))),
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
  if (wanted) {
    const pool = all[wanted] ?? []
    if (!pool.length) throw new ContentError(emptyPoolMessage(wanted, ctx))
    return pool[0]
  }
  const lastKinds = ctx.recent.slice(0, 2).map((r) => r.kind)
  const order = [...rotation.filter((k) => !lastKinds.includes(k)), ...rotation.filter((k) => lastKinds.includes(k))]
  for (const k of order) if (all[k]?.length) return all[k]![0]
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
const VOICE = `You write LinkedIn posts for World Nexus Group and its executive AI summits: World Health AI (clinical leaders, the NHS, health systems and health-tech) and World Pharma AI (AI across pharma R&D, manufacturing and commercial). World Nexus Group is the parent: its own page is about its intelligence platform, a live map of the AI economy in healthcare and pharma (the vendors, the capital behind them, the operators, the deployments, and the market signals: funding, deployments, hiring, M&A, partnerships). Each post goes out from the page named in the brief.

Voice:
- Short, plain British English. Say what it is. Specific beats grand.
- No hype words (unlock, elevate, seamless, revolutionise, cutting-edge, game-changing, excited, thrilled, delighted). No exclamation marks. No rhetorical questions. No emoji. No em-dashes anywhere: use commas, colons or full stops.
- Sentence case throughout. Never shout in capitals.
- Never invent figures, quotations, names, titles, companies, deals or claims. Use only what the brief supplies. If a detail is not supplied, leave it out.
- Speak as the page, in the first person plural where natural ("we", "our London summit", "our platform"), never as an individual.

The card (the image) carries: a kicker (2 to 4 words, e.g. "Panel discussion", "On the line-up", "42 days to go", "From our Insights desk", "Inside the platform"), a headline (at most 70 characters, one idea, no full stop), and a subline (at most 90 characters: the supporting fact, a name and role, a question, or the date and city). When the brief gives a figure for a number card, the headline is the label of that figure, not the figure itself.

The caption (the post text): 70 to 140 words. The first line must stand on its own, because LinkedIn folds the rest. Short paragraphs, one blank line between them. End with one line that points to the link, as a plain verb phrase ("Book your pass:", "Read the briefing:", "See who's speaking:", "See the platform:") followed by the URL given. Then the hashtags on their own final line: 3 to 5, CamelCase, no spaces, always including the page's own tag (#WorldHealthAI, #WorldPharmaAI or #WorldNexusGroup) and, for an event, the city.`

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

function brief(ctx: EditionContext, pick: Choice, extra: string | null): string {
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
    ctx.recent.length ? `Headlines of the last posts, not to repeat: ${ctx.recent.slice(0, 8).map((r) => JSON.stringify(r.headline)).join(', ')}` : '',
    extra ? `The marketing team's own steer for this post: ${extra}` : '',
    'Return the post as JSON with kicker, headline, subline, caption and hashtags.',
  ]
  return lines.filter(Boolean).join('\n')
}

async function write(ctx: EditionContext, pick: Choice, extra: string | null): Promise<Draft> {
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
    source: { ...pick.source, layout: pick.layout, city: ctx.ed.city, date: ctx.event?.date ?? null, site: ctx.site },
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
