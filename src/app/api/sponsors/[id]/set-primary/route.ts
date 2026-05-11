import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/sponsors/[id]/set-primary
// body: { contactId: string }
// Promotes a linked contact to primary on the company record.
// The old primary (if any) is preserved as a new linked contact.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { contactId } = await req.json()
    if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })

    // Fetch the company record and the linked contact in parallel
    const [{ data: company, error: companyErr }, { data: contact, error: contactErr }] = await Promise.all([
      supabase.from('sponsors').select('*').eq('id', params.id).is('companyId', null).single(),
      supabase.from('sponsors').select('*').eq('id', contactId).eq('companyId', params.id).single(),
    ])

    if (companyErr || !company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    if (contactErr || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    // If company already has primary contact data, save it as a new linked contact first
    const hasOldPrimary = company.contactFirstName || company.contactLastName || company.contactEmail
    if (hasOldPrimary) {
      await supabase.from('sponsors').insert({
        companyId: params.id,
        companyName: company.companyName,
        contactFirstName: company.contactFirstName,
        contactLastName: company.contactLastName,
        contactEmail: company.contactEmail,
        contactPhone: company.contactPhone,
        contactJobTitle: company.contactJobTitle,
        contactLinkedinUrl: company.contactLinkedinUrl,
        notes: company.notes,
        status: company.status,
        event: company.event,
      })
    }

    // Promote the linked contact to primary on the company record
    const { error: patchErr } = await supabase
      .from('sponsors')
      .update({
        contactFirstName: contact.contactFirstName,
        contactLastName: contact.contactLastName,
        contactEmail: contact.contactEmail,
        contactPhone: contact.contactPhone,
        contactJobTitle: contact.contactJobTitle,
        contactLinkedinUrl: contact.contactLinkedinUrl,
      })
      .eq('id', params.id)

    if (patchErr) throw patchErr

    // Delete the promoted linked contact record
    const { error: deleteErr } = await supabase.from('sponsors').delete().eq('id', contactId)
    if (deleteErr) throw deleteErr

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Set primary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
