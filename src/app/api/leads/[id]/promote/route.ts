// POST /api/leads/:id/promote { to: 'speaker' | 'sponsor', event, year }
// A lead into a pipeline (November 2026): into Production as a speaker, or
// into Sales as their company's contact, both at Not Contacted in that
// edition. Into Sales, the person joins their company's sponsor record for
// the edition when it has one, else the company is added with them as its
// contact. Their note and source go with them (notes and tags), and they
// leave the leads list: the new record is them now.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { addToSales } from '@/lib/salesContact'

export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  const to = body?.to === 'speaker' || body?.to === 'sponsor' ? body.to : null
  const event = typeof body?.event === 'string' && body.event.trim() ? body.event.trim() : null
  if (!to || !event) return NextResponse.json({ error: 'Say where to (speaker or sponsor) and the event' }, { status: 400 })
  try {
    const { data: lead, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!lead) return NextResponse.json({ error: 'This lead is no longer on the list' }, { status: 404 })
    const email = lead.email ? String(lead.email).toLowerCase() : null
    const notes = lead.notes || null
    const tags = ['Lead list', lead.source].filter(Boolean).join(', ')
    let kind: 'speaker' | 'sponsor' = to
    let recordId: string

    if (to === 'speaker') {
      if (email) {
        const { data: had } = await supabase.from('speakers').select('id').ilike('email', esc(email)).eq('event', event).limit(1)
        if (had?.length) {
          await supabase.from('leads').delete().eq('id', id)
          return NextResponse.json({ ok: true, kind, id: had[0].id, existing: true })
        }
      }
      const { data, error: e } = await supabase.from('speakers').insert({
        firstName: lead.firstName, lastName: lead.lastName, email, phone: lead.phone, linkedinUrl: lead.linkedinUrl,
        organization: lead.companyName, jobTitle: lead.jobTitle, country: lead.country, city: lead.city,
        subType: lead.segment, event, year: Number(body?.year) || Number(String(event).match(/20\d{2}/)?.[0]) || null,
        status: 'Not Contacted', tags, notes,
      }).select('id').single()
      if (e) throw e
      recordId = data.id
    } else {
      kind = 'sponsor'
      const name = String(lead.companyName || '').trim()
      if (!name) return NextResponse.json({ error: 'This lead has no company to add to Sales' }, { status: 400 })
      const r = await addToSales({
        company: name, event, website: lead.website, country: lead.country, city: lead.city, tags, notes,
        person: { firstName: lead.firstName, lastName: lead.lastName, email, phone: lead.phone, jobTitle: lead.jobTitle, linkedinUrl: lead.linkedinUrl },
      })
      recordId = r.id
    }
    await supabase.from('leads').delete().eq('id', id)
    return NextResponse.json({ ok: true, kind, id: recordId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not move them' }, { status: 500 })
  }
}
