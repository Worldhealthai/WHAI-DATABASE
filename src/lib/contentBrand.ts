// The three pages the Content tab writes for, and the looks of their cards.
// Shared by the server (the writer, the card) and the tab itself, so it
// holds no server-only code.

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
  site: string
  url: string
  tag: string
}

export const BRANDS: Record<BrandKey, Brand> = {
  health: { key: 'health', name: 'World Health AI', night: '#0A0F1D', accent: '#6A8DFF', onAccent: '#070B16', site: 'worldhealth.ai', url: 'https://worldhealth.ai', tag: '#WorldHealthAI' },
  pharma: { key: 'pharma', name: 'World Pharma AI', night: '#070B16', accent: '#2CC7B4', onAccent: '#04221E', site: 'worldpharma.ai', url: 'https://worldpharma.ai', tag: '#WorldPharmaAI' },
  nexus: { key: 'nexus', name: 'World Nexus Group', night: '#0A0A0A', accent: '#F0B429', onAccent: '#1A1200', site: 'worldnexusgroup.com', url: 'https://www.worldnexusgroup.com', tag: '#WorldNexusGroup' },
}

export function brandFor(series: string): BrandKey {
  const s = series.toLowerCase()
  if (s.includes('pharma')) return 'pharma'
  if (s.includes('health')) return 'health'
  return 'nexus'
}

// How a card is set. Which one a post gets is chosen with it (by its kind
// and what it has: a photo, a headshot, a logo, a figure) and can be
// changed on the post afterwards.
export type CardLayout = 'headline' | 'split' | 'photo' | 'portrait' | 'number' | 'logo' | 'quote'
export const CARD_LAYOUTS: { value: CardLayout; label: string; hint: string }[] = [
  { value: 'headline', label: 'Headline', hint: 'The words on the night colour' },
  { value: 'split', label: 'Split', hint: 'A block of the brand colour above' },
  { value: 'photo', label: 'Photo', hint: 'An event photo behind the words' },
  { value: 'portrait', label: 'Portrait', hint: 'A headshot beside the words' },
  { value: 'number', label: 'Number', hint: 'One large figure' },
  { value: 'logo', label: 'Logo', hint: 'A logo on a light plate' },
  { value: 'quote', label: 'Quote', hint: 'One line from the piece, set large' },
]
