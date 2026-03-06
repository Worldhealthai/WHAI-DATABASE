// ─────────────────────────────────────────────────────────────────────────────
// WHAI Search Query Builder
// Translates frontend filter state → Prisma where clauses
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'
import type {
  ContactFilters,
  CompanyFilters,
  DealFilters,
  InsightFilters,
} from '@/types'

export function buildContactWhere(filters: ContactFilters): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = {}
  const AND: Prisma.ContactWhereInput[] = []

  if (filters.query) {
    AND.push({
      OR: [
        { first_name: { contains: filters.query, mode: 'insensitive' } },
        { last_name: { contains: filters.query, mode: 'insensitive' } },
        { job_title: { contains: filters.query, mode: 'insensitive' } },
        { bio: { contains: filters.query, mode: 'insensitive' } },
        { company: { name: { contains: filters.query, mode: 'insensitive' } } },
      ],
    })
  }

  if (filters.seniority?.length) {
    AND.push({ seniority_level: { in: filters.seniority as any[] } })
  }

  if (filters.department?.length) {
    AND.push({ department: { in: filters.department as any[] } })
  }

  if (filters.jobFunctionIds?.length) {
    AND.push({ job_function_id: { in: filters.jobFunctionIds } })
  }

  if (filters.companyTypes?.length) {
    AND.push({ company: { company_type: { in: filters.companyTypes as any[] } } })
  }

  if (filters.verticalIds?.length) {
    AND.push({
      company: {
        verticals: {
          some: { vertical_id: { in: filters.verticalIds } },
        },
      },
    })
  }

  if (filters.therapeuticAreaIds?.length) {
    AND.push({
      company: {
        therapeutic_areas: {
          some: { therapeutic_area_id: { in: filters.therapeuticAreaIds } },
        },
      },
    })
  }

  if (filters.regionIds?.length) {
    AND.push({ region_id: { in: filters.regionIds } })
  }

  if (filters.countries?.length) {
    AND.push({ country: { in: filters.countries } })
  }

  if (filters.cities?.length) {
    AND.push({ city: { in: filters.cities } })
  }

  if (filters.tags?.length) {
    AND.push({ tags: { hasSome: filters.tags } })
  }

  if (filters.engagementMin !== undefined || filters.engagementMax !== undefined) {
    AND.push({
      engagement_score: {
        ...(filters.engagementMin !== undefined ? { gte: filters.engagementMin } : {}),
        ...(filters.engagementMax !== undefined ? { lte: filters.engagementMax } : {}),
      },
    })
  }

  if (filters.isVerified !== undefined) {
    AND.push({ is_verified: filters.isVerified })
  }

  if (AND.length > 0) where.AND = AND
  return where
}

export function buildCompanyWhere(filters: CompanyFilters): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = {}
  const AND: Prisma.CompanyWhereInput[] = []

  if (filters.query) {
    AND.push({
      OR: [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
        { legal_name: { contains: filters.query, mode: 'insensitive' } },
      ],
    })
  }

  if (filters.companyTypes?.length) {
    AND.push({ company_type: { in: filters.companyTypes as any[] } })
  }

  if (filters.ownershipStatus?.length) {
    AND.push({ ownership_status: { in: filters.ownershipStatus as any[] } })
  }

  if (filters.verticalIds?.length) {
    AND.push({
      verticals: {
        some: { vertical_id: { in: filters.verticalIds } },
      },
    })
  }

  if (filters.therapeuticAreaIds?.length) {
    AND.push({
      therapeutic_areas: {
        some: { therapeutic_area_id: { in: filters.therapeuticAreaIds } },
      },
    })
  }

  if (filters.countries?.length) {
    AND.push({ headquarters_country: { in: filters.countries } })
  }

  if (filters.cities?.length) {
    AND.push({ headquarters_city: { in: filters.cities } })
  }

  if (filters.employeeRanges?.length) {
    AND.push({ employee_count_range: { in: filters.employeeRanges as any[] } })
  }

  if (filters.revenueRanges?.length) {
    AND.push({ annual_revenue_range: { in: filters.revenueRanges as any[] } })
  }

  if (filters.foundedYearMin !== undefined || filters.foundedYearMax !== undefined) {
    AND.push({
      founded_year: {
        ...(filters.foundedYearMin !== undefined ? { gte: filters.foundedYearMin } : {}),
        ...(filters.foundedYearMax !== undefined ? { lte: filters.foundedYearMax } : {}),
      },
    })
  }

  if (filters.hasContacts) {
    AND.push({ contacts: { some: {} } })
  }

  if (filters.hasRecentDeals) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    AND.push({
      OR: [
        {
          deals_as_acquirer: {
            some: { announced_date: { gte: thirtyDaysAgo } },
          },
        },
        {
          deals_as_target: {
            some: { announced_date: { gte: thirtyDaysAgo } },
          },
        },
      ],
    })
  }

  if (filters.tags?.length) {
    AND.push({ tags: { hasSome: filters.tags } })
  }

  if (AND.length > 0) where.AND = AND
  return where
}

export function buildDealWhere(filters: DealFilters): Prisma.DealWhereInput {
  const where: Prisma.DealWhereInput = {}
  const AND: Prisma.DealWhereInput[] = []

  if (filters.query) {
    AND.push({
      OR: [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
        { acquirer_company: { name: { contains: filters.query, mode: 'insensitive' } } },
        { target_company: { name: { contains: filters.query, mode: 'insensitive' } } },
      ],
    })
  }

  if (filters.dealTypes?.length) {
    AND.push({ deal_type: { in: filters.dealTypes as any[] } })
  }

  if (filters.dealStages?.length) {
    AND.push({ deal_stage: { in: filters.dealStages as any[] } })
  }

  if (filters.valueMin !== undefined || filters.valueMax !== undefined) {
    AND.push({
      deal_value_usd: {
        ...(filters.valueMin !== undefined ? { gte: BigInt(filters.valueMin * 100) } : {}),
        ...(filters.valueMax !== undefined ? { lte: BigInt(filters.valueMax * 100) } : {}),
      },
    })
  }

  if (filters.dateFrom || filters.dateTo) {
    AND.push({
      announced_date: {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      },
    })
  }

  if (filters.acquirerQuery) {
    AND.push({
      acquirer_company: { name: { contains: filters.acquirerQuery, mode: 'insensitive' } },
    })
  }

  if (filters.targetQuery) {
    AND.push({
      target_company: { name: { contains: filters.targetQuery, mode: 'insensitive' } },
    })
  }

  if (filters.investorQuery) {
    AND.push({
      investors: {
        some: {
          company: { name: { contains: filters.investorQuery, mode: 'insensitive' } },
        },
      },
    })
  }

  if (filters.verticalIds?.length) {
    AND.push({
      verticals: {
        some: { vertical_id: { in: filters.verticalIds } },
      },
    })
  }

  if (filters.countries?.length) {
    AND.push({ country: { in: filters.countries } })
  }

  if (filters.valueDisclosed !== undefined) {
    AND.push({ deal_value_disclosed: filters.valueDisclosed })
  }

  if (AND.length > 0) where.AND = AND
  return where
}

export function buildInsightWhere(filters: InsightFilters): Prisma.InsightWhereInput {
  const where: Prisma.InsightWhereInput = {}
  const AND: Prisma.InsightWhereInput[] = []

  if (filters.query) {
    AND.push({
      OR: [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { summary: { contains: filters.query, mode: 'insensitive' } },
        { body: { contains: filters.query, mode: 'insensitive' } },
      ],
    })
  }

  if (filters.contentTypes?.length) {
    AND.push({ content_type: { in: filters.contentTypes as any[] } })
  }

  if (filters.verticalIds?.length) {
    AND.push({
      verticals: {
        some: { vertical_id: { in: filters.verticalIds } },
      },
    })
  }

  if (filters.therapeuticAreaIds?.length) {
    AND.push({
      therapeutic_areas: {
        some: { therapeutic_area_id: { in: filters.therapeuticAreaIds } },
      },
    })
  }

  if (filters.dateFrom || filters.dateTo) {
    AND.push({
      published_at: {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      },
    })
  }

  if (filters.isPremium !== undefined) {
    AND.push({ is_premium: filters.isPremium })
  }

  if (AND.length > 0) where.AND = AND
  return where
}
