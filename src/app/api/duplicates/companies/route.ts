// GET /api/duplicates/companies?table=sponsors|partners
// Lists every set of company records that share a name, so they can be
// reviewed and merged from the UI.

import { NextRequest, NextResponse } from 'next/server'
import { findDuplicateCompanies, type MergeTable } from '@/lib/companyMerge'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const table = (req.nextUrl.searchParams.get('table') ?? 'sponsors') as MergeTable
    if (table !== 'sponsors' && table !== 'partners') {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
    }

    const groups = await findDuplicateCompanies(table)
    return NextResponse.json({
      groups,
      groupCount: groups.length,
      recordCount: groups.reduce((n, g) => n + g.records.length, 0),
    })
  } catch (error) {
    console.error('Duplicate companies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
