// The daily content routine's side of the Content tab. A Claude Code
// routine on the owner's subscription (no API cost) writes each page's post
// about the day's Insights briefing; this code does everything else, as the
// tab's own Generate does: it chooses the briefing, hands over its full
// text and the house voice, checks every figure and quote against that
// text, and files the post as a draft on the edition's Content tab.
//
// The routine writes one draft with everything a post could use (the
// news, a statistic, the data, a quote, the card's words and a caption),
// and the checks decide what it becomes:
//   · a carousel (news, the slides that checked out, a closing slide) when
//     at least two of the statistic, the data and the quote hold up;
//   · a two-page post (the news and that one slide) when only one does;
//   · a single card when none does: the briefing's words in the brand look.
//
// Reached through Nexus (api/admin/insights/content), which relays with the
// shared webhook secret, so the routine needs no secret of its own here.

import { supabase } from '@/lib/supabase'
import { NEXUS_URL, type Edition } from '@/lib/marketingSource'
import { BRANDS, type BrandKey, type CardLayout } from '@/lib/contentBrand'
import type { Slide } from '@/lib/contentCarousel'
import {
  CAROUSEL_SCHEMA,
  ContentError,
  NEXUS_EDITION,
  VOICE,
  checkSlides,
  gatherContext,
  plain,
  pools,
  readArticleFull,
  tidy,
  type CarouselDraft,
  type Choice,
  type ContentPost,
  type EditionContext,
  type PublicInsight,
} from '@/lib/contentStudio'

export type RoutineBrand = BrandKey
export const isRoutineBrand = (v: unknown): v is RoutineBrand => v === 'health' || v === 'pharma' || v === 'nexus'

const SERIES: Record<RoutineBrand, string> = { health: 'World Health AI', pharma: 'World Pharma AI', nexus: 'World Nexus Group' }

interface PublicEvent { slug: string; series: string; label: string; city: string | null; date: string | null; status: string }

const parseDay = (date: string | null | undefined) => {
  const t = date ? Date.parse(date.replace(/^[A-Za-z]+,?\s+/, '')) : NaN
  return Number.isFinite(t) ? t : null
}

// The edition a brand's posts are filed under: the group's own page, or the
// series' next edition with a date (the Content tab's "World Health AI
// London 2027"), else its latest.
export async function routineEdition(brand: RoutineBrand): Promise<Edition> {
  if (brand === 'nexus') return NEXUS_EDITION
  const series = SERIES[brand]
  let events: PublicEvent[] = []
  try {
    const r = await fetch(`${NEXUS_URL}/api/public-events`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (r.ok) events = ((await r.json()) as { events?: PublicEvent[] }).events ?? []
  } catch {
    /* handled below */
  }
  const mine = events.filter((e) => e.series === series && e.status !== 'draft')
  const now = Date.now()
  const upcoming = mine.filter((e) => (parseDay(e.date) ?? -Infinity) > now).sort((a, b) => (parseDay(a.date) ?? 0) - (parseDay(b.date) ?? 0))
  const latest = [...mine].sort((a, b) => (parseDay(b.date) ?? 0) - (parseDay(a.date) ?? 0))
  const e = upcoming[0] ?? latest[0]
  if (!e) throw new ContentError(`No ${series} edition is listed on worldnexusgroup.com, so there is nowhere to file the post.`, 409)
  const year = (e.label.match(/\b(20\d\d)\b/) ?? (e.date || '').match(/\b(20\d\d)\b/))?.[1] ?? ''
  const city = (e.city || '').trim()
  return { series, city, year, label: `${series} ${city} ${year}`.replace(/\s+/g, ' ').trim() }
}

// The routine's posts carry this in their source, so a day's post is
// written once and the tab can say who wrote it.
const BY = 'routine'

interface Picked { ctx: EditionContext; insight: PublicInsight; choice: Choice }

// Today's briefing for the page: the newest published one it has not
// posted about (for the group's page, its own pieces first).
async function pickInsight(brand: RoutineBrand, ref?: string | null): Promise<Picked | null> {
  const ed = await routineEdition(brand)
  const ctx = await gatherContext(ed)
  const posted = new Set(ctx.recent.filter((r) => r.kind === 'insight').map((r) => r.ref))
  const list = ctx.insights
  let insight: PublicInsight | undefined
  if (ref) insight = list.find((i) => i.slug === ref)
  else {
    const fresh = list.filter((i) => !posted.has(i.slug))
    insight = (brand === 'nexus' ? fresh.find((i) => i.site === 'nexus') : undefined) ?? fresh[0]
  }
  if (!insight) return null
  const choice = (pools(ctx).insight ?? []).find((c) => c.ref === insight!.slug) ?? {
    kind: 'insight',
    ref: insight.slug,
    source: { title: insight.title, dek: insight.dek, category: insight.category, published_at: insight.published_at },
    link: `${ctx.site}/insights/${insight.slug}`,
    layout: 'headline' as CardLayout,
  }
  return { ctx, insight, choice }
}

// ── The brief ──────────────────────────────────────────────────────────────

const ROUTINE_VOICE = `${VOICE}

You are writing today's LinkedIn post about one Insights briefing. Write everything a post could use; the checks that follow decide its shape, so you do not choose it:
- news: what happened, as a kicker (2 to 4 words, e.g. "From our Insights desk", "Policy", "Market data"), a headline (at most 80 characters, the development itself, never the briefing's title restated word for word) and a summary (at most 200 characters: who, what, when).
- statistic: the single most striking figure in the piece, the figure exactly as the text gives it ("$311m", "29%", "1,451"), a label saying what it measures (at most 70 characters) and one line of context (at most 140 characters).
- data: two to four further figures from the piece under a short title (at most 60 characters), each a figure exactly as the text gives it and a label (at most 60 characters). Different figures from the statistic.
- quote: words a named person or organisation said, copied exactly, character for character, from a passage the text puts in quotation marks, with the speaker's name and role as the text gives them. At most 220 characters; you may stop at the end of a sentence but never change a word. If the text quotes nobody, empty strings.
- end: a closing headline (at most 70 characters) that gives the reader a reason to read the full briefing.
- card: the words for a single image if the post ends up as one: kicker, headline (at most 70 characters, the finding or consequence, no full stop), subline (at most 90 characters) and quote (at most 120 characters, one sentence lifted word for word from the text, or an empty string).
Every figure must appear in the text exactly. Where the piece has too few figures or no quotation, return empty strings (and an empty points list); a weak slide is worse than none. Never invent or round a figure, never paraphrase inside quotation marks.

The caption: 60 to 120 words, the first line standing on its own, written so it reads right whether the post is one image or several (never mention slides or swiping), ending with "Read the briefing:" and the link given, then 3 to 5 hashtags on their own line.`

const STR = { type: 'string' }
export const ROUTINE_SCHEMA = {
  ...CAROUSEL_SCHEMA,
  required: [...CAROUSEL_SCHEMA.required, 'card'],
  properties: {
    ...CAROUSEL_SCHEMA.properties,
    card: { type: 'object', additionalProperties: false, required: ['kicker', 'headline', 'subline', 'quote'], properties: { kicker: STR, headline: STR, subline: STR, quote: STR } },
  },
}

export interface RoutineDraft extends CarouselDraft {
  card: { kicker: string; headline: string; subline: string; quote: string }
}

export async function routineBrief(brand: RoutineBrand, ref?: string | null) {
  const picked = await pickInsight(brand, ref)
  const page = brand === 'nexus' ? 'World Nexus Group (the group page, about its market intelligence)' : (await routineEdition(brand)).label
  if (!picked) {
    return { brand, page, status: 'nothing' as const, message: `Every published briefing for ${SERIES[brand]} already has a post. Nothing to write today.` }
  }
  const { ctx, insight, choice } = picked
  const article = await readArticleFull(insight.slug)
  if (article.body.length < 200) throw new ContentError(`The briefing "${insight.title}" could not be read from worldnexusgroup.com just now. Try again in a minute.`, 502)
  return {
    brand,
    page,
    status: 'ready' as const,
    edition: ctx.ed.label,
    insight: { ref: insight.slug, title: insight.title, dek: insight.dek, category: insight.category, published_at: insight.published_at, link: choice.link },
    text: article.body,
    publishers: article.publishers,
    recentHeadlines: ctx.recent.slice(0, 12).map((r) => r.headline),
    recentOpenings: ctx.recent.slice(0, 6).map((r) => String(r.caption || '').split('\n')[0].slice(0, 120)),
    instructions: ROUTINE_VOICE,
    schema: ROUTINE_SCHEMA,
    howToSave: 'POST { brand, ref, draft } where draft matches schema. The answer says which shape the post took (carousel, two-page or single) and what was left out.',
  }
}

// ── Saving ─────────────────────────────────────────────────────────────────

export type RoutineFormat = 'carousel' | 'two-page' | 'single'

export async function saveRoutinePost(brand: RoutineBrand, ref: string, d: RoutineDraft): Promise<{ post: ContentPost; format: RoutineFormat; slides: number; dropped: string[] }> {
  const picked = await pickInsight(brand, ref)
  if (!picked) throw new ContentError(`No published briefing "${ref}" for ${SERIES[brand]}.`, 404)
  const { ctx, insight, choice } = picked
  const ed = ctx.ed

  // One routine post per briefing per page.
  const { data: dupe } = await supabase
    .from('marketing_content')
    .select('id')
    .eq('edition', ed.label)
    .eq('ref', insight.slug)
    .eq('source->>by', BY)
    .limit(1)
  if (dupe?.length) throw new ContentError(`The ${SERIES[brand]} post about "${insight.title}" was already written.`, 409)

  const article = await readArticleFull(insight.slug)
  if (article.body.length < 200) throw new ContentError('The briefing could not be read just now, so nothing could be checked. Try again in a minute.', 502)
  const src = choice.source as { title?: string; published_at?: string }
  const date = ctx.event?.date ?? null
  const { news, extras, end, dropped } = checkSlides(d, article, { title: src.title ?? insight.title, publishedAt: src.published_at ?? null, fallbackDate: date, link: choice.link })

  const format: RoutineFormat = extras.length >= 2 ? 'carousel' : extras.length === 1 ? 'two-page' : 'single'
  const slides: Slide[] = format === 'carousel' ? [news, ...extras, end] : format === 'two-page' ? [news, extras[0]] : []
  const n = news.kind === 'news' ? news : null

  // The single card: its quote only if it is word for word in the text, and
  // a quote layout only with one.
  const cardQuoteRaw = tidy(d.card?.quote || '').replace(/^["“”']+|["“”']+$/g, '')
  const cardQuote = cardQuoteRaw && plain(article.body).includes(plain(cardQuoteRaw)) ? cardQuoteRaw.slice(0, 160) : ''
  if (format === 'single' && cardQuoteRaw && !cardQuote) dropped.push('the card quote is not word for word in the briefing')
  const layout: CardLayout = format !== 'single' ? 'headline' : choice.layout === 'quote' && !cardQuote ? 'headline' : choice.layout

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const single = format === 'single'
  const row = {
    edition: ed.label,
    series: ed.series,
    kind: 'insight',
    ref: insight.slug,
    forDate: today,
    kicker: single ? tidy(d.card?.kicker || '').slice(0, 40) || 'From our Insights desk' : n?.kicker ?? '',
    headline: single ? tidy(d.card?.headline || '').slice(0, 90) || insight.title : n?.headline ?? '',
    subline: single ? tidy(d.card?.subline || '').slice(0, 120) : (n?.summary ?? '').slice(0, 120),
    caption: tidy(d.caption || ''),
    hashtags: (d.hashtags || []).map((h) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')).filter((h) => h.length > 1).slice(0, 5),
    link: choice.link,
    source: {
      ...choice.source,
      by: BY,
      ...(single ? {} : { format: 'carousel', pages: format, slides }),
      layout,
      quote: single ? cardQuote || null : null,
      dropped,
      city: ed.city,
      date,
      site: BRANDS[brand].url,
    },
    brief: null,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  }
  if (!row.caption) throw new ContentError('The draft has no caption.', 400)
  const { data, error } = await supabase.from('marketing_content').insert(row).select('*').single()
  if (error) throw error
  return { post: data as ContentPost, format, slides: slides.length || 1, dropped }
}
