// What the World Health AI and World Pharma AI pages post about (November
// 2026): AI first. The Insights desk also covers the field's general news
// (trial results, approvals, deals), which made the pages read like a pharma
// news wire. So a page's own pick is a briefing about AI; a general story
// gets a post only when it is big news, and then at most once a week. A
// briefing the team picks themselves in the Content tab is always written.
// The group's own page (World Nexus Group) is about the market and is not
// held to this.

import type { ContentPost, PublicInsight } from '@/lib/contentStudio'

// AI in the title or standfirst: the letters themselves (as capitals, so a
// word like "said" never counts), or the words the field uses for it.
const AI_LETTERS = /\b(AI|A\.I\.|GenAI|LLMs?)\b|\bAI-\w+/
const AI_WORDS = /\b(artificial intelligence|machine[- ]learning|deep[- ]learning|neural networks?|large language models?|generative|foundation models?|chatbots?|agentic|copilots?|algorithms?|in silico|computational|digital twins?|data science|predictive models?)\b/i

export function isAiStory(i: Pick<PublicInsight, 'title' | 'dek'>): boolean {
  const text = `${i.title} ${i.dek ?? ''}`
  return AI_LETTERS.test(text) || AI_WORDS.test(text)
}

// Big news, for a general story: a first, a billion-dollar deal, a late-stage
// win or a landmark decision. Two signs together count as big.
const BIG_SIGNS = [
  /\bfirst\b/i,
  /\$\s?\d+(\.\d+)?\s?(bn|billion)\b|\b\d+(\.\d+)?\s?billion\b/i,
  /\bphase\s?(3|iii)\b/i,
  /\b(acquires?|acquisition|buys?|merger|takeover)\b/i,
  /\b(approv\w*|licen[cs]es?|authoris\w*|authoriz\w*)\b/i,
  /\b(cuts? (the )?risk of death|overall survival|beats?|head[- ]to[- ]head)\b/i,
]
export function bigScore(i: Pick<PublicInsight, 'title' | 'dek'>): number {
  const text = `${i.title} ${i.dek ?? ''}`
  return BIG_SIGNS.filter((r) => r.test(text)).length
}
export const isBigNews = (i: Pick<PublicInsight, 'title' | 'dek'>) => bigScore(i) >= 2

// Days between general stories on a page, and how far back a page looks
// for a briefing to post about by itself.
export const GENERAL_GAP_DAYS = 7
export const FRESH_DAYS = 21

type Recent = Pick<ContentPost, 'kind' | 'headline' | 'source'> & { createdAt?: string | null }

// Whether a post was about a general story: its briefing's title, else its
// own headline.
function wasGeneral(r: Recent): boolean {
  if (r.kind !== 'insight') return false
  const title = String((r.source as { title?: string } | null)?.title || r.headline || '')
  return !isAiStory({ title, dek: null })
}

// May the page have a general story today: none in the last week.
export function generalAllowed(recent: Recent[], now = Date.now()): boolean {
  const since = now - GENERAL_GAP_DAYS * 86400000
  return !recent.some((r) => wasGeneral(r) && Date.parse(r.createdAt || '') >= since)
}

// The page's own pick among fresh briefings: the AI ones, newest first;
// else, when the week allows, the biggest general story; else none.
export function focusedPick<T extends Pick<PublicInsight, 'title' | 'dek'>>(fresh: T[], recent: Recent[]): T | null {
  const ai = fresh.filter(isAiStory)
  if (ai.length) return ai[0]
  if (!generalAllowed(recent)) return null
  const big = fresh.filter(isBigNews).sort((a, b) => bigScore(b) - bigScore(a))
  return big[0] ?? null
}

// The shape an instruction asks for, when it asks for one: "make it a single
// page", "one image", "no carousel"; "two pages"; "a carousel", "five slides".
// What a person asks for is what they get: a post is never given pages or
// slides they did not ask for.
export type AskedFormat = 'single' | 'two-page' | 'carousel'
export function askedFormat(text: string | null | undefined): AskedFormat | null {
  const t = String(text || '')
  if (/\b(single|one)[- ]?(page|pager|image|slide|card|graphic|picture)|\\b1-(page|pager|slide|image)\b|\b(just|only) (one|a single|1) (page|image|slide|card)\b|\bno (carousel|slides|second page|more pages)\b|\bnot a carousel\b/i.test(t)) return 'single'
  if (/\b(two|2)[- ]?(pages?|pager|slides?|images?)\b/i.test(t)) return 'two-page'
  if (/\bcarousel\b|\b(three|four|five|six|3|4|5|6)[- ]?(slides|pages)\b/i.test(t)) return 'carousel'
  return null
}
