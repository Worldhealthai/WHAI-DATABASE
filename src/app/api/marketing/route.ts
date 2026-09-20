// GET /api/marketing?kind=speaker|sponsor&series=World%20Health%20AI&city=London&year=2026&label=World%20Health%20AI%20London%202026
//
// The Marketing portal's list for one edition: the admin panel's line-up
// (speakers from the event's Speakers section; sponsors from onboarding
// forms and manual additions) with this CRM's post tracking laid over it.
import { NextRequest, NextResponse } from 'next/server'
import { LineupError, TRACKING_HINT, fetchLineup, isMissingTrackingTable, readTracking, type Tracking } from '@/lib/marketingSource'

export const dynamic = 'force-dynamic'

const blank = (kind: 'speaker' | 'sponsor', ref: string, edition: string): Tracking => ({
  id: '', kind, ref, edition, postStatus: null, postUrl: null, postedAt: null, postsDue: null, postsDone: 0, log: [], notes: null, updatedAt: '',
})

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const kind = p.get('kind')
  const series = (p.get('series') || '').trim()
  const city = (p.get('city') || '').trim()
  const year = (p.get('year') || '').trim()
  const label = (p.get('label') || `${series} ${city} ${year}`).trim()
  if (kind !== 'speaker' && kind !== 'sponsor') return NextResponse.json({ error: 'kind must be speaker or sponsor' }, { status: 400 })
  if (!series || !year) return NextResponse.json({ error: 'series and year are required' }, { status: 400 })

  try {
    const [lineup, tracking] = await Promise.all([fetchLineup({ series, city, year, label }), readTracking(kind, label)])
    if (kind === 'speaker') {
      const data = lineup.speakers.map((s) => ({ ...s, tracking: tracking.get(s.id) ?? blank('speaker', s.id, label) }))
      return NextResponse.json({ event: lineup.event, edition: label, data })
    }
    const data = lineup.sponsors.map((s) => ({ ...s, tracking: tracking.get(s.id) ?? blank('sponsor', s.id, label) }))
    return NextResponse.json({ event: lineup.event, edition: label, data })
  } catch (error: any) {
    if (error instanceof LineupError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (isMissingTrackingTable(error)) return NextResponse.json({ error: TRACKING_HINT, migration: true }, { status: 400 })
    console.error('Marketing API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
