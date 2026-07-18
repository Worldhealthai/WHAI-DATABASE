import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { assignAs } = await req.json()

    if (!['delegate', 'speaker', 'sponsor'].includes(assignAs)) {
      return NextResponse.json({ error: 'Invalid assignAs value' }, { status: 400 })
    }

    // Fetch the staged contact
    const { data: contact, error: fetchError } = await supabase
      .from('staged_contacts')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !contact) {
      return NextResponse.json({ error: 'Staged contact not found' }, { status: 404 })
    }

    // Parse rawData to extract event and subType
    let event: string | null = null
    let subType: string | null = null
    try {
      const raw = JSON.parse(contact.rawData ?? '{}')
      const eventKey = Object.keys(raw).find((k) => ['primary event', 'event', 'event_label', 'event label'].includes(k.toLowerCase()))
      const typeKey = Object.keys(raw).find((k) => ['attendee type', 'type'].includes(k.toLowerCase()))
      if (eventKey) event = raw[eventKey] || null
      if (typeKey) {
        const at = (raw[typeKey] ?? '').toLowerCase()
        if (at.includes('end_user') || at.includes('end-user')) subType = 'End User'
        else if (at.includes('solution_provider') || at.includes('solution-provider')) subType = 'Solution Provider'
      }
    } catch { /* ignore malformed rawData */ }

    // Build the record for the target table
    const base = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      linkedinUrl: contact.linkedinUrl,
      organization: contact.organization,
      jobTitle: contact.jobTitle,
      country: contact.country,
      city: contact.city,
      bio: contact.bio,
      tags: contact.tags,
      notes: contact.notes,
    }

    let table: string
    let record: any

    if (assignAs === 'delegate') {
      table = 'delegates'
      record = { ...base, status: 'Registered', event, subType }
    } else if (assignAs === 'speaker') {
      table = 'speakers'
      record = { ...base, status: 'Not Contacted', event, subType, year: new Date().getFullYear() }
    } else {
      table = 'sponsors'
      record = {
        companyName: contact.organization ?? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim(),
        website: null,
        contactFirstName: contact.firstName,
        contactLastName: contact.lastName,
        contactEmail: contact.email,
        contactPhone: contact.phone,
        contactLinkedinUrl: contact.linkedinUrl,
        contactJobTitle: contact.jobTitle,
        country: contact.country,
        city: contact.city,
        tags: contact.tags,
        notes: contact.notes,
        status: 'Not Contacted',
      }
    }

    // Create the record in the target table
    const { data: created, error: insertError } = await supabase
      .from(table)
      .insert(record)
      .select()
      .single()

    if (insertError) throw insertError

    // Mark staged contact as assigned
    await supabase
      .from('staged_contacts')
      .update({ status: 'assigned', assignedAs: assignAs, assignedId: created.id })
      .eq('id', params.id)

    return NextResponse.json({ success: true, assignedAs, assignedId: created.id, record: created })
  } catch (error) {
    console.error('Assign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
