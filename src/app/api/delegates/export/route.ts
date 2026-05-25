import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []

    let query = supabase
      .from('delegates')
      .select('*')
      .order('createdAt', { ascending: false })

    if (ids.length) {
      query = query.in('id', ids)
    } else {
      // Apply any active filters passed from the UI
      const statuses = searchParams.getAll('statuses').filter(Boolean)
      const events = searchParams.getAll('events').filter(Boolean)
      const subTypes = searchParams.getAll('subTypes').filter(Boolean)
      const ticketTypes = searchParams.getAll('ticketTypes').filter(Boolean)
      const countries = searchParams.getAll('countries').filter(Boolean)
      if (statuses.length) query = query.in('status', statuses)
      if (events.length) query = query.in('event', events)
      if (subTypes.length) query = query.in('subType', subTypes)
      if (ticketTypes.length) query = query.in('ticketType', ticketTypes)
      if (countries.length) query = query.in('country', countries)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const HEADER = [
      'First Name', 'Last Name', 'Email', 'Phone', 'Organisation', 'Job Title',
      'Country', 'City', 'Status', 'Event', 'Type', 'Ticket Type', 'Source',
      'LinkedIn', 'Tags', 'Notes',
    ]

    const rows = (data ?? []).map((d: any) => [
      d.firstName ?? '', d.lastName ?? '', d.email ?? '', d.phone ?? '',
      d.organization ?? '', d.jobTitle ?? '', d.country ?? '', d.city ?? '',
      d.status ?? '', d.event ?? '', d.subType ?? '', d.ticketType ?? '',
      d.source ?? '', d.linkedinUrl ?? '', d.tags ?? '', d.notes ?? '',
    ])

    const csv = [HEADER, ...rows]
      .map((r) => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="delegates-export.csv"',
      },
    })
  } catch (error) {
    console.error('Delegates export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
