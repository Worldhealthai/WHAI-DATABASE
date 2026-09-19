// GET /api/workspace/stats?kind=sponsor&events=World%20Health%20AI%20London%202027…
//
// Counts by stage (and, for sponsors and partners, value by stage) for one
// edition of one event. The list endpoints cap at 100 rows for speakers and
// delegates, so a workspace overview counting a 400-delegate edition through
// them would be wrong; this asks the database for the small columns only.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PARTNER_TIERS = ['Media Partner', 'Association Partner']

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const kind = searchParams.get('kind') ?? ''
  const events = searchParams.getAll('events').filter(Boolean)
  const empty = { total: 0, byStatus: {} as Record<string, number>, value: { total: 0, byStatus: {} as Record<string, number>, currency: 'GBP' } }

  if (!['sponsor', 'partner', 'speaker', 'delegate'].includes(kind)) {
    return NextResponse.json({ error: 'kind must be sponsor, partner, speaker or delegate' }, { status: 400 })
  }
  if (events.length === 0) return NextResponse.json(empty)

  try {
    let rows: { status: string; valueAmount?: number | null; valueCurrency?: string | null }[] = []
    if (kind === 'sponsor' || kind === 'partner') {
      let q = supabase
        .from(kind === 'sponsor' ? 'sponsors' : 'partners')
        .select('status, valueAmount, valueCurrency')
        .is('companyId', null)
        .in('event', events)
      if (kind === 'sponsor') {
        const andParts = PARTNER_TIERS.map((t) => `tier.neq.${JSON.stringify(t)}`).join(',')
        q = q.or(`tier.is.null,and(${andParts})`)
      }
      const { data, error } = await q
      if (error) throw error
      rows = data ?? []
    } else {
      const { data, error } = await supabase
        .from(kind === 'speaker' ? 'speakers' : 'delegates')
        .select('status')
        .in('event', events)
      if (error) throw error
      rows = data ?? []
    }

    const byStatus: Record<string, number> = {}
    const valueByStatus: Record<string, number> = {}
    const currencies: Record<string, number> = {}
    let valueTotal = 0
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
      const v = Number(r.valueAmount ?? 0)
      if (v > 0) {
        valueByStatus[r.status] = (valueByStatus[r.status] ?? 0) + v
        valueTotal += v
        const c = r.valueCurrency || 'GBP'
        currencies[c] = (currencies[c] ?? 0) + 1
      }
    }
    // Values are summed as entered; the dominant currency is reported so the
    // UI can label the figure honestly.
    const currency = Object.entries(currencies).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'GBP'

    return NextResponse.json({
      total: rows.length,
      byStatus,
      value: { total: valueTotal, byStatus: valueByStatus, currency },
    })
  } catch (error) {
    console.error('workspace stats error:', error)
    return NextResponse.json(empty)
  }
}
