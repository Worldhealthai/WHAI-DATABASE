// The three pages the Content tab writes for, the looks of their cards, and
// the styles a card can be drawn in. Shared by the server (the writer, the
// card) and the tab itself, so it holds no server-only code.

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
// style, so one post can be shuffled between seven looks:
//   photo:  an event photo (or the speaker's headshot) across the card
//   night:  the brand colour washed over the night, the house look
//   light:  ink on white, the brand colour as the accent
//   block:  the whole card in the brand colour
//   frame:  a photo, the headshot or the logo set in a frame, words beside
//   bands:  diagonal bands of the brand colour over the night
//   mosaic: three event photos above, the words below
export type CardStyle = 'photo' | 'night' | 'light' | 'block' | 'frame' | 'bands' | 'mosaic'
export const CARD_STYLES: { value: CardStyle; label: string; hint: string; photos: number }[] = [
  { value: 'photo', label: 'Photo', hint: 'An event photo, or the headshot, across the card', photos: 1 },
  { value: 'night', label: 'Night', hint: 'The brand colour over the night: the house look', photos: 0 },
  { value: 'light', label: 'Light', hint: 'Ink on white, the brand colour as the accent', photos: 0 },
  { value: 'block', label: 'Block', hint: 'The whole card in the brand colour', photos: 0 },
  { value: 'frame', label: 'Frame', hint: 'A photo, the headshot or the logo set in a frame, the words beside it', photos: 1 },
  { value: 'bands', label: 'Bands', hint: 'Diagonal bands of the brand colour over the night', photos: 0 },
  { value: 'mosaic', label: 'Mosaic', hint: 'Three event photos above, the words below', photos: 3 },
]
// The order the automated posts and the Shuffle button go through.
export const STYLE_ORDER: CardStyle[] = ['night', 'photo', 'light', 'block', 'frame', 'bands', 'mosaic']
export const isCardStyle = (v: unknown): v is CardStyle => CARD_STYLES.some((s) => s.value === v)
export const photosFor = (style: CardStyle): number => CARD_STYLES.find((s) => s.value === style)?.photos ?? 0

// The style a post is drawn in. Posts from before the styles carried a
// layout and, now and then, a "design"; they are read as the nearest style
// so nothing already drafted changes its look more than it must.
export function styleOf(source: Record<string, unknown> | null | undefined): CardStyle {
  if (!source) return 'night'
  if (isCardStyle(source.style)) return source.style
  const design = (source.design as { style?: string } | null | undefined)?.style
  if (design) {
    return design === 'cinematic' || design === 'magazine' ? 'photo'
      : design === 'framed' ? 'frame'
      : design === 'mosaic' || design === 'block' || design === 'bands' ? design
      : 'night'
  }
  return source.layout === 'photo' ? 'photo' : 'night'
}

// The photos a post carries for its style: `photos` (the mosaic's three),
// else the one `photo`, else what an older design chose.
export function photosOf(source: Record<string, unknown> | null | undefined): string[] {
  if (!source) return []
  if (Array.isArray(source.photos)) return (source.photos as unknown[]).filter((p): p is string => typeof p === 'string' && p.length > 0)
  if (typeof source.photo === 'string' && source.photo) return [source.photo]
  const design = source.design as { photos?: unknown } | null | undefined
  return Array.isArray(design?.photos) ? (design!.photos as unknown[]).filter((p): p is string => typeof p === 'string') : []
}

// The next style for a new post: the one the last posts did not use, so a
// run of posts takes every look before any comes round again. A chosen
// style stands; a style that needs more photos than there are is passed
// over.
export function nextStyle(recent: { source?: Record<string, unknown> | null }[], wanted: CardStyle | 'rotate' | null | undefined, photoCount: number): CardStyle {
  const possible = STYLE_ORDER.filter((s) => photosFor(s) <= photoCount)
  if (wanted && wanted !== 'rotate') return possible.includes(wanted) ? wanted : 'night'
  const last = recent.slice(0, possible.length - 1).map((r) => styleOf(r.source))
  return possible.find((s) => !last.includes(s)) ?? possible[0]
}
