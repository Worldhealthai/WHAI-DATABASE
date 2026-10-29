// GET /api/enquiries?kind=sponsor|partner|speaker|delegate&id=… — the
// enquiries (and agenda requests) behind a CRM record, as the Nexus admin
// panel holds them in the same database: what was asked, when and on which
// site, and every reply the team sent from the admin panel's inbox.
// Found two ways, for every event and every year: the triage entry that
// made the record ("Move to CRM", staged_contacts.assignedId → its rawData
// id), and the record's email addresses (the person's, or each contact's
// for a company). Read only.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Row = Record<string, any>
const TABLE: Record<string, string> = { sponsor: 'sponsors', partner: 'partners', speaker: 'speakers', delegate: 'delegates' }
const esc = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export interface Enquiry {
  kind: 'enquiry' | 'agenda'
  id: string
  receivedAt: string
  type: string | null
  subject: string | null
  message: string | null
  event: string | null
  site: string | null
  from: { name: string | null; email: string | null; organisation: string | null }
  respondedAt: string | null
  teamNote: string | null
  // Agenda requests: when the agenda was sent.
  sentAt?: string | null
  status?: string | null
  replies: { id: string; subject: string; body: string; to: string; at: string; brand: string | null }[]
  // Moved into the CRM through "Move to CRM" (rather than found by email).
  linked: boolean
}

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') || ''
  const id = req.nextUrl.searchParams.get('id') || ''
  const table = TABLE[kind]
  if (!table || !id) return NextResponse.json({ error: 'kind and id are required' }, { status: 400 })
  try {
    const company = kind === 'sponsor' || kind === 'partner'
    // The record (and a company's contacts): their ids and emails.
    const { data: rec } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
    if (!rec) return NextResponse.json({ enquiries: [] })
    const kids: Row[] = company ? ((await supabase.from(table).select('id, "contactEmail"').eq('companyId', id)).data ?? []) : []
    const ids = [id, ...kids.map((k) => k.id)]
    const emails = Array.from(new Set(
      (company ? [rec.contactEmail, ...kids.map((k) => k.contactEmail)] : [rec.email])
        .map((e) => String(e || '').trim().toLowerCase()).filter(Boolean),
    ))

    // 1. The triage entries that made these records: the enquiry ids in them.
    const { data: staged } = await supabase.from('staged_contacts').select('rawData, notes').in('assignedId', ids)
    const linkedIds = new Set<string>()
    for (const s of staged ?? []) {
      try {
        const raw = JSON.parse(s.rawData || '{}')
        if (raw?.id) linkedIds.add(String(raw.id))
      } catch { /* not JSON: an import, no enquiry */ }
    }

    // 2. The enquiries: by those ids and by the emails.
    const pub = supabase.schema('public')
    const subs = new Map<string, Row>()
    const agenda = new Map<string, Row>()
    if (linkedIds.size) {
      const list = Array.from(linkedIds)
      for (const r of (await pub.from('contact_submissions').select('*').in('id', list)).data ?? []) subs.set(r.id, r)
      for (const r of (await pub.from('agenda_requests').select('*').in('id', list)).data ?? []) agenda.set(r.id, r)
    }
    for (const e of emails) {
      for (const r of (await pub.from('contact_submissions').select('*').ilike('email', esc(e)).limit(20)).data ?? []) subs.set(r.id, r)
      for (const r of (await pub.from('agenda_requests').select('*').ilike('email', esc(e)).limit(20)).data ?? []) agenda.set(r.id, r)
    }

    // 3. The replies sent from the admin panel (none before its 0056 log).
    const replies = new Map<string, Row[]>()
    if (subs.size) {
      const { data } = await pub.from('contact_replies').select('*').in('submission_id', Array.from(subs.keys())).order('created_at', { ascending: true })
      for (const r of data ?? []) replies.set(r.submission_id, [...(replies.get(r.submission_id) ?? []), r])
    }

    const enquiries: Enquiry[] = [
      ...Array.from(subs.values()).map((s) => ({
        kind: 'enquiry' as const,
        id: s.id,
        receivedAt: s.created_at,
        type: s.inquiry_type ?? null,
        subject: s.subject ?? null,
        message: s.message ?? null,
        event: s.event_label ?? null,
        site: s.source_site ?? s.event_series ?? null,
        from: { name: s.name ?? null, email: s.email ?? null, organisation: s.organisation ?? null },
        respondedAt: s.responded_at ?? null,
        teamNote: (s.admin_notes || '').trim() || null,
        replies: (replies.get(s.id) ?? []).map((r) => ({ id: r.id, subject: r.subject, body: r.body, to: r.to_email, at: r.created_at, brand: r.brand ?? null })),
        linked: linkedIds.has(s.id),
      })),
      ...Array.from(agenda.values()).map((a) => ({
        kind: 'agenda' as const,
        id: a.id,
        receivedAt: a.created_at,
        type: 'Agenda request',
        subject: null,
        message: null,
        event: a.event_label ?? null,
        site: a.source_site ?? a.event_series ?? null,
        from: { name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || null, email: a.email ?? null, organisation: a.company ?? null },
        respondedAt: a.sent_at ?? a.reviewed_at ?? null,
        teamNote: (a.admin_notes || '').trim() || null,
        sentAt: a.sent_at ?? null,
        status: a.status ?? null,
        replies: [],
        linked: linkedIds.has(a.id),
      })),
    ].sort((x, y) => String(y.receivedAt).localeCompare(String(x.receivedAt)))

    return NextResponse.json({ enquiries })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 })
  }
}
