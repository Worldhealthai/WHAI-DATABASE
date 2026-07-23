// WHAI CRM — Shared Types

// ── Shared event + sub-type options ──────────────────────────────────────────

// Canonical event labels — series + city + year, so same-year cities never
// collide. Everything the websites/webhooks send is normalised to these, and
// the data-driven /api/event-options extends the list with anything new.
export const EVENT_OPTIONS = [
  'World Health AI London 2026',
  'World Health AI Boston 2025',
  'World Health AI London 2027',
  'World Pharma AI London 2027',
]

// Aliases that have reached the CRM from different writers over time:
// legacy internal names (UK/US Forum) and the city-less labels the Nexus
// sites push ("World Health AI 2026"). Mapped on write and when building
// option lists, so the dropdowns only ever show the canonical set.
const EVENT_ALIASES: Record<string, string> = {
  'uk forum': 'World Health AI London 2026',
  'us forum': 'World Health AI Boston 2025',
  'world health ai 2025': 'World Health AI Boston 2025',
  'world health ai 2026': 'World Health AI London 2026',
  'world health ai 2027': 'World Health AI London 2027',
  'world pharma ai 2027': 'World Pharma AI London 2027',
}

export function canonicalEventLabel(label: string | null | undefined, year?: number | null): string | null {
  const raw = (label || '').trim()
  if (!raw) return null
  // Forum names are year-aware when the caller knows the year (the webhook
  // does): "UK Forum" + 2027 → the 2027 London edition.
  if (/^uk\s*forum$/i.test(raw)) return `World Health AI London ${year ?? 2026}`
  if (/^us\s*forum$/i.test(raw)) return `World Health AI Boston ${year ?? 2025}`
  const direct = EVENT_ALIASES[raw.toLowerCase()]
  if (direct) return direct
  // Generic fallback for future city-less labels: "World Health AI 2028" →
  // London (Boston editions are expected to carry the city or the 2025 alias).
  const m = raw.match(/^world (health|pharma) ai (20\d{2})$/i)
  if (m) {
    const series = m[1].toLowerCase() === 'pharma' ? 'World Pharma AI' : 'World Health AI'
    return `${series} London ${m[2]}`
  }
  return raw
}

export const SUBTYPE_OPTIONS = [
  'End User',
  'Solution Provider',
]

// ── Delegate enums ────────────────────────────────────────────────────────────

export const DELEGATE_STATUS_OPTIONS = [
  'Registered',
  'Confirmed',
  'Cancelled',
  'No-show',
  'Rejected',
]

// Stored value → display label. 'Confirmed' predates the invite flow and now
// reads as "Invited" everywhere; the stored value stays untouched so synced
// systems and existing rows keep working. Removed options (Attended,
// Waitlisted) still display via the fallback if old rows carry them.
export const DELEGATE_STATUS_LABELS: Record<string, string> = {
  Confirmed: 'Invited',
}
export const delegateStatusLabel = (s: string | null | undefined): string =>
  (s && DELEGATE_STATUS_LABELS[s]) || s || ''

export const DELEGATE_TICKET_OPTIONS = [
  'Standard',
  'VIP',
  'Speaker',
  'Sponsor',
  'Press',
  'Complimentary',
  'Virtual',
]

export const DELEGATE_SOURCE_OPTIONS = [
  'Website',
  'Email Campaign',
  'LinkedIn',
  'Referral',
  'Partner',
  'Previous Attendee',
  'Cold Outreach',
  'Event Directory',
  'Other',
]

// ── Speaker enums ─────────────────────────────────────────────────────────────

export const SPEAKER_STATUS_OPTIONS = [
  'Not Contacted',
  'Invited',
  'Discussing',
  'Speaking Confirmed',
  'Cancelled',
  'Rejected',
]

export const SESSION_TYPE_OPTIONS = [
  'Keynote',
  'Panel',
  'Workshop',
  'Fireside Chat',
  'Lightning Talk',
  'Roundtable',
  'Presentation',
  'Q&A',
]

export const SPEAKER_FEE_STATUS_OPTIONS = [
  'Not Set',
  'Negotiating',
  'Agreed',
  'Invoiced',
  'Paid',
  'Waived',
]

export const CONTRACT_STATUS_OPTIONS = [
  'Not Started',
  'Sent',
  'Signed',
  'Executed',
]

export const EXPERTISE_OPTIONS = [
  'AI & Machine Learning',
  'Digital Health',
  'Genomics',
  'Oncology',
  'Cardiology',
  'Neurology',
  'Mental Health',
  'Pharma R&D',
  'MedTech',
  'Health Policy',
  'Health Economics',
  'Data Science',
  'Clinical Trials',
  'Patient Engagement',
  'Regulatory Affairs',
  'Health IT',
  'Precision Medicine',
  'Population Health',
  'Value-Based Care',
  'Telehealth',
]

// ── Sponsor enums ─────────────────────────────────────────────────────────────

export const SPONSOR_TIER_OPTIONS = [
  'Exhibitor',
  'Event Partner',
  'Drinks Sponsor',
  'Badge & Lanyard Sponsor',
  'Wifi Sponsor',
  'Silver Sponsor',
  'Gold Sponsor',
  'Platinum Sponsor',
]

export const SPONSOR_STATUS_OPTIONS = [
  'Not Contacted',
  'Emailed',
  'In Discussion',
  'Confirmed',
  'Rejected',
]

// Partners live in their own table now. "Tier" on a partner record means the
// partner type. Partners share the sponsor status pipeline.
export const PARTNER_TYPE_OPTIONS = [
  'Media Partner',
  'Association Partner',
]

export const PARTNER_STATUS_OPTIONS = SPONSOR_STATUS_OPTIONS

export const SPONSOR_CONTRACT_STATUS_OPTIONS = [
  'Not Started',
  'Sent',
  'Signed',
  'Executed',
]

// ── Activity enums ────────────────────────────────────────────────────────────

export const ACTIVITY_TYPE_OPTIONS = [
  'note',
  'call',
  'email',
  'meeting',
  'status_change',
  'task',
]

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  status_change: 'Status Change',
  task: 'Task',
}

// ── Shared ────────────────────────────────────────────────────────────────────

export const COUNTRY_OPTIONS = [
  'United Kingdom',
  'United States',
  'Germany',
  'France',
  'Switzerland',
  'Netherlands',
  'Ireland',
  'Canada',
  'Australia',
  'Singapore',
  'Japan',
  'India',
  'Sweden',
  'Denmark',
  'Spain',
  'Italy',
  'Belgium',
  'Norway',
  'Finland',
  'UAE',
]

export const CURRENCY_OPTIONS = ['GBP', 'USD', 'EUR', 'CHF', 'CAD', 'AUD', 'SGD']

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ── Entity types ──────────────────────────────────────────────────────────────

export interface Delegate {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  organization?: string | null
  jobTitle?: string | null
  country?: string | null
  city?: string | null
  status: string
  event?: string | null
  subType?: string | null
  ticketType?: string | null
  dietaryRequirements?: string | null
  accessibilityNeeds?: string | null
  source?: string | null
  bio?: string | null
  tags?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  activities?: Activity[]
}

export interface Speaker {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  organization?: string | null
  jobTitle?: string | null
  country?: string | null
  city?: string | null
  headshotUrl?: string | null
  bio?: string | null
  expertiseAreas?: string | null
  status: string
  event?: string | null
  year?: number | null
  subType?: string | null
  sessionTitle?: string | null
  sessionDescription?: string | null
  sessionType?: string | null
  fee?: number | null
  feeCurrency?: string | null
  feeStatus?: string | null
  contractStatus?: string | null
  travelRequired: boolean
  hotelRequired: boolean
  tags?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  activities?: Activity[]
}

export interface Sponsor {
  id: string
  companyName: string
  website?: string | null
  contactFirstName?: string | null
  contactLastName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  contactLinkedinUrl?: string | null
  contactJobTitle?: string | null
  country?: string | null
  city?: string | null
  tier?: string | null
  status: string
  event?: string | null
  valueAmount?: number | null
  valueCurrency?: string | null
  contractStatus?: string | null
  packageDetails?: string | null
  tags?: string | null
  notes?: string | null
  companyId?: string | null
  contactCount?: number
  contacts?: SponsorContact[]
  createdAt: string
  updatedAt: string
  activities?: Activity[]
}

export interface SponsorContact {
  id: string
  companyId: string
  contactFirstName?: string | null
  contactLastName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  contactJobTitle?: string | null
  contactLinkedinUrl?: string | null
  notes?: string | null
  createdAt: string
}

// Partners share the exact shape of Sponsors — they were split into their own
// table but keep the same fields (companyName, contacts, tier = partner type…).
export type Partner = Sponsor
export type PartnerContact = SponsorContact
export type PartnerFilters = SponsorFilters

export interface Activity {
  id: string
  entityType: 'delegate' | 'speaker' | 'sponsor' | 'partner'
  delegateId?: string | null
  speakerId?: string | null
  sponsorId?: string | null
  partnerId?: string | null
  type: string
  content: string
  metadata?: string | null
  createdBy?: string | null
  createdAt: string
}

// ── Filter types ──────────────────────────────────────────────────────────────

export interface DelegateFilters {
  query?: string
  statuses?: string[]
  events?: string[]
  subTypes?: string[]
  ticketTypes?: string[]
  countries?: string[]
  tags?: string[]
  sources?: string[]
}

export interface SpeakerFilters {
  query?: string
  statuses?: string[]
  events?: string[]
  years?: number[]
  subTypes?: string[]
  sessionTypes?: string[]
  contractStatuses?: string[]
  countries?: string[]
  expertiseAreas?: string[]
  tags?: string[]
}

export interface SponsorFilters {
  query?: string
  statuses?: string[]
  events?: string[]
  tiers?: string[]
  contractStatuses?: string[]
  countries?: string[]
  tags?: string[]
}
