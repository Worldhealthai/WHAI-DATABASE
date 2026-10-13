// The three pages the Content tab writes for, the looks of their cards, and
// the three styles a card can be drawn in. Shared by the server (the
// writer, the card) and the tab itself, so it holds no server-only code.

export type BrandKey = 'health' | 'pharma' | 'nexus'

export interface Brand {
  key: BrandKey
  name: string
  /** The night colour the card sits on */
  night: string
  /** The one accent: blue, teal, gold */
  accent: string
  /** Text on an accent-coloured surface */
  onAccent: string
  /** The accent as text on white (the light style), dark enough to read */
  accentInk: string
  site: string
  url: string
  tag: string
}

export const BRANDS: Record<BrandKey, Brand> = {
  // The logos' colours (October 2026): World Health AI's blue takes white
  // text (4.8:1), World Pharma AI's teal a deep teal (6.7:1). On white the
  // blue stands as it is; the teal and the gold go deeper to be read.
  health: { key: 'health', name: 'World Health AI', night: '#0A0F1D', accent: '#0066FF', onAccent: '#FFFFFF', accentInk: '#0057DB', site: 'worldhealth.ai', url: 'https://worldhealth.ai', tag: '#WorldHealthAI' },
  pharma: { key: 'pharma', name: 'World Pharma AI', night: '#070B16', accent: '#14B8A6', onAccent: '#04221E', accentInk: '#0F766E', site: 'worldpharma.ai', url: 'https://www.worldpharma.ai', tag: '#WorldPharmaAI' },
  nexus: { key: 'nexus', name: 'World Nexus Group', night: '#0A0A0A', accent: '#F0B429', onAccent: '#1A1200', accentInk: '#946A00', site: 'worldnexusgroup.com', url: 'https://www.worldnexusgroup.com', tag: '#WorldNexusGroup' },
}

export function brandFor(series: string): BrandKey {
  const s = series.toLowerCase()
  if (s.includes('pharma')) return 'pharma'
  if (s.includes('health')) return 'health'
  return 'nexus'
}

// How a card is drawn. Every kind of post (a briefing, a speaker, a
// session, a sponsor, a theme, a countdown) has its own composition in each
// of the three, so one post can be shuffled between three looks:
//   photo: an event photo (or the speaker's headshot) across the card
//   night: the brand colour washed over the night, the house look
//   light: ink on white, the brand colour as the accent
export type CardStyle = 'photo' | 'night' | 'light'
export const CARD_STYLES: { value: CardStyle; label: string; hint: string }[] = [
  { value: 'photo', label: 'Photo', hint: 'An event photo, or the headshot, across the card' },
  { value: 'night', label: 'Night', hint: 'The brand colour over the night: the house look' },
  { value: 'light', label: 'Light', hint: 'Ink on white, the brand colour as the accent' },
]
// The order the automated posts and the Shuffle button go through.
export const STYLE_ORDER: CardStyle[] = ['night', 'photo', 'light']
export const isCardStyle = (v: unknown): v is CardStyle => v === 'photo' || v === 'night' || v === 'light'

// The style a post is drawn in. Posts from before the three styles carried
// a layout and, now and then, a "design"; they are read as the nearest
// style so nothing already drafted changes its look more than it must.
export function styleOf(source: Record<string, unknown> | null | undefined): CardStyle {
  if (!source) return 'night'
  if (isCardStyle(source.style)) return source.style
  const design = (source.design as { style?: string } | null | undefined)?.style
  if (design) return ['cinematic', 'mosaic', 'magazine', 'framed'].includes(design) ? 'photo' : design === 'block' ? 'light' : 'night'
  return source.layout === 'photo' ? 'photo' : 'night'
}

// The next style for a new post: the one the last posts did not use, so
// three posts in a row take all three looks. A chosen style stands, except
// that the photo style needs a photo.
export function nextStyle(recent: { source?: Record<string, unknown> | null }[], wanted: CardStyle | 'rotate' | null | undefined, canPhoto: boolean): CardStyle {
  if (wanted && wanted !== 'rotate') return wanted === 'photo' && !canPhoto ? 'night' : wanted
  const order = STYLE_ORDER.filter((s) => canPhoto || s !== 'photo')
  const last = recent.slice(0, order.length - 1).map((r) => styleOf(r.source))
  return order.find((s) => !last.includes(s)) ?? order[0]
}
