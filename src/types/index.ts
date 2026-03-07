// ─────────────────────────────────────────────────────────────────────────────
// WHAI Intelligence Hub — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

// All enum-like fields are now stored as plain strings in the database.
// These label maps provide display values for filter dropdowns and UI.

export const COMPANY_TYPE_OPTIONS = [
  'Pharma', 'Biotech', 'MedTech', 'Health IT', 'CRO', 'CDMO',
  'Payer', 'Provider', 'Government', 'Consulting', 'Investor',
  'Academic', 'Industry Association', 'Solution Provider',
]

export const OWNERSHIP_OPTIONS = [
  'Public', 'Private', 'PE-Backed', 'VC-Backed', 'Government', 'Non-Profit', 'Academic',
]

export const EMPLOYEE_RANGE_OPTIONS = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+',
]

export const REVENUE_RANGE_OPTIONS = [
  '<1M', '1-10M', '10-50M', '50-100M', '100-500M', '500M-1B', '1B+',
]

export const DEAL_TYPE_OPTIONS = [
  'M&A (Acquisition)', 'M&A (Merger)', 'Venture Capital (Seed)',
  'Venture Capital (Series A)', 'Venture Capital (Series B)', 'Venture Capital (Series C+)',
  'Private Equity (Buyout)', 'Private Equity (Growth Equity)', 'Private Equity (Recapitalisation)',
  'IPO', 'SPAC', 'Licensing / Partnership', 'Joint Venture',
  'Asset Sale / Divestiture', 'Debt Financing', 'Grant / Government Funding', 'Secondary Sale',
]

export const DEAL_STAGE_OPTIONS = ['Announced', 'Completed', 'Terminated', 'Rumoured']

export const CONTENT_TYPE_OPTIONS = [
  'Market Report', 'Analysis', 'News Brief', 'Data Snapshot', 'Quarterly Report', 'Podcast Summary',
]

export const SENIORITY_OPTIONS = [
  'C-Suite', 'VP', 'Director', 'Manager', 'Individual Contributor', 'Board',
]

export const DEPARTMENT_OPTIONS = [
  'Clinical', 'R&D', 'IT/Digital', 'Commercial', 'Regulatory',
  'Operations', 'Finance', 'Strategy', 'Executive Leadership',
]

export const INVESTOR_ROLE_OPTIONS = ['Lead', 'Co-Lead', 'Participant', 'Undisclosed']

// ── Filter / API types ────────────────────────────────────────────────────────

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

export interface ContactFilters {
  query?: string
  companyTypes?: string[]
  verticalSlugs?: string[]
  therapeuticAreas?: string[]
  countries?: string[]
  cities?: string[]
  tags?: string[]
  engagementMin?: number
  engagementMax?: number
}

export interface CompanyFilters {
  query?: string
  companyTypes?: string[]
  ownershipStatus?: string[]
  verticalIds?: string[]
  therapeuticAreaIds?: string[]
  countries?: string[]
  cities?: string[]
  employeeRanges?: string[]
  revenueRanges?: string[]
  foundedYearMin?: number
  foundedYearMax?: number
  hasContacts?: boolean
  hasRecentDeals?: boolean
  tags?: string[]
}

export interface DealFilters {
  query?: string
  dealTypes?: string[]
  dealStages?: string[]
  valueMin?: number
  valueMax?: number
  dateFrom?: string
  dateTo?: string
  acquirerQuery?: string
  targetQuery?: string
  investorQuery?: string
}

export interface InsightFilters {
  query?: string
  contentTypes?: string[]
  dateFrom?: string
  dateTo?: string
  isPremium?: boolean
}
