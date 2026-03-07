import { prisma } from './prisma'
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

let seedPromise: Promise<void> | null = null
let seeded = false

function readCsv(filename: string): Record<string, string>[] {
  const filePath = path.join(process.cwd(), 'prisma', filename)
  const content = fs.readFileSync(filePath, 'utf-8')
  return parse(content, { columns: true, skip_empty_lines: true, trim: true })
}

function safeInt(val: string): number | undefined {
  const n = parseInt(val)
  return isNaN(n) ? undefined : n
}

function safeBigInt(val: string): bigint | undefined {
  if (!val || val.trim() === '') return undefined
  try { return BigInt(val.replace(/[^0-9]/g, '')) } catch { return undefined }
}

function safeDate(val: string): Date | undefined {
  if (!val || val.trim() === '') return undefined
  const d = new Date(val)
  return isNaN(d.getTime()) ? undefined : d
}

async function runSeed() {
  console.log('🌱 Auto-seeding database...')

  // Push schema first
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: process.cwd(),
      timeout: 30000,
      encoding: 'utf-8',
    })
    console.log('  ✅ Schema pushed')
  } catch (e: any) {
    console.log(`  ⚠️ Schema push skipped: ${e.message?.slice(0, 100)}`)
  }

  // Check if already has data
  try {
    const count = await prisma.company.count()
    if (count > 0) {
      console.log(`  ✅ DB already has ${count} companies — skipping seed`)
      return
    }
  } catch {
    // Table might not exist yet, continue with seed
  }

  // ── Companies ──
  const companies = readCsv('companies.csv')
  const companyMap: Record<string, string> = {}
  for (const row of companies) {
    if (!row.name?.trim()) continue
    const c = await prisma.company.create({
      data: {
        name: row.name.trim(),
        legalName: row.legal_name || null,
        website: row.website || null,
        description: row.description || null,
        companyType: row.company_type || null,
        ownershipStatus: row.ownership_status || null,
        foundedYear: safeInt(row.founded_year),
        employeeCountRange: row.employee_count_range || null,
        annualRevenueRange: row.annual_revenue_range || null,
        headquartersCountry: row.headquarters_country || null,
        headquartersCity: row.headquarters_city || null,
        headquartersStateProvince: row.headquarters_state_province || null,
        stockTicker: row.stock_ticker || null,
        stockExchange: row.stock_exchange || null,
        tags: row.tags || null,
      },
    })
    companyMap[row.name.trim().toLowerCase()] = c.id
  }
  console.log(`  ✅ ${Object.keys(companyMap).length} companies`)

  // ── Contacts ──
  const contacts = readCsv('contacts.csv')
  let contactCount = 0
  for (const row of contacts) {
    const email = row.email?.trim()
    if (!row.first_name?.trim() && !email) continue
    const companyId = row.company ? companyMap[row.company.trim().toLowerCase()] : undefined
    try {
      await prisma.contact.upsert({
        where: { email: email || `noemail-${Date.now()}-${Math.random()}` },
        create: {
          firstName: row.first_name || null,
          lastName: row.last_name || null,
          email: email || null,
          phone: row.phone || null,
          linkedinUrl: row.linkedin_url || null,
          jobTitle: row.job_title || null,
          seniority: row.seniority || null,
          department: row.department || null,
          companyName: row.company || null,
          companyId: companyId || null,
          country: row.country || null,
          city: row.city || null,
          stateProvince: row.state_province || null,
          bio: row.bio || null,
          tags: row.tags || null,
        },
        update: {},
      })
      contactCount++
    } catch {}
  }
  console.log(`  ✅ ${contactCount} contacts`)

  // ── Deals ──
  const deals = readCsv('deals.csv')
  const dealMap: Record<string, string> = {}
  for (const row of deals) {
    if (!row.title?.trim()) continue
    const d = await prisma.deal.create({
      data: {
        title: row.title.trim(),
        dealType: row.deal_type || null,
        dealStage: row.deal_stage || null,
        dealValueUsd: safeBigInt(row.deal_value_usd) ?? null,
        announcedDate: safeDate(row.announced_date) ?? null,
        closedDate: safeDate(row.closed_date) ?? null,
        targetCompanyId: row.target_company ? companyMap[row.target_company.trim().toLowerCase()] : null,
        acquirerCompanyId: row.acquirer_company ? companyMap[row.acquirer_company.trim().toLowerCase()] : null,
        description: row.description || null,
        sourceUrl: row.source_url || null,
        tags: row.tags || null,
      },
    })
    dealMap[row.title.trim()] = d.id
  }
  console.log(`  ✅ ${Object.keys(dealMap).length} deals`)

  // ── Deal Investors ──
  const dealInvestors = readCsv('deal_investors.csv')
  for (const row of dealInvestors) {
    const dealId = dealMap[row.deal_title?.trim()]
    if (!dealId) continue
    await prisma.dealInvestor.create({
      data: {
        dealId,
        investorCompanyName: row.investor_company || null,
        investorCompanyId: row.investor_company ? companyMap[row.investor_company.trim().toLowerCase()] : null,
        investorRole: row.investor_role || null,
        investmentAmountUsd: safeBigInt(row.investment_amount_usd) ?? null,
      },
    })
  }

  // ── Company Verticals ──
  const verticals = readCsv('company_verticals.csv')
  for (const row of verticals) {
    const companyId = companyMap[row.company_name?.trim().toLowerCase()]
    if (!companyId || !row.vertical_slug) continue
    try {
      await prisma.companyVertical.upsert({
        where: { companyId_verticalSlug: { companyId, verticalSlug: row.vertical_slug } },
        create: { companyId, verticalSlug: row.vertical_slug, isPrimary: row.is_primary === 'true' },
        update: {},
      })
    } catch {}
  }

  // ── Therapeutic Areas ──
  const tas = readCsv('company_therapeutic_areas.csv')
  for (const row of tas) {
    const companyId = companyMap[row.company_name?.trim().toLowerCase()]
    if (!companyId || !row.therapeutic_area) continue
    try {
      await prisma.companyTherapeuticArea.upsert({
        where: { companyId_therapeuticArea: { companyId, therapeuticArea: row.therapeutic_area } },
        create: { companyId, therapeuticArea: row.therapeutic_area },
        update: {},
      })
    } catch {}
  }

  // ── Insights ──
  const insights = readCsv('insights.csv')
  for (const row of insights) {
    if (!row.title?.trim()) continue
    await prisma.insight.create({
      data: {
        title: row.title.trim(),
        contentType: row.content_type || null,
        summary: row.summary || null,
        body: row.body || null,
        author: row.author || null,
        publishedAt: safeDate(row.published_at) ?? null,
        isPremium: row.is_premium === 'true',
        tags: row.tags || null,
      },
    })
  }

  console.log('🎉 Auto-seed complete!')
}

/** Ensures the database is seeded. Safe to call from any API route — runs only once. */
export async function ensureSeeded() {
  if (seeded) return
  if (!seedPromise) {
    seedPromise = runSeed()
      .then(() => { seeded = true })
      .catch((err) => {
        console.error('Auto-seed failed:', err)
        seedPromise = null // allow retry on next request
      })
  }
  await seedPromise
}
