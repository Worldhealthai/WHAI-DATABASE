import { PrismaClient } from '@prisma/client'
import {
  companiesData,
  contactsData,
  dealsData,
  dealInvestorsData,
  companyVerticalsData,
  companyTherapeuticAreasData,
  insightsData,
} from '../src/lib/seed-data'

const prisma = new PrismaClient()

async function main() {
  // Clear existing
  await prisma.dealInvestor.deleteMany()
  await prisma.companyVertical.deleteMany()
  await prisma.companyTherapeuticArea.deleteMany()
  await prisma.deal.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.insight.deleteMany()
  await prisma.company.deleteMany()
  console.log('Cleared existing data')

  // Companies
  const companyMap: Record<string, string> = {}
  for (const row of companiesData) {
    const c = await prisma.company.create({
      data: {
        name: row.name, legalName: row.legal_name || null, website: row.website || null,
        description: row.description || null, companyType: row.company_type || null,
        ownershipStatus: row.ownership_status || null, foundedYear: row.founded_year || null,
        employeeCountRange: row.employee_count_range || null, annualRevenueRange: row.annual_revenue_range || null,
        headquartersCountry: row.headquarters_country || null, headquartersCity: row.headquarters_city || null,
        headquartersStateProvince: row.headquarters_state_province || null,
        stockTicker: row.stock_ticker || null, stockExchange: row.stock_exchange || null, tags: row.tags || null,
      },
    })
    companyMap[row.name.toLowerCase()] = c.id
  }
  console.log('Companies:', Object.keys(companyMap).length)

  // Contacts
  let cc = 0
  for (const row of contactsData) {
    const companyId = row.company ? companyMap[row.company.toLowerCase()] : null
    await prisma.contact.create({
      data: {
        firstName: row.first_name || null, lastName: row.last_name || null, email: row.email || null,
        jobTitle: row.job_title || null, seniority: row.seniority || null, department: row.department || null,
        companyName: row.company || null, companyId: companyId || null,
        country: row.country || null, city: row.city || null, stateProvince: row.state_province || null,
        bio: row.bio || null, tags: row.tags || null,
      },
    })
    cc++
  }
  console.log('Contacts:', cc)

  // Deals
  const dealMap: Record<string, string> = {}
  for (const row of dealsData) {
    const val = row.deal_value_usd ? BigInt(row.deal_value_usd.replace(/[^0-9]/g, '')) : null
    const d = await prisma.deal.create({
      data: {
        title: row.title, dealType: row.deal_type || null, dealStage: row.deal_stage || null,
        dealValueUsd: val,
        announcedDate: row.announced_date ? new Date(row.announced_date) : null,
        closedDate: row.closed_date ? new Date(row.closed_date) : null,
        targetCompanyId: row.target_company ? companyMap[row.target_company.toLowerCase()] || null : null,
        acquirerCompanyId: row.acquirer_company ? companyMap[row.acquirer_company.toLowerCase()] || null : null,
        description: row.description || null, tags: row.tags || null,
      },
    })
    dealMap[row.title] = d.id
  }
  console.log('Deals:', Object.keys(dealMap).length)

  // Deal Investors
  for (const row of dealInvestorsData) {
    const dealId = dealMap[row.deal_title]
    if (!dealId) continue
    const val = row.investment_amount_usd ? BigInt(row.investment_amount_usd.replace(/[^0-9]/g, '')) : null
    await prisma.dealInvestor.create({
      data: {
        dealId, investorCompanyName: row.investor_company || null,
        investorCompanyId: row.investor_company ? companyMap[row.investor_company.toLowerCase()] || null : null,
        investorRole: row.investor_role || null, investmentAmountUsd: val,
      },
    })
  }
  console.log('Deal Investors done')

  // Verticals
  for (const row of companyVerticalsData) {
    const companyId = companyMap[row.company_name?.toLowerCase()]
    if (!companyId) continue
    await prisma.companyVertical.create({
      data: { companyId, verticalSlug: row.vertical_slug, isPrimary: row.is_primary },
    })
  }
  console.log('Verticals done')

  // Therapeutic Areas
  for (const row of companyTherapeuticAreasData) {
    const companyId = companyMap[row.company_name?.toLowerCase()]
    if (!companyId) continue
    await prisma.companyTherapeuticArea.create({
      data: { companyId, therapeuticArea: row.therapeutic_area },
    })
  }
  console.log('Therapeutic Areas done')

  // Insights
  for (const row of insightsData) {
    await prisma.insight.create({
      data: {
        title: row.title, contentType: row.content_type || null, summary: row.summary || null,
        body: row.body || null, author: row.author || null,
        publishedAt: row.published_at ? new Date(row.published_at) : null,
        isPremium: row.is_premium, tags: row.tags || null,
      },
    })
  }
  console.log('Insights done')

  // Verify
  const [companies, contacts, deals, insights] = await Promise.all([
    prisma.company.count(), prisma.contact.count(), prisma.deal.count(), prisma.insight.count()
  ])
  console.log(`\nFinal counts: ${companies} companies, ${contacts} contacts, ${deals} deals, ${insights} insights`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
