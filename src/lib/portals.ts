// The two portals the CRM opens into, and the events inside each.
//
// Sales is where sponsorship and partnership revenue is chased: sponsors,
// partners & media, and the pipeline for the next edition. Production is the
// event itself: the speakers being lined up and the delegates in the room.
// Both are scoped to one event (series + city) and, inside it, one edition
// (year) — the same grouping the rest of the CRM already uses for its event
// tabs, so nothing about how records are stored changes.

import type { LucideIcon } from 'lucide-react'
import {
  Award, Network, KanbanSquare, LayoutDashboard, Mic, Users, Upload, Inbox,
} from 'lucide-react'
import type { EventCategory } from '@/lib/eventCategories'

export type PortalKey = 'sales' | 'production'

export interface PortalSection {
  key: string
  label: string
  icon: LucideIcon
  /** Path under /{portal}/{event}; empty string is the overview */
  path: string
}

export interface PortalDef {
  key: PortalKey
  name: string
  short: string
  tagline: string
  description: string
  /** CSS variable names for this portal's accent */
  accent: { fill: string; ink: string; soft: string; line: string }
  sections: PortalSection[]
  /** The record kinds this portal works with */
  entities: ('sponsor' | 'partner' | 'speaker' | 'delegate')[]
}

export const PORTALS: Record<PortalKey, PortalDef> = {
  sales: {
    key: 'sales',
    name: 'Sales CRM',
    short: 'Sales',
    tagline: 'Sponsors, partners & the pipeline',
    description:
      'Every sponsorship and partnership conversation, by event and by year — and the pipeline of leads to chase for the next edition.',
    accent: { fill: 'var(--sales)', ink: 'var(--sales-ink)', soft: 'var(--sales-soft)', line: 'var(--sales-line)' },
    sections: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard, path: '' },
      { key: 'pipeline', label: 'Pipeline', icon: KanbanSquare, path: 'pipeline' },
      { key: 'sponsors', label: 'Sponsors', icon: Award, path: 'sponsors' },
      { key: 'partners', label: 'Partners & media', icon: Network, path: 'partners' },
    ],
    entities: ['sponsor', 'partner'],
  },
  production: {
    key: 'production',
    name: 'Production CRM',
    short: 'Production',
    tagline: 'Speakers & delegates',
    description:
      'The people on stage and in the room: speaker outreach through to confirmation, and every delegate registration, by event and by year.',
    accent: { fill: 'var(--prod)', ink: 'var(--prod-ink)', soft: 'var(--prod-soft)', line: 'var(--prod-line)' },
    sections: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard, path: '' },
      { key: 'speakers', label: 'Speakers', icon: Mic, path: 'speakers' },
      { key: 'delegates', label: 'Delegates', icon: Users, path: 'delegates' },
    ],
    entities: ['speaker', 'delegate'],
  },
}

export const TOOLS: PortalSection[] = [
  { key: 'import', label: 'Import', icon: Upload, path: '/import' },
  { key: 'unassigned', label: 'Triage inbox', icon: Inbox, path: '/unassigned' },
]

export function isPortalKey(v: string | null | undefined): v is PortalKey {
  return v === 'sales' || v === 'production'
}

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
  years.add(String(now))
  years.add(String(now + 1))
  return Array.from(years).sort((a, b) => Number(b) - Number(a))
}

// Where a portal lands by default inside an event: Sales starts on next
// year's pipeline (that is the work in front of the team); Production on the
// nearest edition with anything in it, else this year.
export function defaultYear(portal: PortalKey, category: EventCategory): string {
  const now = new Date().getFullYear()
  if (portal === 'sales') return String(now + 1)
  const withData = category.years.filter((y) => Number(y) <= now + 1)
  if (withData.length) return withData[withData.length - 1]
  return String(now)
}

// Presentation for the event tiles on the entrance.
export interface EventLook {
  series: 'World Health AI' | 'World Pharma AI' | string
  short: string
  city: string
  country: string
  gradient: string
  blurb: string
}

export function eventLook(categoryName: string): EventLook {
  const n = categoryName.toLowerCase()
  const series = n.includes('pharma') ? 'World Pharma AI' : n.includes('health') ? 'World Health AI' : categoryName
  const short = series === 'World Pharma AI' ? 'WPAI' : series === 'World Health AI' ? 'WHAI' : series.split(' ').map((w) => w[0]).join('').toUpperCase()
  const city = n.includes('boston') ? 'Boston' : n.includes('london') ? 'London' : categoryName.replace(series, '').trim() || '—'
  const country = city === 'Boston' ? 'United States' : city === 'London' ? 'United Kingdom' : ''
  const gradient =
    series === 'World Pharma AI'
      ? 'linear-gradient(135deg, #0f766e 0%, #14b8a6 55%, #5eead4 100%)'
      : city === 'Boston'
        ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #93c5fd 100%)'
        : 'linear-gradient(135deg, #0b3b5c 0%, #0b7a96 55%, #67d5ee 100%)'
  const blurb =
    series === 'World Pharma AI'
      ? 'AI across pharma R&D, manufacturing and commercial.'
      : city === 'Boston'
        ? 'The US edition: health systems, payers and health-tech.'
        : 'The flagship: clinical leaders, NHS and health-tech.'
  return { series, short, city, country, gradient, blurb }
}

// A record's kind → the portal that owns it, for the sidebar when someone
// opens an old-style page (a sponsor profile, the speakers list) directly.
export function portalForPath(pathname: string): PortalKey | null {
  if (pathname.startsWith('/sales')) return 'sales'
  if (pathname.startsWith('/production')) return 'production'
  if (pathname.startsWith('/sponsors') || pathname.startsWith('/partners')) return 'sales'
  if (pathname.startsWith('/speakers') || pathname.startsWith('/delegates')) return 'production'
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
    if (isPortalKey(v?.portal) && typeof v?.event === 'string') return v as LastWorkspace
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
