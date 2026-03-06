// ─────────────────────────────────────────────────────────────────────────────
// WHAI Intelligence Hub — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type SeniorityLevel = 'C_SUITE' | 'VP' | 'DIRECTOR' | 'MANAGER' | 'INDIVIDUAL_CONTRIBUTOR' | 'BOARD'
export type Department = 'CLINICAL' | 'RD' | 'IT_DIGITAL' | 'COMMERCIAL' | 'REGULATORY' | 'OPERATIONS' | 'FINANCE' | 'STRATEGY' | 'EXECUTIVE_LEADERSHIP'
export type CompanyType = 'PHARMA' | 'BIOTECH' | 'MEDTECH' | 'HEALTH_IT' | 'CRO' | 'CDMO' | 'PAYER' | 'PROVIDER' | 'GOVERNMENT' | 'CONSULTING' | 'INVESTOR' | 'ACADEMIC' | 'INDUSTRY_ASSOCIATION' | 'SOLUTION_PROVIDER'
export type OwnershipStatus = 'PUBLIC' | 'PRIVATE' | 'PE_BACKED' | 'VC_BACKED' | 'GOVERNMENT' | 'NON_PROFIT' | 'ACADEMIC'
export type EmployeeCountRange = 'RANGE_1_10' | 'RANGE_11_50' | 'RANGE_51_200' | 'RANGE_201_500' | 'RANGE_501_1000' | 'RANGE_1001_5000' | 'RANGE_5001_10000' | 'RANGE_10000_PLUS'
export type AnnualRevenueRange = 'LESS_THAN_1M' | 'RANGE_1_10M' | 'RANGE_10_50M' | 'RANGE_50_100M' | 'RANGE_100_500M' | 'RANGE_500M_1B' | 'ABOVE_1B'
export type DealType = 'MA_ACQUISITION' | 'MA_MERGER' | 'VC_SEED' | 'VC_SERIES_A' | 'VC_SERIES_B' | 'VC_SERIES_C_PLUS' | 'PE_BUYOUT' | 'PE_GROWTH_EQUITY' | 'PE_RECAPITALISATION' | 'IPO' | 'SPAC' | 'LICENSING_PARTNERSHIP' | 'JOINT_VENTURE' | 'ASSET_SALE' | 'DEBT_FINANCING' | 'GRANT' | 'SECONDARY_SALE'
export type DealStage = 'ANNOUNCED' | 'COMPLETED' | 'TERMINATED' | 'RUMOURED'
export type ContentType = 'MARKET_REPORT' | 'ANALYSIS' | 'NEWS_BRIEF' | 'DATA_SNAPSHOT' | 'QUARTERLY_REPORT' | 'PODCAST_SUMMARY'

// ── Display label maps ────────────────────────────────────────────────────────

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  C_SUITE: 'C-Suite',
  VP: 'VP',
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  INDIVIDUAL_CONTRIBUTOR: 'Individual Contributor',
  BOARD: 'Board',
}

export const DEPARTMENT_LABELS: Record<Department, string> = {
  CLINICAL: 'Clinical',
  RD: 'R&D',
  IT_DIGITAL: 'IT/Digital',
  COMMERCIAL: 'Commercial',
  REGULATORY: 'Regulatory',
  OPERATIONS: 'Operations',
  FINANCE: 'Finance',
  STRATEGY: 'Strategy',
  EXECUTIVE_LEADERSHIP: 'Executive Leadership',
}

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  PHARMA: 'Pharma',
  BIOTECH: 'Biotech',
  MEDTECH: 'MedTech / Medical Device',
  HEALTH_IT: 'Health IT / Digital Health',
  CRO: 'CRO',
  CDMO: 'CDMO',
  PAYER: 'Payer / Insurer',
  PROVIDER: 'Provider / Health System',
  GOVERNMENT: 'Government / Public Health Body',
  CONSULTING: 'Consulting / Advisory',
  INVESTOR: 'Investor (PE/VC/Family Office)',
  ACADEMIC: 'Academic / Research Institution',
  INDUSTRY_ASSOCIATION: 'Industry Association',
  SOLUTION_PROVIDER: 'Solution Provider / Vendor',
}

export const OWNERSHIP_LABELS: Record<OwnershipStatus, string> = {
  PUBLIC: 'Public',
  PRIVATE: 'Private',
  PE_BACKED: 'PE-Backed',
  VC_BACKED: 'VC-Backed',
  GOVERNMENT: 'Government/NHS',
  NON_PROFIT: 'Non-Profit',
  ACADEMIC: 'Academic',
}

export const EMPLOYEE_RANGE_LABELS: Record<EmployeeCountRange, string> = {
  RANGE_1_10: '1–10',
  RANGE_11_50: '11–50',
  RANGE_51_200: '51–200',
  RANGE_201_500: '201–500',
  RANGE_501_1000: '501–1,000',
  RANGE_1001_5000: '1,001–5,000',
  RANGE_5001_10000: '5,001–10,000',
  RANGE_10000_PLUS: '10,000+',
}

export const REVENUE_RANGE_LABELS: Record<AnnualRevenueRange, string> = {
  LESS_THAN_1M: '<$1M',
  RANGE_1_10M: '$1–10M',
  RANGE_10_50M: '$10–50M',
  RANGE_50_100M: '$50–100M',
  RANGE_100_500M: '$100–500M',
  RANGE_500M_1B: '$500M–1B',
  ABOVE_1B: '$1B+',
}

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  MA_ACQUISITION: 'M&A (Acquisition)',
  MA_MERGER: 'M&A (Merger)',
  VC_SEED: 'VC Seed',
  VC_SERIES_A: 'VC Series A',
  VC_SERIES_B: 'VC Series B',
  VC_SERIES_C_PLUS: 'VC Series C+',
  PE_BUYOUT: 'PE Buyout',
  PE_GROWTH_EQUITY: 'PE Growth Equity',
  PE_RECAPITALISATION: 'PE Recapitalisation',
  IPO: 'IPO',
  SPAC: 'SPAC',
  LICENSING_PARTNERSHIP: 'Licensing / Partnership',
  JOINT_VENTURE: 'Joint Venture',
  ASSET_SALE: 'Asset Sale / Divestiture',
  DEBT_FINANCING: 'Debt Financing',
  GRANT: 'Grant / Government Funding',
  SECONDARY_SALE: 'Secondary Sale',
}

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  ANNOUNCED: 'Announced',
  COMPLETED: 'Completed',
  TERMINATED: 'Terminated',
  RUMOURED: 'Rumoured',
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  MARKET_REPORT: 'Market Report',
  ANALYSIS: 'Analysis',
  NEWS_BRIEF: 'News Brief',
  DATA_SNAPSHOT: 'Data Snapshot',
  QUARTERLY_REPORT: 'Quarterly Report',
  PODCAST_SUMMARY: 'Podcast Summary',
}

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
  seniority?: SeniorityLevel[]
  department?: Department[]
  jobFunctionIds?: string[]
  companyTypes?: CompanyType[]
  verticalIds?: string[]
  therapeuticAreaIds?: string[]
  regionIds?: string[]
  countries?: string[]
  cities?: string[]
  tags?: string[]
  engagementMin?: number
  engagementMax?: number
  isVerified?: boolean
}

export interface CompanyFilters {
  query?: string
  companyTypes?: CompanyType[]
  ownershipStatus?: OwnershipStatus[]
  verticalIds?: string[]
  therapeuticAreaIds?: string[]
  countries?: string[]
  cities?: string[]
  employeeRanges?: EmployeeCountRange[]
  revenueRanges?: AnnualRevenueRange[]
  foundedYearMin?: number
  foundedYearMax?: number
  hasContacts?: boolean
  hasRecentDeals?: boolean
  tags?: string[]
}

export interface DealFilters {
  query?: string
  dealTypes?: DealType[]
  dealStages?: DealStage[]
  valueMin?: number
  valueMax?: number
  dateFrom?: string
  dateTo?: string
  acquirerQuery?: string
  targetQuery?: string
  investorQuery?: string
  verticalIds?: string[]
  therapeuticAreaIds?: string[]
  countries?: string[]
  valueDisclosed?: boolean
}

export interface InsightFilters {
  query?: string
  contentTypes?: ContentType[]
  verticalIds?: string[]
  therapeuticAreaIds?: string[]
  dateFrom?: string
  dateTo?: string
  isPremium?: boolean
}

// ── Taxonomy types ────────────────────────────────────────────────────────────

export interface TaxonomyItem {
  id: string
  name: string
  slug: string
  sort_order?: number
  description?: string
}

export interface HierarchicalVertical extends TaxonomyItem {
  parent_id: string | null
  children: HierarchicalVertical[]
}
