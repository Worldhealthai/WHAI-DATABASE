import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  companiesData,
  contactsData,
  dealsData,
  dealInvestorsData,
  companyVerticalsData,
  companyTherapeuticAreasData,
  insightsData,
} from '@/lib/seed-data'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function safeInt(val: string): number | null {
  if (!val || val.trim() === '') return null
  const n = parseInt(val.replace(/[^0-9]/g, ''))
  return isNaN(n) ? null : n
}

function safeDate(val: string): string | null {
  if (!val || val.trim() === '') return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export async function POST(req: NextRequest) {
  const logs: string[] = []
  const log = (msg: string) => { logs.push(msg); console.log(msg) }

  try {
    const { searchParams } = req.nextUrl
    const key = searchParams.get('key')
    if (key !== process.env.SEED_SECRET && key !== 'whai-seed-2024') {
      return NextResponse.json({ error: 'Unauthorized. Add ?key=whai-seed-2024 to the URL.' }, { status: 401 })
    }

    log('Seeding database...')

    // Clear existing data (respecting FK order)
    log('  Clearing existing data...')
    await supabase.from('deal_investors').delete().neq('id', '')
    await supabase.from('company_verticals').delete().neq('id', '')
    await supabase.from('company_therapeutic_areas').delete().neq('id', '')
    await supabase.from('deals').delete().neq('id', '')
    await supabase.from('contacts').delete().neq('id', '')
    await supabase.from('insights').delete().neq('id', '')
    await supabase.from('companies').delete().neq('id', '')
    log('  Cleared')

    // 1. Companies
    log('  Loading companies...')
    const companyMap: Record<string, string> = {}

    for (const row of companiesData) {
      if (!row.name?.trim()) continue
      const { data, error } = await supabase.from('companies').insert({
        name: row.name.trim(),
        legalName: row.legal_name || null,
        website: row.website || null,
        description: row.description || null,
        companyType: row.company_type || null,
        ownershipStatus: row.ownership_status || null,
        foundedYear: row.founded_year || null,
        employeeCountRange: row.employee_count_range || null,
        annualRevenueRange: row.annual_revenue_range || null,
        headquartersCountry: row.headquarters_country || null,
        headquartersCity: row.headquarters_city || null,
        headquartersStateProvince: row.headquarters_state_province || null,
        stockTicker: row.stock_ticker || null,
        stockExchange: row.stock_exchange || null,
        tags: row.tags || null,
      }).select('id').single()

      if (data) companyMap[row.name.trim().toLowerCase()] = data.id
      if (error) log(`  Warning: company ${row.name}: ${error.message}`)
    }
    log(`  ${Object.keys(companyMap).length} companies`)

    // 2. Contacts
    log('  Loading contacts...')
    let contactCount = 0

    for (const row of contactsData) {
      const email = row.email?.trim() || null
      if (!row.first_name?.trim() && !email) continue
      const companyId = row.company ? companyMap[row.company.trim().toLowerCase()] : null

      const { error } = await supabase.from('contacts').insert({
        firstName: row.first_name || null,
        lastName: row.last_name || null,
        email,
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
      })

      if (!error) contactCount++
      else log(`  Warning: contact ${row.first_name}: ${error.message}`)
    }
    log(`  ${contactCount} contacts`)

    // 3. Deals
    log('  Loading deals...')
    const dealMap: Record<string, string> = {}

    for (const row of dealsData) {
      if (!row.title?.trim()) continue
      const targetId = row.target_company ? companyMap[row.target_company.trim().toLowerCase()] : null
      const acquirerId = row.acquirer_company ? companyMap[row.acquirer_company.trim().toLowerCase()] : null

      const { data, error } = await supabase.from('deals').insert({
        title: row.title.trim(),
        dealType: row.deal_type || null,
        dealStage: row.deal_stage || null,
        dealValueUsd: safeInt(row.deal_value_usd),
        announcedDate: safeDate(row.announced_date),
        closedDate: safeDate(row.closed_date),
        targetCompanyId: targetId,
        acquirerCompanyId: acquirerId,
        description: row.description || null,
        tags: row.tags || null,
      }).select('id').single()

      if (data) dealMap[row.title.trim()] = data.id
      if (error) log(`  Warning: deal ${row.title}: ${error.message}`)
    }
    log(`  ${Object.keys(dealMap).length} deals`)

    // 4. Deal Investors
    log('  Loading deal investors...')
    let diCount = 0

    for (const row of dealInvestorsData) {
      const dealId = dealMap[row.deal_title?.trim()]
      if (!dealId) continue
      const investorId = row.investor_company ? companyMap[row.investor_company.trim().toLowerCase()] : null

      const { error } = await supabase.from('deal_investors').insert({
        dealId,
        investorCompanyName: row.investor_company || null,
        investorCompanyId: investorId,
        investorRole: row.investor_role || null,
        investmentAmountUsd: safeInt(row.investment_amount_usd),
      })

      if (!error) diCount++
    }
    log(`  ${diCount} deal investors`)

    // 5. Company Verticals
    log('  Loading company verticals...')
    let vCount = 0

    for (const row of companyVerticalsData) {
      const companyId = companyMap[row.company_name?.trim().toLowerCase()]
      if (!companyId || !row.vertical_slug) continue
      const { error } = await supabase.from('company_verticals').insert({
        companyId,
        verticalSlug: row.vertical_slug,
        isPrimary: row.is_primary,
      })
      if (!error) vCount++
    }
    log(`  ${vCount} company verticals`)

    // 6. Therapeutic Areas
    log('  Loading therapeutic areas...')
    let taCount = 0

    for (const row of companyTherapeuticAreasData) {
      const companyId = companyMap[row.company_name?.trim().toLowerCase()]
      if (!companyId || !row.therapeutic_area) continue
      const { error } = await supabase.from('company_therapeutic_areas').insert({
        companyId,
        therapeuticArea: row.therapeutic_area,
      })
      if (!error) taCount++
    }
    log(`  ${taCount} therapeutic areas`)

    // 7. Insights
    log('  Loading insights...')
    let insightCount = 0

    for (const row of insightsData) {
      if (!row.title?.trim()) continue
      const { error } = await supabase.from('insights').insert({
        title: row.title.trim(),
        contentType: row.content_type || null,
        summary: row.summary || null,
        body: row.body || null,
        author: row.author || null,
        publishedAt: safeDate(row.published_at),
        isPremium: row.is_premium,
        tags: row.tags || null,
      })
      if (!error) insightCount++
    }
    log(`  ${insightCount} insights`)

    log('Seed complete!')

    return NextResponse.json({
      success: true,
      summary: {
        companies: Object.keys(companyMap).length,
        contacts: contactCount,
        deals: Object.keys(dealMap).length,
        dealInvestors: diCount,
        verticals: vCount,
        therapeuticAreas: taCount,
        insights: insightCount,
      },
      logs,
    })
  } catch (error: any) {
    log(`Error: ${error.message}`)
    return NextResponse.json({ error: error.message, logs }, { status: 500 })
  }
}
