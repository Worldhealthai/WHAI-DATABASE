import { NextRequest, NextResponse } from 'next/server'
import { checkDatabase, supabase } from '@/lib/supabase'
import { canonicalEventLabel } from '@/types'
import { companySimilarity } from '@/lib/companyMatch'

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
//   // Marketing (speakers): consent to a LinkedIn welcome post, and the
//   // headshot and bio the post needs
//   "linkedinConsent": true | false | null, "headshotUrl": "...", "bio": "...",
//   "lineup": true   // an approved speaker in the admin panel: confirmed, on the line-up
//   // Consent (delegates and speakers): agreed to share their name, job title
//   // and organisation with the event's sponsors and partners. Only a
//   // true/false answer is stored; null (the form never asked, e.g.
//   // worldhealth.ai) or leaving it out keeps whatever is already stored.
//   // On a contact already in the CRM, true is stored only when "event" is
//   // the edition the contact is filed under; false always is.
//   "partnerConsent": true | false | null,
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
// `database` says which project (host only) and schema the CRM reads, and
// whether every CRM table answers, so whoever switches the CRM to the Nexus
// project can check it landed there (README, "Check the switch"). The
// switch itself is confirmed by hand on the Nexus admin's Move CRM page.
export async function GET() {
  const database = await checkDatabase()
  return NextResponse.json(
    {
      ok: true,
      endpoint: 'POST /api/webhooks/register',
      secretConfigured: Boolean(process.env.WEBHOOK_SECRET?.trim()),
      // With CRM_DB_SCHEMA=crm the anon key does not count: only the
      // service role key is ever used there.
      supabaseConfigured: database.configured,
      database,
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

    // Marketing fields, speakers only: sent by the sites on approval. Only
    // what was actually provided is written, so a later sync without them
    // never blanks a value already stored.
    const marketing: Record<string, unknown> = {}
    const lineup = type === 'speaker' && body.lineup === true
    if (type === 'speaker') {
      if (typeof body.linkedinConsent === 'boolean') marketing.linkedinConsent = body.linkedinConsent
      if (typeof body.headshotUrl === 'string' && body.headshotUrl.trim()) marketing.headshotUrl = body.headshotUrl.trim()
      if (typeof body.bio === 'string' && body.bio.trim()) marketing.bio = body.bio.trim()
      // The admin panel approved them: they are speaking, whatever stage the
      // outreach here had reached.
      if (lineup) { marketing.adminLineup = true; marketing.status = 'Speaking Confirmed' }
    }

    // Consent to share name, job title and organisation with the event's
    // sponsors and partners, delegates and speakers alike. Written only when
    // the site sent a real answer, so a later sync without it never blanks it.
    const consent: Record<string, unknown> =
      typeof body.partnerConsent === 'boolean' ? { partnerConsent: body.partnerConsent } : {}
    // The answer is given for one edition, but the CRM keeps one row per
    // contact, filed under the edition in its `event`. On an existing row a
    // "yes" is taken only when it is for that same edition, so a later
    // edition's "yes" never shows against an earlier one the person declined.
    // A "no" is always taken: a refusal must never be lost.
    const consentFor = (rowEvent: unknown): Record<string, unknown> => {
      if (consent.partnerConsent === false) return consent
      const sameEdition =
        typeof rowEvent === 'string' && common.event !== null &&
        rowEvent.trim().toLowerCase() === common.event.toLowerCase()
      return sameEdition ? consent : {}
    }

    const table = type === 'speaker' ? 'speakers' : 'delegates'
    const record = type === 'speaker'
      ? { ...common, status: 'Not Contacted', tags: lineup ? 'Admin panel' : 'Website Registration', year, ...marketing, ...consent }
      : { ...common, status: 'Registered', source: 'Website', tags: 'Website Registration', ...consent }

    // Before migration 005 the marketing columns do not exist, and before 009
    // the partnerConsent column: retry a write without whichever is missing
    // rather than losing the contact.
    const isMissingMarketingColumn = (err: { message?: string } | null) =>
      Boolean(err?.message && /linkedinConsent|headshotUrl|postStatus|adminLineup/.test(err.message))
    const isMissingConsentColumn = (err: { message?: string } | null) =>
      Boolean(err?.message && /partnerConsent/.test(err.message))
    const stripMarketing = (r: Record<string, unknown>) => {
      const { linkedinConsent: _c, headshotUrl: _h, bio: _b, adminLineup: _l, ...rest } = r
      return rest
    }
    const stripConsent = (r: Record<string, unknown>) => {
      const { partnerConsent: _p, ...rest } = r
      return rest
    }
    const writeWithFallback = async <T>(
      row: Record<string, unknown>,
      write: (r: Record<string, unknown>) => PromiseLike<{ data: T | null; error: { message?: string } | null }>,
    ): Promise<{ data: T | null; error: { message?: string } | null }> => {
      let r = row
      let res = await write(r)
      // One retry per group of missing columns at most.
      for (let i = 0; i < 2 && res.error; i++) {
        const next =
          isMissingConsentColumn(res.error) && 'partnerConsent' in r ? stripConsent(r)
          : isMissingMarketingColumn(res.error) ? stripMarketing(r)
          : null
        if (!next) break
        // Nothing left to write once the missing columns are dropped.
        if (!Object.keys(next).length) return { data: null, error: null }
        r = next
        res = await write(r)
      }
      return res
    }

    // Literal-match helper for ilike: emails/names may contain the LIKE
    // wildcards _ and %.
    const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

    // The CRM keeps one row per contact PER EDITION (migration 011): the
    // same person at London 2026 and London 2027 is two rows. So a match
    // is on the email and the edition sent; a call that names no edition
    // falls back to the email alone, as before.
    const byEmailAndEdition = () => {
      let sel = supabase.from(table).select('id, event').ilike('email', escapeLike(email!))
      if (common.event) sel = sel.ilike('event', escapeLike(common.event))
      return sel
    }

    // The same person under another email: the same first and last name in
    // this edition, at the same company (a prospect imported with one
    // address who registers with another). Their record is the one used.
    const org = typeof body.organization === 'string' ? body.organization.trim() : ''
    const sameNameAtCompany = async (): Promise<{ id: string; email: string | null; event: string | null; notes: string | null } | null> => {
      if (!firstName || !lastName || !org) return null
      let q = supabase.from(table).select('id, email, event, organization, notes').ilike('firstName', escapeLike(firstName)).ilike('lastName', escapeLike(lastName))
      if (common.event) q = q.ilike('event', escapeLike(common.event))
      const { data } = await q.limit(10)
      const hit = (data ?? []).find((r: { organization: string | null }) => r.organization && companySimilarity(org, r.organization) >= 0.9)
      return (hit as { id: string; email: string | null; event: string | null; notes: string | null }) ?? null
    }
    // Keep the address they registered with on the record they already had.
    const noteOtherEmail = (row: { email: string | null; notes: string | null }) =>
      email && row.email && row.email.toLowerCase() !== email && !(row.notes || '').includes(email)
        ? { notes: [row.notes, `Also registered as ${email}.`].filter(Boolean).join('\n') }
        : {}

    // ── action: "submitted" ───────────────────────────────────────────────
    // Someone registered on a website and waits for review in the admin
    // panel. Nothing is created (that happens on approval); the registration
    // is logged on the timeline of whoever already has that email here, in
    // any section, and on their company if it is a sponsor or partner, so
    // the team sees a prospect has come in by themselves. `note` is the line
    // to log; `registrationId` stops a repeat being logged twice.
    if (body.action === 'submitted') {
      const note = String(body.note || '').trim().slice(0, 600)
      const regId = String(body.registrationId || '').trim()
      if (!note) return NextResponse.json({ error: 'note is required' }, { status: 400, headers: CORS_HEADERS })
      const fk: Record<string, string> = { delegate: 'delegateId', speaker: 'speakerId', sponsor: 'sponsorId', partner: 'partnerId' }
      const targets: { kind: string; id: string }[] = []
      if (email) {
        for (const [kind, table] of [['delegate', 'delegates'], ['speaker', 'speakers']] as const) {
          const { data } = await supabase.from(table).select('id').ilike('email', escapeLike(email)).limit(20)
          for (const r of data ?? []) targets.push({ kind, id: r.id })
        }
        for (const [kind, table] of [['sponsor', 'sponsors'], ['partner', 'partners']] as const) {
          const { data } = await supabase.from(table).select('id, "companyId"').ilike('contactEmail', escapeLike(email)).limit(20)
          for (const r of (data ?? []) as { id: string; companyId: string | null }[]) targets.push({ kind, id: r.companyId || r.id })
        }
      }
      // Their company, by name, in the same event.
      const org = String(body.organization || '').trim()
      if (org && common.event) {
        for (const [kind, table] of [['sponsor', 'sponsors'], ['partner', 'partners']] as const) {
          const { data } = await supabase.from(table).select('id, "companyName"').is('companyId', null).eq('event', common.event)
          for (const r of (data ?? []) as { id: string; companyName: string | null }[]) {
            if (r.companyName && companySimilarity(org, r.companyName) >= 0.9) targets.push({ kind, id: r.id })
          }
        }
      }
      const seen = new Set<string>()
      let logged = 0
      for (const t of targets) {
        const key = `${t.kind}:${t.id}`
        if (seen.has(key)) continue
        seen.add(key)
        if (regId) {
          const { data: dup } = await supabase.from('activities').select('id').eq(fk[t.kind], t.id).eq('type', 'registration').ilike('metadata', `%${regId}%`).limit(1)
          if (dup?.length) continue
        }
        const { error: actErr } = await supabase.from('activities').insert({
          entityType: t.kind, [fk[t.kind]]: t.id, type: 'registration', content: note,
          metadata: JSON.stringify({ registrationId: regId || null, email }), createdBy: 'Website registration',
        })
        if (!actErr) logged++
      }
      return NextResponse.json({ ok: true, matched: seen.size, logged }, { status: 200, headers: CORS_HEADERS })
    }

    // ── action: "update" ──────────────────────────────────────────────────
    // The admin panel corrected a booking (a name, company, email…): the
    // same correction on the contact's CRM record. `match` names the record
    // as it was ({ type, email, event }, before the edit); only the fields
    // sent are written, and nothing is created. A rejected solution provider
    // filed as a sponsor lead (sponsor webhook, "Rejected delegate booking")
    // is corrected there too.
    if (body.action === 'update') {
      const match = (body.match ?? {}) as { type?: string; email?: string; event?: string }
      const matchEmail = String(match.email || '').trim().toLowerCase() || email
      const matchEvent = (match.event ? canonicalEventLabel(match.event, year) : null) ?? common.event
      if (!matchEmail) {
        return NextResponse.json({ ok: true, updated: 0, message: 'No email to match.' }, { status: 200, headers: CORS_HEADERS })
      }
      const matchTable = match.type === 'speaker' ? 'speakers' : match.type === 'delegate' ? 'delegates' : table
      const fields: Record<string, unknown> = {}
      if (firstName) fields.firstName = firstName
      if (lastName) fields.lastName = lastName
      if (email) fields.email = email
      for (const k of ['phone', 'organization', 'jobTitle', 'subType'] as const) {
        if (body[k] !== undefined) fields[k] = body[k] || null
      }
      let updated = 0
      let sel = supabase.from(matchTable).select('id').ilike('email', escapeLike(matchEmail))
      if (matchEvent) sel = sel.ilike('event', escapeLike(matchEvent))
      const { data: found, error: findErr } = await sel.limit(5)
      if (findErr) throw findErr
      for (const row of found ?? []) {
        const { error: updErr } = await supabase.from(matchTable).update(fields).eq('id', row.id)
        if (updErr) throw updErr
        updated++
      }
      // The sponsor lead made from a rejected booking, if there is one.
      let leadSel = supabase
        .from('sponsors')
        .select('id, companyId')
        .ilike('contactEmail', escapeLike(matchEmail))
        .ilike('tags', '%Rejected delegate booking%')
      if (matchEvent) leadSel = leadSel.ilike('event', escapeLike(matchEvent))
      const { data: leads } = await leadSel.limit(5)
      for (const lead of leads ?? []) {
        const leadFields: Record<string, unknown> = {}
        if (firstName) leadFields.contactFirstName = firstName
        if (lastName) leadFields.contactLastName = lastName
        if (email) leadFields.contactEmail = email
        if (body.phone !== undefined) leadFields.contactPhone = body.phone || null
        if (body.jobTitle !== undefined) leadFields.contactJobTitle = body.jobTitle || null
        if (!lead.companyId && body.organization) leadFields.companyName = String(body.organization)
        const { error: leadErr } = await supabase.from('sponsors').update(leadFields).eq('id', lead.id)
        if (leadErr) throw leadErr
        updated++
      }
      return NextResponse.json({ ok: true, updated }, { status: 200, headers: CORS_HEADERS })
    }

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
      let del = supabase.from(table).delete().ilike('email', escapeLike(email))
      if (common.event) del = del.ilike('event', escapeLike(common.event))
      const { data: removed, error: delErr } = await del.select('id')
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
        const { data: existing } = await byEmailAndEdition().limit(1)
        if (existing?.length) {
          const { error: updErr } = await writeWithFallback(
            {
              ...(type === 'speaker' && /cancel|reject/i.test(statusOverride) ? { status: statusOverride, adminLineup: false } : { status: statusOverride }),
              ...consentFor(existing[0].event),
            },
            (r) => supabase.from(table).update(r).eq('id', existing[0].id),
          )
          if (updErr) throw updErr
          return NextResponse.json(
            { ok: true, updated: true, id: existing[0].id, status: statusOverride },
            { status: 200, headers: CORS_HEADERS },
          )
        }
      }
      const twin = await sameNameAtCompany()
      if (twin) {
        const { error: twinErr } = await writeWithFallback(
          { ...(type === 'speaker' && /cancel|reject/i.test(statusOverride) ? { status: statusOverride, adminLineup: false } : { status: statusOverride }), ...noteOtherEmail(twin), ...consentFor(twin.event) },
          (r) => supabase.from(table).update(r).eq('id', twin.id),
        )
        if (twinErr) throw twinErr
        return NextResponse.json({ ok: true, updated: true, id: twin.id, status: statusOverride }, { status: 200, headers: CORS_HEADERS })
      }
      const { data: createdRow, error: insErr } = await writeWithFallback<{ id: string }>(
        { ...record, status: statusOverride },
        (r) => supabase.from(table).insert(r).select('id').single(),
      )
      if (insErr) throw insErr
      return NextResponse.json(
        { ok: true, created: true, id: createdRow?.id, status: statusOverride },
        { status: 201, headers: CORS_HEADERS },
      )
    }

    // Skip if this email is already in the table for this edition,
    // case-insensitively (imported contacts often have mixed-case emails),
    // so a re-sync is idempotent. The same person at an earlier edition is
    // a different row and does not count.
    if (email) {
      const { data: existing } = await byEmailAndEdition().limit(1)
      if (existing?.length) {
        // Already in the CRM: still take the marketing details (a headshot
        // uploaded afterwards) and the consent answer, as far as it applies
        // to the edition this row is filed under.
        const updates = { ...marketing, ...consentFor(existing[0].event) }
        if (Object.keys(updates).length) {
          const { error: mErr } = await writeWithFallback(updates, (r) => supabase.from(table).update(r).eq('id', existing[0].id))
          if (mErr && !isMissingMarketingColumn(mErr) && !isMissingConsentColumn(mErr)) console.warn('register: marketing/consent update failed:', mErr.message)
        }
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
      let nameQ = supabase
        .from(table)
        .select('id, email, event')
        .ilike('firstName', escapeLike(firstName))
        .ilike('lastName', escapeLike(lastName))
      if (common.event) nameQ = nameQ.ilike('event', escapeLike(common.event))
      const { data: sameName } = await nameQ.limit(10)
      const emailless = sameName?.find((r: { id: string; email: string | null; event: string | null }) => !r.email?.trim())
      if (emailless) {
        const fill = { ...(email ? { email } : {}), ...consentFor(emailless.event) }
        if (Object.keys(fill).length) {
          await writeWithFallback(fill, (r) => supabase.from(table).update(r).eq('id', emailless.id))
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

    // The same name at the same company, under another email: that record,
    // with what the registration brings (the line-up, consent).
    const twin = await sameNameAtCompany()
    if (twin) {
      const updates = { ...marketing, ...noteOtherEmail(twin), ...consentFor(twin.event) }
      if (Object.keys(updates).length) {
        const { error: twinErr } = await writeWithFallback(updates, (r) => supabase.from(table).update(r).eq('id', twin.id))
        if (twinErr && !isMissingMarketingColumn(twinErr) && !isMissingConsentColumn(twinErr)) throw twinErr
      }
      return NextResponse.json(
        { ok: true, duplicate: true, id: twin.id, message: 'Same name at the same company under another email: used that record.' },
        { status: 200, headers: CORS_HEADERS },
      )
    }

    const { data, error } = await writeWithFallback<{ id: string }>(record, (r) => supabase.from(table).insert(r).select('id').single())
    if (error) throw error

    return NextResponse.json({ ok: true, id: data?.id }, { status: 201, headers: CORS_HEADERS })
  } catch (error: any) {
    if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
      return NextResponse.json(
        { ok: true, duplicate: true, message: 'Already registered for this edition — skipped.' },
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
