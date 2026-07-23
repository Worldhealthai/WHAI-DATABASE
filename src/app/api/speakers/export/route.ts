import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []

    let query = supabase
      .from('speakers')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(10000)

    if (ids.length) {
      query = query.in('id', ids)
    } else {
      // Apply any active filters passed from the UI
      const statuses = searchParams.getAll('statuses').filter(Boolean)
      const events = searchParams.getAll('events').filter(Boolean)
      const subTypes = searchParams.getAll('subTypes').filter(Boolean)
      const countries = searchParams.getAll('countries').filter(Boolean)
      const years = searchParams.getAll('years').filter(Boolean)
      if (statuses.length) query = query.in('status', statuses)
      if (events.length) query = query.in('event', events)
      if (subTypes.length) query = query.in('subType', subTypes)
      if (countries.length) query = query.in('country', countries)
      if (years.length) query = query.in('year', years.map(Number))
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const HEADER = [
      'First Name', 'Last Name', 'Email', 'Phone', 'Organisation', 'Job Title',
      'Country', 'City', 'Event', 'Year', 'Type', 'Status',
      'Session Title', 'Session Type', 'Fee Status',
      'LinkedIn', 'Bio', 'Tags', 'Notes',
    ]

    const rows = (data ?? []).map((s: any) => [
      s.firstName ?? '', s.lastName ?? '', s.email ?? '', s.phone ?? '',
      s.organization ?? '', s.jobTitle ?? '', s.country ?? '', s.city ?? '',
      s.event ?? '', s.year ? String(s.year) : '', s.subType ?? '', s.status ?? '',
      s.sessionTitle ?? '', s.sessionType ?? '', s.feeStatus ?? '',
      s.linkedinUrl ?? '', s.bio ?? '', s.tags ?? '', s.notes ?? '',
    ])

    const csv = [HEADER, ...rows]
      .map((r) => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="speakers-export.csv"',
      },
    })
  } catch (error) {
    console.error('Speakers export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
