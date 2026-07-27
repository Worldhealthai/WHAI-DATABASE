// POST /api/duplicates/merge
// Body: { table: 'sponsors' | 'partners', keepId: string, mergeIds: string[] }
//
// Folds the duplicate company records into the one being kept — contacts,
// activities and any details the kept record was missing — then deletes them.

import { NextRequest, NextResponse } from 'next/server'
import { mergeCompanies, type MergeTable } from '@/lib/companyMerge'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { table, keepId, mergeIds } = await req.json()

    if (table !== 'sponsors' && table !== 'partners') {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
    }
    if (!keepId || typeof keepId !== 'string') {
      return NextResponse.json({ error: 'keepId is required' }, { status: 400 })
    }
    if (!Array.isArray(mergeIds) || !mergeIds.length) {
      return NextResponse.json({ error: 'mergeIds must be a non-empty array' }, { status: 400 })
    }

    const summary = await mergeCompanies(table as MergeTable, keepId, mergeIds)
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    console.error('Merge companies error:', error)
    const message = error instanceof Error ? error.message : 'Merge failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
