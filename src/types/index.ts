// WHAI CRM — Shared Types

// ── Shared event + sub-type options ──────────────────────────────────────────

export const EVENT_OPTIONS = [
  'UK Forum',
  'US Forum',
]

export const SUBTYPE_OPTIONS = [
  'End User',
  'Solution Provider',
]

// ── Delegate enums ────────────────────────────────────────────────────────────

export const DELEGATE_STATUS_OPTIONS = [
  'Registered',
  'Confirmed',
  'Attended',
  'Cancelled',
  'No-show',
  'Waitlisted',
  'Rejected',
]

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
  'Speaking Rejected',
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
  'Media Partner',
  'Association Partner',
]

export const SPONSOR_STATUS_OPTIONS = [
  'Not Contacted',
  'Emailed',
  'In Discussion',
  'Confirmed',
  'Rejected',
]

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

export interface Activity {
  id: string
  entityType: 'delegate' | 'speaker' | 'sponsor'
  delegateId?: string | null
  speakerId?: string | null
  sponsorId?: string | null
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
