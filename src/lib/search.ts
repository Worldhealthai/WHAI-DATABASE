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
        { firstName: { contains: filters.query, mode: 'insensitive' } },
        { lastName: { contains: filters.query, mode: 'insensitive' } },
        { jobTitle: { contains: filters.query, mode: 'insensitive' } },
        { bio: { contains: filters.query, mode: 'insensitive' } },
        { company: { name: { contains: filters.query, mode: 'insensitive' } } },
      ],
    })
  }

  // seniority_level REMOVED from schema
  // department REMOVED from schema
  // job_function_id REMOVED from schema

  if (filters.companyTypes?.length) {
    AND.push({ company: { companyType: { in: filters.companyTypes as any[] } } })
  }

  if (filters.verticalSlugs?.length) {
    AND.push({
      company: {
        verticals: {
          some: { verticalSlug: { in: filters.verticalSlugs } },
        },
      },
    })
  }

  if (filters.therapeuticAreas?.length) {
    AND.push({
      company: {
        therapeuticAreas: {
          some: { therapeuticArea: { in: filters.therapeuticAreas } },
        },
      },
    })
  }

  if (filters.countries?.length) {
    AND.push({ country: { in: filters.countries } })
  }

  if (filters.cities?.length) {
    AND.push({ city: { in: filters.cities } })
  }

  if (filters.tags?.length) {
    AND.push({
      OR: filters.tags.map((tag: string) => ({
        tags: { contains: tag },
      })),
    })
  }

  if (filters.engagementMin !== undefined || filters.engagementMax !== undefined) {
    AND.push({
      engagementScore: {
        ...(filters.engagementMin !== undefined ? { gte: filters.engagementMin } : {}),
        ...(filters.engagementMax !== undefined ? { lte: filters.engagementMax } : {}),
      },
    })
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
        { legalName: { contains: filters.query, mode: 'insensitive' } },
      ],
    })
  }

  if (filters.companyTypes?.length) {
    AND.push({ companyType: { in: filters.companyTypes as any[] } })
  }

  if (filters.ownershipStatus?.length) {
    AND.push({ ownershipStatus: { in: filters.ownershipStatus as any[] } })
  }

  if (filters.verticalIds?.length) {
    AND.push({
      verticals: {
        some: { verticalSlug: { in: filters.verticalIds } },
      },
    })
  }

  if (filters.therapeuticAreaIds?.length) {
    AND.push({
      therapeuticAreas: {
        some: { therapeuticArea: { in: filters.therapeuticAreaIds } },
      },
    })
  }

  if (filters.countries?.length) {
    AND.push({ headquartersCountry: { in: filters.countries } })
  }

  if (filters.cities?.length) {
    AND.push({ headquartersCity: { in: filters.cities } })
  }

  if (filters.employeeRanges?.length) {
    AND.push({ employeeCountRange: { in: filters.employeeRanges as any[] } })
  }

  if (filters.revenueRanges?.length) {
    AND.push({ annualRevenueRange: { in: filters.revenueRanges as any[] } })
  }

  if (filters.foundedYearMin !== undefined || filters.foundedYearMax !== undefined) {
    AND.push({
      foundedYear: {
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
          dealsAsAcquirer: {
            some: { announcedDate: { gte: thirtyDaysAgo } },
          },
        },
        {
          dealsAsTarget: {
            some: { announcedDate: { gte: thirtyDaysAgo } },
          },
        },
      ],
    })
  }

  if (filters.tags?.length) {
    AND.push({
      OR: filters.tags.map((tag: string) => ({
        tags: { contains: tag },
      })),
    })
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
        { acquirerCompany: { name: { contains: filters.query, mode: 'insensitive' } } },
        { targetCompany: { name: { contains: filters.query, mode: 'insensitive' } } },
      ],
    })
  }

  if (filters.dealTypes?.length) {
    AND.push({ dealType: { in: filters.dealTypes as any[] } })
  }

  if (filters.dealStages?.length) {
    AND.push({ dealStage: { in: filters.dealStages as any[] } })
  }

  if (filters.valueMin !== undefined || filters.valueMax !== undefined) {
    AND.push({
      dealValueUsd: {
        ...(filters.valueMin !== undefined ? { gte: BigInt(filters.valueMin * 100) } : {}),
        ...(filters.valueMax !== undefined ? { lte: BigInt(filters.valueMax * 100) } : {}),
      },
    })
  }

  if (filters.dateFrom || filters.dateTo) {
    AND.push({
      announcedDate: {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      },
    })
  }

  if (filters.acquirerQuery) {
    AND.push({
      acquirerCompany: { name: { contains: filters.acquirerQuery, mode: 'insensitive' } },
    })
  }

  if (filters.targetQuery) {
    AND.push({
      targetCompany: { name: { contains: filters.targetQuery, mode: 'insensitive' } },
    })
  }

  if (filters.investorQuery) {
    AND.push({
      investors: {
        some: {
          investorCompany: { name: { contains: filters.investorQuery, mode: 'insensitive' } },
        },
      },
    })
  }

  // DealVertical model REMOVED — no vertical filtering on deals
  // Deal.country field REMOVED from schema

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
    AND.push({ contentType: { in: filters.contentTypes as any[] } })
  }

  // InsightVertical and InsightTherapeuticArea relations REMOVED from Insight

  if (filters.dateFrom || filters.dateTo) {
    AND.push({
      publishedAt: {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      },
    })
  }

  if (filters.isPremium !== undefined) {
    AND.push({ isPremium: filters.isPremium })
  }

  if (AND.length > 0) where.AND = AND
  return where
}
