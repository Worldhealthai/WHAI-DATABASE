// POST /api/marketing/log-post  { kind: 'speaker' | 'sponsor', id, url?, note? }
//
// Records a LinkedIn post that has been made: it goes on the record's
// timeline as a "LinkedIn post" activity and updates the record — a speaker
// is marked Posted (with the link), a sponsor's posts-done count goes up.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const kind = body?.kind === 'speaker' ? 'speaker' : body?.kind === 'sponsor' ? 'sponsor' : null
    const id = String(body?.id || '').trim()
    if (!kind || !id) return NextResponse.json({ error: 'kind and id are required' }, { status: 400 })

    const url = String(body?.url || '').trim() || null
    const note = String(body?.note || '').trim() || null
    const now = new Date().toISOString()
    const table = kind === 'speaker' ? 'speakers' : 'sponsors'

    const { data: rec, error: readErr } = await supabase.from(table).select('*').eq('id', id).single()
    if (readErr || !rec) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

    const update: Record<string, unknown> =
      kind === 'speaker'
        ? { postStatus: 'Posted', postUrl: url ?? rec.postUrl ?? null, postedAt: now }
        : { linkedinPostsDone: Math.max(0, Number(rec.linkedinPostsDone ?? 0)) + 1 }
    const { data: saved, error: updErr } = await supabase.from(table).update(update).eq('id', id).select().single()
    if (updErr) throw updErr

    const content = [note, url].filter(Boolean).join('\n') || 'LinkedIn post published'
    const { error: actErr } = await supabase.from('activities').insert({
      entityType: kind,
      [kind === 'speaker' ? 'speakerId' : 'sponsorId']: id,
      type: 'linkedin_post',
      content,
      metadata: JSON.stringify({ url, kind: 'linkedin_post' }),
      createdBy: 'Marketing',
    })
    if (actErr) console.warn('log-post: activity not written:', actErr.message)

    return NextResponse.json({ ok: true, record: saved })
  } catch (error: any) {
    console.error('log-post error:', error)
    return NextResponse.json({ error: 'Internal server error', detail: String(error?.message || error).slice(0, 200) }, { status: 500 })
  }
}
