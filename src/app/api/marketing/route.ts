// GET /api/marketing?kind=speaker|sponsor&events=World%20Health%20AI%20London%202026…
//
// Everything the Marketing portal needs for one edition, in one call: every
// speaker (with consent and welcome-post state) or every sponsor company
// (with the LinkedIn posts its package includes and how many are done). The
// list endpoints page at 100; an edition is read whole here.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PARTNER_TIERS = ['Media Partner', 'Association Partner']

const MIGRATION_HINT =
  'The marketing columns are missing — run supabase/migrations/005_marketing.sql in the Supabase SQL editor.'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const kind = searchParams.get('kind')
  const events = searchParams.getAll('events').filter(Boolean)
  if (kind !== 'speaker' && kind !== 'sponsor') {
    return NextResponse.json({ error: 'kind must be speaker or sponsor' }, { status: 400 })
  }
  if (events.length === 0) return NextResponse.json({ data: [] })

  try {
    if (kind === 'speaker') {
      const { data, error } = await supabase
        .from('speakers')
        .select('id, firstName, lastName, email, organization, jobTitle, headshotUrl, bio, linkedinUrl, status, event, year, linkedinConsent, postStatus, postUrl, postedAt, updatedAt')
        .in('event', events)
        .order('lastName', { ascending: true })
      if (error) throw error
      return NextResponse.json({ data: data ?? [] })
    }

    const andParts = PARTNER_TIERS.map((t) => `tier.neq.${JSON.stringify(t)}`).join(',')
    const { data, error } = await supabase
      .from('sponsors')
      .select('id, companyName, tier, status, event, contactFirstName, contactLastName, contactEmail, contactJobTitle, logoUrl, linkedinPostsDue, linkedinPostsDone, onboardedAt, notes, updatedAt')
      .is('companyId', null)
      .in('event', events)
      .or(`tier.is.null,and(${andParts})`)
      .order('companyName', { ascending: true })
    if (error) throw error
    return NextResponse.json({ data: data ?? [] })
  } catch (error: any) {
    const msg = String(error?.message || error)
    if (/linkedinConsent|postStatus|linkedinPostsDue|logoUrl|onboardedAt/.test(msg)) {
      return NextResponse.json({ error: MIGRATION_HINT, migration: true }, { status: 400 })
    }
    console.error('Marketing API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
