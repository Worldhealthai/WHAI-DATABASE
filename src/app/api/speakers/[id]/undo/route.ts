// POST /api/speakers/:id/undo — take someone back out of the speaker
// pipeline (November 2026), for a speaker added by mistake. Only while they
// are still at Not Contacted, with nothing logged against them: past that,
// the record holds work and is deleted on purpose (the bin on their page).
// Someone who came from a leads list (tag "Lead list") goes back onto it,
// with their details and note, so they are where they were before; anyone
// else simply loses this speaker record (their other records stay).
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const { data: s, error } = await supabase.from('speakers').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!s) return NextResponse.json({ error: 'This speaker is no longer in the pipeline' }, { status: 404 })
    if (s.status !== 'Not Contacted') {
      return NextResponse.json({ error: `They have moved on to ${s.status}, so this is no longer an undo. Use delete on their page if they should go.` }, { status: 409 })
    }
    const { count } = await supabase.from('activities').select('id', { count: 'exact', head: true }).eq('speakerId', id)
    if (count) return NextResponse.json({ error: 'There is activity logged against them, so this is no longer an undo.' }, { status: 409 })

    const tags = String(s.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)
    let leadId: string | null = null
    if (tags.some((t: string) => t.toLowerCase() === 'lead list')) {
      const source = tags.find((t: string) => t.toLowerCase() !== 'lead list') ?? null
      const { data: lead, error: e } = await supabase.from('leads').insert({
        firstName: s.firstName, lastName: s.lastName, email: s.email, phone: s.phone, linkedinUrl: s.linkedinUrl,
        companyName: s.organization, jobTitle: s.jobTitle, country: s.country, city: s.city,
        segment: s.subType === 'Solution Provider' ? 'Solution Provider' : 'End User',
        source, notes: s.notes, event: s.event,
      }).select('id').single()
      if (e) throw e
      leadId = lead.id
    }
    const { error: d } = await supabase.from('speakers').delete().eq('id', id)
    if (d) {
      // Put things back as they were: the lead row would be a duplicate.
      if (leadId) await supabase.from('leads').delete().eq('id', leadId)
      throw d
    }
    return NextResponse.json({ ok: true, leadId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not undo it' }, { status: 500 })
  }
}
