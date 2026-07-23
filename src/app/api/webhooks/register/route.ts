import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { canonicalEventLabel } from '@/types'

export const dynamic = 'force-dynamic'

// Public registration webhook.
// Your website posts here whenever someone registers as a delegate or speaker.
//
// POST /api/webhooks/register
// Headers: x-webhook-secret: <WEBHOOK_SECRET env var>
// Body: {
//   "type": "delegate" | "speaker",
//   "firstName": "...", "lastName": "...", "email": "...",
//   "phone": "...", "organization": "...", "jobTitle": "...",
//   "country": "...", "city": "...",
//   "event": "World Health AI London 2026" | "World Health AI Boston 2025"
//            (legacy "UK Forum" / "US Forum" still accepted — normalised on arrival),
//   "subType": "End User" | "Solution Provider", "year": 2026,
//   "linkedinUrl": "...", "notes": "...",
//   // Optional control fields used by the website's admin actions:
//   "action": "delete",   // remove the matching contact (by email) from the CRM
//   "status": "Cancelled" | "Rejected"  // set status on the matching contact,
//                                        // creating it with that status if absent
// }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Health check — open this URL in a browser to verify the deployment is live
// and the env vars are configured. Reports presence only, never values.
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: 'POST /api/webhooks/register',
      secretConfigured: Boolean(process.env.WEBHOOK_SECRET?.trim()),
      supabaseConfigured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      ),
    },
    { headers: CORS_HEADERS },
  )
}

export async function POST(req: NextRequest) {
  try {
    // Auth: require the shared secret when one is configured.
    // Both sides are trimmed so a stray space/newline pasted into Vercel
    // can't cause a mismatch.
    const secret = process.env.WEBHOOK_SECRET?.trim()
    if (secret && req.headers.get('x-webhook-secret')?.trim() !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const body = await req.json()
    const type = body.type === 'speaker' ? 'speaker' : 'delegate'

    if (!body.email && !(body.firstName && body.lastName)) {
      return NextResponse.json(
        { error: 'email or firstName + lastName required' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    // Normalised for matching and storage — emails differing only in case
    // are the same mailbox.
    const email =
      typeof body.email === 'string' && body.email.trim() ? body.email.trim().toLowerCase() : null
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''

    // Event year (e.g. 2026) so the speaker lands under the right Year tab.
    // Only the speakers table has a year column; delegates don't use one.
    const year =
      Number.isInteger(body.year) ? body.year
      : (typeof body.year === 'string' && /^\d{4}$/.test(body.year.trim())) ? parseInt(body.year.trim(), 10)
      : null

    const common = {
      firstName: firstName || null,
      lastName: lastName || null,
      email,
      phone: body.phone ?? null,
      organization: body.organization ?? null,
      jobTitle: body.jobTitle ?? null,
      country: body.country ?? null,
      city: body.city ?? null,
      // Normalised so every writer (UK Forum, World Health AI 2026, …)
      // converges on the canonical label set; forum names use the sent year.
      event: canonicalEventLabel(body.event, year),
      subType: body.subType ?? null,
      linkedinUrl: body.linkedinUrl ?? null,
      notes: body.notes ?? null,
    }

    const table = type === 'speaker' ? 'speakers' : 'delegates'
    const record = type === 'speaker'
      ? { ...common, status: 'Not Contacted', tags: 'Website Registration', year }
      : { ...common, status: 'Registered', source: 'Website', tags: 'Website Registration' }

    // Literal-match helper for ilike: emails/names may contain the LIKE
    // wildcards _ and %.
    const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

    // ── action: "delete" ──────────────────────────────────────────────────
    // The website calls this when an admin permanently deletes a registration.
    // Remove the matching contact from this table by email.
    if (body.action === 'delete') {
      if (!email) {
        return NextResponse.json(
          { ok: true, deleted: 0, message: 'No email to match — nothing deleted.' },
          { status: 200, headers: CORS_HEADERS },
        )
      }
      const { data: removed, error: delErr } = await supabase
        .from(table)
        .delete()
        .ilike('email', escapeLike(email))
        .select('id')
      if (delErr) throw delErr
      return NextResponse.json(
        { ok: true, deleted: removed?.length ?? 0 },
        { status: 200, headers: CORS_HEADERS },
      )
    }

    // ── status override: cancel / reject ──────────────────────────────────
    // The website calls this when an admin cancels or rejects a registration.
    // Update the existing contact's status; if it was never synced (e.g. a
    // pending registration that gets rejected) create it with that status so
    // it still shows up in the matching Cancelled / Rejected section.
    const statusOverride =
      typeof body.status === 'string' && body.status.trim() ? body.status.trim() : null
    if (statusOverride) {
      if (email) {
        const { data: existing } = await supabase
          .from(table)
          .select('id')
          .ilike('email', escapeLike(email))
          .limit(1)
        if (existing?.length) {
          const { error: updErr } = await supabase
            .from(table)
            .update({ status: statusOverride })
            .eq('id', existing[0].id)
          if (updErr) throw updErr
          return NextResponse.json(
            { ok: true, updated: true, id: existing[0].id, status: statusOverride },
            { status: 200, headers: CORS_HEADERS },
          )
        }
      }
      const { data: createdRow, error: insErr } = await supabase
        .from(table)
        .insert({ ...record, status: statusOverride })
        .select('id')
        .single()
      if (insErr) throw insErr
      return NextResponse.json(
        { ok: true, created: true, id: createdRow.id, status: statusOverride },
        { status: 201, headers: CORS_HEADERS },
      )
    }

    // Skip if this email already exists in the table, case-insensitively —
    // imported contacts often have mixed-case emails (idempotent).
    if (email) {
      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .ilike('email', escapeLike(email))
        .limit(1)
      if (existing?.length) {
        return NextResponse.json(
          { ok: true, duplicate: true, id: existing[0].id, message: 'Already registered — skipped.' },
          { status: 200, headers: CORS_HEADERS },
        )
      }
    }

    // A contact with the same name but no email on file is almost always the
    // same person, imported before their email was known. Fill in the email
    // on the existing record instead of creating a second one.
    if (firstName && lastName) {
      const { data: sameName } = await supabase
        .from(table)
        .select('id, email')
        .ilike('firstName', escapeLike(firstName))
        .ilike('lastName', escapeLike(lastName))
        .limit(10)
      const emailless = sameName?.find((r: { id: string; email: string | null }) => !r.email?.trim())
      if (emailless) {
        if (email) {
          await supabase.from(table).update({ email }).eq('id', emailless.id)
        }
        return NextResponse.json(
          {
            ok: true,
            duplicate: true,
            id: emailless.id,
            message: 'Existing contact with the same name and no email — added the email instead of duplicating.',
          },
          { status: 200, headers: CORS_HEADERS },
        )
      }
    }

    const { data, error } = await supabase.from(table).insert(record).select('id').single()
    if (error) throw error

    return NextResponse.json({ ok: true, id: data.id }, { status: 201, headers: CORS_HEADERS })
  } catch (error: any) {
    if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
      return NextResponse.json(
        { ok: true, duplicate: true, message: 'Already registered — skipped.' },
        { status: 200, headers: CORS_HEADERS },
      )
    }
    console.error('Registration webhook error:', error)
    // Include a short detail so the calling site's logs show the root cause
    // (e.g. a missing column) instead of an opaque 500.
    const detail = (error?.message || String(error)).slice(0, 300)
    return NextResponse.json({ error: 'Internal server error', detail }, { status: 500, headers: CORS_HEADERS })
  }
}
