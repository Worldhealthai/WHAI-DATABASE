import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

export async function POST(req: NextRequest) {
  const logs: string[] = []
  const log = (msg: string) => { logs.push(msg); console.log(msg) }

  try {
    // Simple auth check — use a secret or remove after seeding
    const { searchParams } = req.nextUrl
    const key = searchParams.get('key')
    if (key !== process.env.SEED_SECRET && key !== 'whai-seed-2024') {
      return NextResponse.json({ error: 'Unauthorized. Add ?key=whai-seed-2024 to the URL.' }, { status: 401 })
    }

    log('🌱 Seeding database...')

    // Push schema to database first
    log('  Pushing schema to database...')
    try {
      const output = execSync('npx prisma db push --skip-generate --accept-data-loss', {
        cwd: process.cwd(),
        timeout: 30000,
        encoding: 'utf-8',
      })
      log('  ✅ Schema pushed successfully')
    } catch (e: any) {
      log(`  ⚠️ Schema push warning: ${e.message?.slice(0, 200)}`)
      // Continue anyway — schema might already be up to date
    }

    // Check if already seeded
    const existingCompanies = await prisma.company.count()
    if (existingCompanies > 0) {
      // Clear existing data in correct order (respecting FK constraints)
      log('  Clearing existing data...')
      await prisma.dealInvestor.deleteMany()
      await prisma.companyVertical.deleteMany()
      await prisma.companyTherapeuticArea.deleteMany()
      await prisma.deal.deleteMany()
      await prisma.contact.deleteMany()
      await prisma.company.deleteMany()
      await prisma.insight.deleteMany()
      log('  ✅ Cleared existing data')
    }

    // ── 1. Companies ──────────────────────────────
    log('  Loading companies...')
    const companies = readCsv('companies.csv')
    const companyMap: Record<string, string> = {}

    for (const row of companies) {
      if (!row.name?.trim()) continue
      const company = await prisma.company.create({
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
      companyMap[row.name.trim().toLowerCase()] = company.id
    }
    log(`  ✅ ${Object.keys(companyMap).length} companies`)

    // ── 2. Contacts ───────────────────────────────
    log('  Loading contacts...')
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
      } catch (e) {
        log(`  ⚠️ Skipped contact: ${row.first_name} ${row.last_name} - ${e}`)
      }
    }
    log(`  ✅ ${contactCount} contacts`)

    // ── 3. Deals ──────────────────────────────────
    log('  Loading deals...')
    const deals = readCsv('deals.csv')
    const dealMap: Record<string, string> = {}

    for (const row of deals) {
      if (!row.title?.trim()) continue
      const targetId = row.target_company ? companyMap[row.target_company.trim().toLowerCase()] : undefined
      const acquirerId = row.acquirer_company ? companyMap[row.acquirer_company.trim().toLowerCase()] : undefined

      const deal = await prisma.deal.create({
        data: {
          title: row.title.trim(),
          dealType: row.deal_type || null,
          dealStage: row.deal_stage || null,
          dealValueUsd: safeBigInt(row.deal_value_usd) ?? null,
          announcedDate: safeDate(row.announced_date) ?? null,
          closedDate: safeDate(row.closed_date) ?? null,
          targetCompanyId: targetId || null,
          acquirerCompanyId: acquirerId || null,
          description: row.description || null,
          sourceUrl: row.source_url || null,
          tags: row.tags || null,
        },
      })
      dealMap[row.title.trim()] = deal.id
    }
    log(`  ✅ ${Object.keys(dealMap).length} deals`)

    // ── 4. Deal Investors ─────────────────────────
    log('  Loading deal investors...')
    const dealInvestors = readCsv('deal_investors.csv')
    let diCount = 0

    for (const row of dealInvestors) {
      const dealId = dealMap[row.deal_title?.trim()]
      if (!dealId) continue
      const investorId = row.investor_company ? companyMap[row.investor_company.trim().toLowerCase()] : undefined

      await prisma.dealInvestor.create({
        data: {
          dealId,
          investorCompanyName: row.investor_company || null,
          investorCompanyId: investorId || null,
          investorRole: row.investor_role || null,
          investmentAmountUsd: safeBigInt(row.investment_amount_usd) ?? null,
        },
      })
      diCount++
    }
    log(`  ✅ ${diCount} deal investors`)

    // ── 5. Company Verticals ──────────────────────
    log('  Loading company verticals...')
    const verticals = readCsv('company_verticals.csv')
    let vCount = 0

    for (const row of verticals) {
      const companyId = companyMap[row.company_name?.trim().toLowerCase()]
      if (!companyId || !row.vertical_slug) continue
      try {
        await prisma.companyVertical.upsert({
          where: { companyId_verticalSlug: { companyId, verticalSlug: row.vertical_slug } },
          create: { companyId, verticalSlug: row.vertical_slug, isPrimary: row.is_primary === 'true' },
          update: {},
        })
        vCount++
      } catch {}
    }
    log(`  ✅ ${vCount} company verticals`)

    // ── 6. Therapeutic Areas ──────────────────────
    log('  Loading therapeutic areas...')
    const tas = readCsv('company_therapeutic_areas.csv')
    let taCount = 0

    for (const row of tas) {
      const companyId = companyMap[row.company_name?.trim().toLowerCase()]
      if (!companyId || !row.therapeutic_area) continue
      try {
        await prisma.companyTherapeuticArea.upsert({
          where: { companyId_therapeuticArea: { companyId, therapeuticArea: row.therapeutic_area } },
          create: { companyId, therapeuticArea: row.therapeutic_area },
          update: {},
        })
        taCount++
      } catch {}
    }
    log(`  ✅ ${taCount} therapeutic areas`)

    // ── 7. Insights ───────────────────────────────
    log('  Loading insights...')
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
    log(`  ✅ ${insights.length} insights`)

    log('\n🎉 Seed complete!')

    return NextResponse.json({
      success: true,
      summary: {
        companies: Object.keys(companyMap).length,
        contacts: contactCount,
        deals: Object.keys(dealMap).length,
        dealInvestors: diCount,
        verticals: vCount,
        therapeuticAreas: taCount,
        insights: insights.length,
      },
      logs,
    })
  } catch (error: any) {
    log(`❌ Error: ${error.message}`)
    return NextResponse.json({ error: error.message, logs }, { status: 500 })
  }
}
