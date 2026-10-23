import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { searchFilter } from '@/lib/search'
import { assignStagedContact, isAssignAs } from '@/lib/stagedAssign'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const status = searchParams.get('status') ?? 'pending'
    const batch = searchParams.get('batch') ?? undefined
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '50'), 200)
    const query = searchParams.get('query') ?? undefined

    let q = supabase
      .from('staged_contacts')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .order('createdAt', { ascending: false })

    if (batch) q = q.eq('importBatch', batch)
    if (query) {
      q = q.or(
        searchFilter(query, ['firstName', 'lastName', 'email', 'organization', 'jobTitle'], ['organization'])
      )
    }

    const from = (page - 1) * pageSize
    const { data, count, error } = await q.range(from, from + pageSize - 1)
    if (error) throw error

    // Also return distinct batch names for the filter UI
    const { data: batches } = await supabase
      .from('staged_contacts')
      .select('importBatch')
      .eq('status', 'pending')
      .not('importBatch', 'is', null)
      .order('createdAt', { ascending: false })

    const batchNames = [...new Set((batches ?? []).map((b: any) => b.importBatch).filter(Boolean))]

    const total = count ?? 0
    return NextResponse.json({
      data: data ?? [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      batches: batchNames,
    })
  } catch (error) {
    console.error('Staged contacts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const batch = searchParams.get('batch') ?? undefined

    const { error } = batch
      ? await supabase.from('staged_contacts').delete().eq('importBatch', batch)
      : await supabase.from('staged_contacts').delete().in('status', ['pending', 'skipped'])

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Staged contacts DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { contacts, importBatch } = await req.json()

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })
    }

    const batch = importBatch ?? `Import ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`

    const rows = contacts.map((c: any) => ({
      firstName: c.firstName ?? null,
      lastName: c.lastName ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      linkedinUrl: c.linkedinUrl ?? null,
      organization: c.organization ?? null,
      jobTitle: c.jobTitle ?? null,
      country: c.country ?? null,
      city: c.city ?? null,
      bio: c.bio ?? null,
      tags: c.tags ?? null,
      notes: c.notes ?? null,
      status: 'pending',
      importBatch: batch,
      rawData: JSON.stringify(c._raw ?? {}),
    }))

    // A contact sent with `assignAs` (the Nexus inbox's "Move to CRM") is
    // staged and assigned in one go: as a delegate or speaker (production)
    // or a sponsor or partner (sales), under its enquiry's event. One
    // already waiting in triage under the same email is the one assigned,
    // rather than a second copy. The rest wait in triage as before.
    const assigned: { email: string | null; assignedAs: string; assignedId: string; event: string | null }[] = []
    const failed: { email: string | null; error: string }[] = []
    const toStage: typeof rows = []
    for (let i = 0; i < rows.length; i++) {
      const assignAs = contacts[i]?.assignAs
      if (!isAssignAs(assignAs)) { toStage.push(rows[i]); continue }
      const row = rows[i]
      let stagedId: string | null = null
      if (row.email) {
        const { data: waiting } = await supabase
          .from('staged_contacts')
          .select('id, email')
          .eq('status', 'pending')
          .ilike('email', String(row.email).trim().replace(/[\\%_]/g, (c: string) => `\\${c}`))
          .limit(1)
        if (waiting?.length) {
          stagedId = waiting[0].id
          // The newer enquiry's details (event, note) win.
          await supabase.from('staged_contacts').update({ rawData: row.rawData, notes: row.notes ?? undefined, tags: row.tags ?? undefined }).eq('id', stagedId)
        }
      }
      if (!stagedId) {
        const { data: made, error } = await supabase.from('staged_contacts').insert(row).select('id').single()
        if (error || !made) { failed.push({ email: row.email, error: error?.message || 'Could not stage' }); continue }
        stagedId = made.id
      }
      const result = await assignStagedContact(stagedId!, assignAs)
      if ('error' in result) failed.push({ email: row.email, error: result.error ?? 'Could not assign' })
      else assigned.push({ email: row.email, assignedAs: result.assignedAs, assignedId: result.assignedId, event: result.event })
    }

    // Insert in chunks of 100 to stay within Supabase limits
    const chunkSize = 100
    let inserted = 0
    for (let i = 0; i < toStage.length; i += chunkSize) {
      const chunk = toStage.slice(i, i + chunkSize)
      const { error } = await supabase.from('staged_contacts').insert(chunk)
      if (error) throw error
      inserted += chunk.length
    }

    return NextResponse.json({ inserted, batch, assigned, failed }, { status: 201 })
  } catch (error) {
    console.error('Staged contacts POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
