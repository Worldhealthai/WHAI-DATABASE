// The CRM opens into one workspace per event: choose the event (series +
// city) on the entrance, and everything for it is in one place — sales
// (pipeline, sponsors, partners), people (speakers, delegates), the agenda
// and marketing. Inside, one edition (year) is open at a time; that is the
// same grouping the rest of the CRM uses for its event tabs, so nothing
// about how records are stored changes.

import type { LucideIcon } from 'lucide-react'
import {
  Award, Network, KanbanSquare, LayoutDashboard, Mic, Users, Upload, Inbox, Megaphone, Building2, CalendarDays, PenLine, Sparkles,
} from 'lucide-react'
import type { EventCategory } from '@/lib/eventCategories'

export type PortalKey = 'event'

export interface PortalSection {
  key: string
  label: string
  icon: LucideIcon
  /** Path under /event/{event}; empty string is the overview */
  path: string
  /** The heading it sits under in the sidebar */
  group?: string
}

export interface PortalDef {
  key: PortalKey
  name: string
  short: string
  tagline: string
  description: string
  /** CSS variable names for the accent */
  accent: { fill: string; ink: string; soft: string; line: string }
  sections: PortalSection[]
  /** The record kinds the overview sums up */
  entities: ('sponsor' | 'partner' | 'speaker' | 'delegate')[]
}

export const PORTALS: Record<PortalKey, PortalDef> = {
  event: {
    key: 'event',
    name: 'Event',
    short: 'Event',
    tagline: 'Sales, people, agenda & marketing',
    description: 'Everything for one event, by year: sponsors and partners, speakers and delegates, the agenda, and the LinkedIn posts.',
    accent: { fill: 'var(--accent)', ink: 'var(--accent-ink)', soft: 'var(--accent-soft)', line: 'var(--accent-line)' },
    sections: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard, path: '' },
      { key: 'pipeline', label: 'Pipeline', icon: KanbanSquare, path: 'pipeline', group: 'Sales' },
      { key: 'sponsors', label: 'Sponsors', icon: Award, path: 'sponsors', group: 'Sales' },
      { key: 'partners', label: 'Partners & media', icon: Network, path: 'partners', group: 'Sales' },
      { key: 'speakers', label: 'Speakers', icon: Mic, path: 'speakers', group: 'People' },
      { key: 'delegates', label: 'Delegates', icon: Users, path: 'delegates', group: 'People' },
      { key: 'agenda', label: 'Agenda', icon: CalendarDays, path: 'agenda', group: 'Programme' },
      { key: 'marketing', label: 'Marketing overview', icon: Sparkles, path: 'marketing', group: 'Marketing' },
      { key: 'speaker-posts', label: 'Speaker posts', icon: Megaphone, path: 'speaker-posts', group: 'Marketing' },
      { key: 'sponsor-posts', label: 'Sponsor posts', icon: Building2, path: 'sponsor-posts', group: 'Marketing' },
      { key: 'content', label: 'Content', icon: PenLine, path: 'content', group: 'Marketing' },
    ],
    entities: ['sponsor', 'partner', 'speaker', 'delegate'],
  },
}

export const TOOLS: PortalSection[] = [
  { key: 'import', label: 'Import', icon: Upload, path: '/import' },
  { key: 'unassigned', label: 'Triage inbox', icon: Inbox, path: '/unassigned' },
]

export function isPortalKey(v: string | null | undefined): v is PortalKey {
  return v === 'event'
}

// The three portals the CRM had before (Sales, Production, Marketing), as a
// remembered workspace or an old link may still name them.
const OLD_PORTALS = new Set(['sales', 'production', 'marketing'])

// ── Events ────────────────────────────────────────────────────────────────────

// URL slug for an event category name: "World Health AI London" →
// "world-health-ai-london".
export function eventSlug(categoryName: string): string {
  return categoryName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function categoryFromSlug(slug: string, categories: EventCategory[]): EventCategory | undefined {
  return categories.find((c) => eventSlug(c.name) === slug)
}

// The canonical label a record carries for one edition of an event —
// "World Health AI London 2027". Matches the shape the websites and webhooks
// write, so leads added here for a future year line up with bookings that
// arrive for it later.
export function editionLabel(categoryName: string, year: string | number): string {
  return `${categoryName} ${year}`.trim()
}

// The raw labels a query should match for one edition: everything the data
// already holds under that year, plus the canonical label (so an edition
// with no records yet — next year's pipeline — still resolves).
export function labelsForEdition(category: EventCategory, year: string): string[] {
  const set = new Set<string>(category.labelsByYear[year] ?? [])
  set.add(editionLabel(category.name, year))
  return Array.from(set)
}

// Editions offered for an event: every year present in the data, plus the
// current and next year so the pipeline for a future edition can be started
// before its first booking exists. Newest first.
export function editionYears(category: EventCategory): string[] {
  const now = new Date().getFullYear()
  const years = new Set<string>(category.years)
  // This year only when the event has nothing yet (an edition with no
  // records is not offered: World Pharma AI has no 2026); next year always,
  // for its pipeline.
  if (!years.size) years.add(String(now))
  years.add(String(now + 1))
  return Array.from(years).sort((a, b) => Number(b) - Number(a))
}

// The edition an event opens on: the newest one with anything in it, up to
// next year (so a finished edition hands over to the next once its first
// records arrive), else this year.
export function defaultYear(_portal: PortalKey, category: EventCategory): string {
  const now = new Date().getFullYear()
  const withData = category.years.filter((y) => Number(y) <= now + 1).sort()
  if (withData.length) return withData[withData.length - 1]
  return String(now)
}

// Presentation for an event: its series, city, and the colour that is its
// own everywhere in the CRM — London blue, Boston reddish pink, Pharma teal
// green. The colours live in globals.css as --ev-* tokens.
export type EventKey = 'london' | 'boston' | 'pharma' | 'other'

export interface EventLook {
  key: EventKey
  series: 'World Health AI' | 'World Pharma AI' | string
  short: string
  city: string
  country: string
  /** CSS colour values (var(--ev-…)) */
  accent: string
  accentInk: string
  accentSoft: string
  accentLine: string
  blurb: string
}

const EVENT_COLOURS: Record<EventKey, Pick<EventLook, 'accent' | 'accentInk' | 'accentSoft' | 'accentLine'>> = {
  london: { accent: 'var(--ev-london)', accentInk: 'var(--ev-london-ink)', accentSoft: 'var(--ev-london-soft)', accentLine: 'var(--ev-london-line)' },
  boston: { accent: 'var(--ev-boston)', accentInk: 'var(--ev-boston-ink)', accentSoft: 'var(--ev-boston-soft)', accentLine: 'var(--ev-boston-line)' },
  pharma: { accent: 'var(--ev-pharma)', accentInk: 'var(--ev-pharma-ink)', accentSoft: 'var(--ev-pharma-soft)', accentLine: 'var(--ev-pharma-line)' },
  other: { accent: 'var(--fg-3)', accentInk: 'var(--fg-2)', accentSoft: 'var(--surface-2)', accentLine: 'var(--line-3)' },
}

export function eventLook(categoryName: string): EventLook {
  const n = categoryName.toLowerCase()
  const series = n.includes('pharma') ? 'World Pharma AI' : n.includes('health') ? 'World Health AI' : categoryName
  const short = series === 'World Pharma AI' ? 'WPAI' : series === 'World Health AI' ? 'WHAI' : series.split(' ').map((w) => w[0]).join('').toUpperCase()
  const city = n.includes('boston') ? 'Boston' : n.includes('london') ? 'London' : categoryName.replace(series, '').trim() || '—'
  const country = city === 'Boston' ? 'United States' : city === 'London' ? 'United Kingdom' : ''
  const key: EventKey = series === 'World Pharma AI' ? 'pharma' : city === 'Boston' ? 'boston' : city === 'London' ? 'london' : 'other'
  const blurb =
    series === 'World Pharma AI'
      ? 'AI across pharma R&D, manufacturing and commercial.'
      : city === 'Boston'
        ? 'The US edition: health systems, payers and health-tech.'
        : 'The flagship: clinical leaders, NHS and health-tech.'
  return { key, series, short, city, country, ...EVENT_COLOURS[key], blurb }
}

// The event series on the entrance ("World Health AI" with London and
// Boston inside it; "World Pharma AI" with London), each carrying the colour
// of its lead city so the series tile already hints at what is inside.
export interface EventSeries {
  name: string
  short: string
  look: EventLook
  events: EventCategory[]
  blurb: string
}

export function groupSeries(categories: EventCategory[]): EventSeries[] {
  const map = new Map<string, EventSeries>()
  for (const c of categories) {
    if (c.name === 'Other events') continue
    const look = eventLook(c.name)
    const existing = map.get(look.series)
    if (existing) existing.events.push(c)
    else
      map.set(look.series, {
        name: look.series,
        short: look.short,
        look,
        events: [c],
        blurb:
          look.series === 'World Pharma AI'
            ? 'The pharma series: R&D, manufacturing and commercial AI.'
            : look.series === 'World Health AI'
              ? 'The health series: London and Boston.'
              : '',
      })
  }
  // A series takes its colour from its first city (London for World Health AI).
  const list = Array.from(map.values())
  for (const s of list) {
    const lead = s.events.find((c: EventCategory) => eventLook(c.name).key === 'london') ?? s.events[0]
    s.look = eventLook(lead.name)
  }
  return list
}

// Pages outside a workspace (a sponsor profile, an old list) still sit in
// the event workspace, for the sidebar.
export function portalForPath(pathname: string): PortalKey | null {
  if (/^\/(event|sales|production|marketing|sponsors|partners|speakers|delegates)(\/|$)/.test(pathname)) return 'event'
  return null
}

// Remembered so the sidebar and "back to workspace" links know where the
// admin was, even from a page that isn't inside a workspace.
export interface LastWorkspace {
  portal: PortalKey
  event: string // slug
  year?: string
}
const LAST_KEY = 'crm.lastWorkspace'

export function readLastWorkspace(): LastWorkspace | null {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    if ((isPortalKey(v?.portal) || OLD_PORTALS.has(v?.portal)) && typeof v?.event === 'string') return { ...v, portal: 'event' } as LastWorkspace
  } catch {
    /* ignore */
  }
  return null
}

export function writeLastWorkspace(v: LastWorkspace) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export function workspaceHref(portal: PortalKey, eventSlugValue: string, section = '', year?: string): string {
  const base = `/${portal}/${eventSlugValue}${section ? `/${section}` : ''}`
  return year ? `${base}?year=${encodeURIComponent(year)}` : base
}
