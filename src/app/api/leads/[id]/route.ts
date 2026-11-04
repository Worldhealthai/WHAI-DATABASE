// GET /api/leads/:id — one person from a leads list (crm.leads), for their
// page. PATCH edits their details. DELETE removes them from the list.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// The fields a person may edit on a contact's page.
const EDITABLE = ['firstName', 'lastName', 'jobTitle', 'companyName', 'email', 'email2', 'phone', 'linkedinUrl', 'city', 'country', 'website', 'notes', 'segment'] as const

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  const patch: Record<string, string | null> = {}
  for (const k of EDITABLE) {
    if (!(k in body)) continue
    const v = typeof body[k] === 'string' ? body[k].trim() : null
    patch[k] = v || null
  }
  if ('segment' in patch && patch.segment !== 'Solution Provider' && patch.segment !== 'End User') {
    return NextResponse.json({ error: 'Type must be Solution Provider or End User' }, { status: 400 })
  }
  for (const k of ['email', 'email2'] as const) {
    if (patch[k]) {
      patch[k] = patch[k]!.toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(patch[k]!)) return NextResponse.json({ error: `${patch[k]} is not an email address` }, { status: 400 })
    }
  }
  if (!patch.firstName && !patch.lastName && 'firstName' in patch && 'lastName' in patch && !patch.email) {
    return NextResponse.json({ error: 'Give a name or an email' }, { status: 400 })
  }
  const { data, error } = await supabase.from('leads').update({ ...patch, updatedAt: new Date().toISOString() }).eq('id', id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}
