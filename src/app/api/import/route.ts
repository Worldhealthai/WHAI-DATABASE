import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// CSV Import endpoint
// POST /api/import — accepts { rows: object[], columnMap: Record<string, string> }
// ─────────────────────────────────────────────────────────────────────────────

const SENIORITY_KEYWORDS: Record<string, string> = {
  'chief': 'C_SUITE',
  'ceo': 'C_SUITE',
  'cto': 'C_SUITE',
  'cmo': 'C_SUITE',
  'coo': 'C_SUITE',
  'cfo': 'C_SUITE',
  'president': 'C_SUITE',
  'founder': 'C_SUITE',
  'co-founder': 'C_SUITE',
  'board': 'BOARD',
  'trustee': 'BOARD',
  'vice president': 'VP',
  'vp': 'VP',
  'director': 'DIRECTOR',
  'head of': 'DIRECTOR',
  'manager': 'MANAGER',
  'lead': 'MANAGER',
  'senior': 'MANAGER',
}

const FUNCTION_KEYWORDS: Record<string, string[]> = {
  'CLINICAL': ['clinical', 'medical', 'physician', 'doctor', 'nursing', 'pharmacist', 'cmo', 'chief medical'],
  'RD': ['research', 'development', 'r&d', 'scientist', 'biology', 'chemistry', 'preclinical'],
  'DATA_SCIENCE': ['data science', 'machine learning', 'ai', 'analytics', 'data engineer', 'ml', 'artificial intelligence'],
  'IT': ['information technology', 'software', 'engineer', 'developer', 'architecture', 'infrastructure', 'cto', 'it '],
  'DIGITAL_HEALTH': ['digital health', 'innovation', 'digital transformation', 'cdio'],
  'REGULATORY': ['regulatory', 'compliance', 'quality', 'ra '],
  'COMMERCIAL': ['commercial', 'sales', 'account', 'business development', 'partnerships', 'bd '],
  'MARKETING': ['marketing', 'brand', 'communications', 'pr '],
  'STRATEGY': ['strategy', 'corporate development', 'planning', 'cso'],
  'OPERATIONS': ['operations', 'coo', 'supply chain', 'manufacturing', 'logistics'],
  'FINANCE': ['finance', 'cfo', 'accounting', 'treasury', 'investor relations', 'financial'],
}

function classifySeniority(title: string): string | null {
  const lower = title.toLowerCase()
  for (const [keyword, level] of Object.entries(SENIORITY_KEYWORDS)) {
    if (lower.includes(keyword)) return level
  }
  return null
}

function classifyFunction(title: string): string | null {
  const lower = title.toLowerCase()
  for (const [fn, keywords] of Object.entries(FUNCTION_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return fn
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rows, source = 'CSV Import' } = body as {
      rows: Record<string, string>[]
      source?: string
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 })
    }

    // Fetch job functions for matching
    const jobFunctions = await prisma.jobFunction.findMany()
    const jfMap = new Map(jobFunctions.map((jf) => [jf.slug, jf.id]))

    const stats = {
      total: rows.length,
      imported: 0,
      duplicates: 0,
      companiesCreated: 0,
      errors: 0,
    }

    // Company cache to avoid duplicates within batch
    const companyCache = new Map<string, string>()

    for (const row of rows) {
      try {
        const firstName = row.first_name?.trim() || row.firstName?.trim() || ''
        const lastName = row.last_name?.trim() || row.lastName?.trim() || ''
        const email = row.email?.trim().toLowerCase() || null
        const jobTitle = row.job_title?.trim() || row.title?.trim() || row.jobTitle?.trim() || ''
        const companyName = row.company?.trim() || row.company_name?.trim() || row.companyName?.trim() || ''

        if (!firstName && !lastName) { stats.errors++; continue }

        // Deduplicate: try email first, then name + company
        if (email) {
          const existing = await prisma.contact.findUnique({ where: { email } })
          if (existing) { stats.duplicates++; continue }
        } else {
          const existing = await prisma.contact.findFirst({
            where: {
              first_name: { equals: firstName, mode: 'insensitive' },
              last_name: { equals: lastName, mode: 'insensitive' },
              company: { name: { equals: companyName, mode: 'insensitive' } },
            },
          })
          if (existing) { stats.duplicates++; continue }
        }

        // Find or create company
        let companyId: string | undefined
        if (companyName) {
          if (companyCache.has(companyName.toLowerCase())) {
            companyId = companyCache.get(companyName.toLowerCase())
          } else {
            const existingCompany = await prisma.company.findFirst({
              where: { name: { equals: companyName, mode: 'insensitive' } },
            })
            if (existingCompany) {
              companyId = existingCompany.id
            } else {
              const newCompany = await prisma.company.create({
                data: {
                  name: companyName,
                  company_type: 'SOLUTION_PROVIDER', // default, can be enriched later
                  source: source,
                  tags: [],
                },
              })
              companyId = newCompany.id
              stats.companiesCreated++
            }
            companyCache.set(companyName.toLowerCase(), companyId!)
          }
        }

        // Auto-classify seniority + function
        const seniorityRaw = classifySeniority(jobTitle)
        const fnKey = classifyFunction(jobTitle)

        let jobFunctionId: string | undefined
        if (fnKey) {
          const slug = fnKey.toLowerCase().replace(/_/g, '-')
          // Try to find matching function
          for (const [jfSlug, jfId] of Array.from(jfMap.entries())) {
            if (jfSlug.includes(slug.split('-')[0])) {
              jobFunctionId = jfId
              break
            }
          }
        }

        await prisma.contact.create({
          data: {
            first_name: firstName,
            last_name: lastName,
            email: email || undefined,
            phone: row.phone?.trim() || undefined,
            linkedin_url: row.linkedin_url?.trim() || row.linkedin?.trim() || undefined,
            job_title: jobTitle,
            job_function_id: jobFunctionId,
            seniority_level: seniorityRaw as any || undefined,
            company_id: companyId,
            country: row.country?.trim() || undefined,
            city: row.city?.trim() || undefined,
            source: source,
            tags: [],
            is_verified: false,
            engagement_score: 0,
          },
        })
        stats.imported++
      } catch (err) {
        console.error('Row import error:', err)
        stats.errors++
      }
    }

    return NextResponse.json({ success: true, stats })
  } catch (error) {
    console.error('Import API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
