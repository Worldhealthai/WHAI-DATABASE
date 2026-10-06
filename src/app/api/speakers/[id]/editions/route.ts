// GET — every edition this speaker has a record for. The CRM keeps one row
// per speaker per edition (migration 011), so the rows of one person are
// matched on their email (case-insensitive), or on first and last name when
// the record has no email. Newest year first; the record asked for is
// included.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const { data: me, error } = await supabase.from('speakers').select('id, email, firstName, lastName').eq('id', id).single()
    if (error || !me) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const cols = 'id, event, year, status, sessionTitle, sessionType, contractStatus, adminLineup, createdAt'
    let q = supabase.from('speakers').select(cols)
    const email = typeof me.email === 'string' ? me.email.trim() : ''
    if (email) q = q.ilike('email', escapeLike(email))
    else if (me.firstName && me.lastName) q = q.ilike('firstName', escapeLike(me.firstName)).ilike('lastName', escapeLike(me.lastName)).is('email', null)
    else q = q.eq('id', id)

    const { data, error: listErr } = await q
    if (listErr) throw listErr
    const rows = (data ?? []).slice().sort((a: any, b: any) => (b.year ?? 0) - (a.year ?? 0) || String(b.event ?? '').localeCompare(String(a.event ?? '')))
    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('Speaker editions error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
