// The company intelligence layer as the CRM reads it (November 2026): the
// JSON document crm.intel_company(key) returns (supabase/migrations/
// 017_intel_crm_views.sql), and the light row crm.v_intel_cards gives the
// Companies tab. Every fact that the design says must carry a source carries
// one here: where it came from, when, how sure we are, and whether a person
// has checked it. Shared by the API routes and the components.

export type SourceKind = 'lusha' | 'website' | 'press' | 'trust' | 'tender' | 'journal' | 'llm' | 'crm' | 'seed' | 'manual' | 'ods' | string
export type Confidence = 'high' | 'medium' | 'low'

export interface Source {
  kind: SourceKind
  label: string          // "Press release (aidoc.com)"
  url: string | null
  date: string | null    // ISO date it was published or observed
}

export interface Sourced<T> {
  value: T
  source: Source
  confidence: Confidence
}

export type DeployStatus = 'Announced' | 'Pilot' | 'Production' | 'Expanded' | 'Discontinued' | 'Not known'
export type ReviewStatus = 'unsourced' | 'proposed' | 'verified' | 'rejected'

// One announced piece of work between a vendor and a hospital, with the
// evidence for it. Read from the vendor's side (hospital named) or the
// hospital's side (vendor named).
export interface Deployment {
  id: string
  vendor: { key: string; name: string; slug?: string | null }
  provider: { key: string; name: string; slug?: string | null }
  useCase: string
  status: DeployStatus
  confidence: Confidence | null
  review: ReviewStatus
  reviewedBy?: string | null
  reviewedAt?: string | null
  evidence: Source | null
  evidenceAll?: (Source & { quote?: string | null })[]
  // For a row with no source: where it came from, and when.
  origin?: string | null
}

export interface SimilarCompany {
  key: string
  name: string
  slug?: string | null
  oneLiner: string | null
  team: number | null
  teamAsOf: string | null
  country: string | null
  hq?: string | null
  // Strings, or whatever the nightly job stored; reasonText() reads either.
  reasons: unknown[]
  score: number | null
  review?: string | null
}

export type CompetitorReview = 'proposed' | 'confirmed' | 'computed' | 'rejected'
export interface Competitor {
  key: string
  name: string
  slug?: string | null
  oneLiner?: string | null
  review: CompetitorReview
  reviewedBy?: string | null
  reviewedAt?: string | null
  confidence?: Confidence | null
  source: Source
}

export interface Signal {
  id?: string
  type: string
  headline: string
  date: string | null
  source: Source
  meta?: Record<string, unknown> | null
}

export interface IntelPerson {
  name: string
  jobTitle: string | null
  seniority: string | null
  department?: string | null
  linkedinUrl: string | null
  country?: string | null
  source: Source
}

export interface Fact {
  field: string
  value: unknown
  confidence: Confidence
  source: Source
}

export interface Whitespace {
  key: string
  name: string
  slug?: string | null
  oneLiner: string | null
  at: string
  atKey?: string | null
  useCase?: string | null
  evidence: Source | null
  confidence: Confidence
  review: ReviewStatus
  reviewedBy?: string | null
}

export type DescriptionKind = 'human' | 'ai' | 'lusha'

// The light row the Companies tab joins (crm.v_intel_cards), in camelCase.
export interface IntelCard {
  crmKey: string
  key: string
  name: string
  slug: string | null
  roles: string[]
  firmographic: string | null
  providerType: string | null
  category: string | null     // the first category's name
  categories: string[]
  oneLiner: string | null
  team: number | null
  teamRange: string | null
  teamAsOf: string | null
  hq: string | null
  hospitals: number           // hospitals named in sourced announcements (vendor side)
  vendors: number             // vendors named in sourced announcements (provider side)
  similar: number
  descriptionKind: DescriptionKind | null
}

// The document crm.intel_company returns.
export interface IntelCompany {
  id: string
  key: string
  slug: string
  name: string
  roles: string[]
  providerType: string | null
  firmographic: string | null
  aliases: string[]
  website: string | null
  domain: string | null
  logoUrl: string | null
  linkedinUrl: string | null
  oneLiner: string | null
  description: {
    value: string | null
    kind: DescriptionKind | null
    sources: Source[]
    writtenAt: string | null
    verifiedBy: string | null
    verifiedAt: string | null
  }
  categories: string[]
  category: string | null
  specialities: string[]
  mainIndustry: string | null
  subIndustry: string | null
  hqCity: string | null
  hqCountry: string | null
  hq: string | null
  region: string | null
  founded: number | null
  team: number | null
  teamRange: string | null
  teamAsOf: string | null
  teamFact: Sourced<number> | null
  funding: { totalUsd: number | null; lastRoundType: string | null; lastRoundUsd: number | null; lastRoundDate: string | null; confidence: Confidence; source: Source } | null
  revenueBand: { minUsd: number | null; maxUsd: number | null; confidence: Confidence; source: Source } | null
  status: string
  acquiredBy: string | null
  odsCode: string | null
  beds: number | null
  lushaEnrichedAt: string | null
  sourceKind: string | null
  updatedAt: string | null
  hospitals: number
  vendors: number
  similar: number
  vendorDeployments: Deployment[]
  providerDeployments: Deployment[]
  similarCompanies: SimilarCompany[]
  competitors: Competitor[]
  signals: Signal[]
  people: IntelPerson[]
  facts: Fact[]
  whitespace: Whitespace[]
}

export const isProvider = (c: Pick<IntelCompany, 'roles' | 'providerType'>) => c.roles.includes('provider') || !!c.providerType

// The provider type as the database stores it, said plainly.
const PROVIDER_TYPES: Record<string, string> = {
  NHS_TRUST: 'NHS trust',
  US_HEALTH_SYSTEM: 'US health system',
  ACADEMIC_MEDICAL_CENTER: 'Academic medical centre',
  PHARMA: 'Pharma',
  PAYOR: 'Payor',
  BIOTECH: 'Biotech',
}
export const providerTypeLabel = (t: string | null | undefined) => (t ? PROVIDER_TYPES[t] ?? t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase()) : null)

// A reason for a similarity score, however the job stored it.
export function reasonText(r: unknown): string {
  if (typeof r === 'string') return r
  if (r && typeof r === 'object') {
    const o = r as Record<string, unknown>
    const s = o.label ?? o.reason ?? o.text ?? o.name
    if (typeof s === 'string') return s
  }
  return String(r ?? '')
}

// A view row (snake_case) to the card the components read.
export function cardFromRow(r: Record<string, unknown>): IntelCard {
  const s = (k: string) => (r[k] == null ? null : String(r[k]))
  const n = (k: string) => (r[k] == null ? null : Number(r[k]))
  const cats = Array.isArray(r.categories) ? (r.categories as string[]) : []
  return {
    crmKey: String(r.crm_key ?? r.key ?? ''),
    key: String(r.key ?? ''),
    name: String(r.name ?? ''),
    slug: s('slug'),
    roles: Array.isArray(r.roles) ? (r.roles as string[]) : [],
    firmographic: s('firmographic'),
    providerType: s('provider_type'),
    category: cats[0] ?? null,
    categories: cats,
    oneLiner: s('one_liner'),
    team: n('employees_exact'),
    teamRange: s('employees_range'),
    teamAsOf: s('employees_as_of'),
    hq: [s('hq_city'), s('hq_country')].filter(Boolean).join(', ') || null,
    hospitals: n('hospitals') ?? 0,
    vendors: n('vendors') ?? 0,
    similar: n('similar') ?? 0,
    descriptionKind: (s('description_kind') as DescriptionKind | null) ?? null,
  }
}
