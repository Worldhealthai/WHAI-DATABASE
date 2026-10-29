// Moving a record to another section, for one filed in the wrong place: a
// sponsor that is really a speaker or a delegate, a delegate who is a
// sponsor lead, a speaker who is only attending, a sponsor that is a
// partner. Used by "Move to…" on every profile (POST /api/records/move).
//
// The record is re-made in the other section under the same event, at the
// stage chosen, and its logged activity moves with it; then the old record
// goes. A company becomes one person per contact (its main contact first,
// who takes the activity); a person becomes a company named after their
// organisation, or joins that company as a contact if it is already in the
// event. Someone already in the target section for the event (same email)
// is kept as they are and takes the activity, rather than being doubled.
import { supabase } from '@/lib/supabase'
import { assignStage, type AssignAs } from '@/lib/stagedAssign'

type Kind = AssignAs
type Row = Record<string, any>

const TABLE: Record<Kind, string> = { sponsor: 'sponsors', partner: 'partners', speaker: 'speakers', delegate: 'delegates' }
const FK: Record<Kind, string> = { sponsor: 'sponsorId', partner: 'partnerId', speaker: 'speakerId', delegate: 'delegateId' }
const isCompany = (k: Kind) => k === 'sponsor' || k === 'partner'

interface Person {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  jobTitle: string | null
  linkedinUrl: string | null
  organization: string | null
}

const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

function personOfContact(r: Row, companyName: string | null): Person | null {
  const p = {
    firstName: clean(r.contactFirstName) ?? '',
    lastName: clean(r.contactLastName) ?? '',
    email: clean(r.contactEmail)?.toLowerCase() ?? null,
    phone: clean(r.contactPhone),
    jobTitle: clean(r.contactJobTitle),
    linkedinUrl: clean(r.contactLinkedinUrl),
    organization: companyName,
  }
  return p.firstName || p.lastName || p.email ? p : null
}

export async function moveRecord(from: Kind, id: string, to: Kind, status?: unknown) {
  if (from === to) return { error: 'It is already in that section.', status: 400 as const }
  const { data: src, error } = await supabase.from(TABLE[from]).select('*').eq('id', id).maybeSingle()
  if (error) return { error: error.message, status: 500 as const }
  if (!src) return { error: 'Record not found.', status: 404 as const }
  if (isCompany(from) && src.companyId) return { error: 'Open the company to move it; this is one of its contacts.', status: 400 as const }

  const stage = assignStage(to, status)
  const event: string | null = src.event ?? null
  const year = Number(String(event ?? '').match(/\b(20\d{2})\b/)?.[1]) || null
  const children: Row[] = isCompany(from)
    ? ((await supabase.from(TABLE[from]).select('*').eq('companyId', id)).data ?? [])
    : []

  // Who is moving: the company's contacts, or the person.
  const people: Person[] = isCompany(from)
    ? [src, ...children].map((r) => personOfContact(r, clean(src.companyName))).filter((p): p is Person => !!p)
    : [{
        firstName: clean(src.firstName) ?? '', lastName: clean(src.lastName) ?? '', email: clean(src.email)?.toLowerCase() ?? null,
        phone: clean(src.phone), jobTitle: clean(src.jobTitle), linkedinUrl: clean(src.linkedinUrl), organization: clean(src.organization),
      }]

  const made: { kind: Kind; id: string; existing?: boolean }[] = []

  if (!isCompany(to)) {
    // Into speakers or delegates: one record per person.
    if (!people.length) people.push({ firstName: clean(src.companyName) ?? 'Unnamed', lastName: '', email: null, phone: null, jobTitle: null, linkedinUrl: null, organization: clean(src.companyName) })
    for (const [i, p] of people.entries()) {
      if (p.email) {
        let q = supabase.from(TABLE[to]).select('id').ilike('email', p.email.replace(/[\\%_]/g, '\\$&'))
        q = event ? q.eq('event', event) : q.is('event', null)
        const { data: same } = await q.limit(1)
        if (same?.length) { made.push({ kind: to, id: same[0].id, existing: true }); continue }
      }
      const record: Row = {
        ...p,
        event,
        status: stage,
        country: src.country ?? null,
        city: src.city ?? null,
        notes: i === 0 ? src.notes ?? null : null,
        tags: src.tags ?? null,
        ...(src.subType ? { subType: src.subType } : {}),
        ...(to === 'speaker' ? { year } : {}),
        // Speakers and delegates both keep a bio.
        ...(!isCompany(from) ? { bio: src.bio ?? null } : {}),
      }
      const { data: row, error: insErr } = await supabase.from(TABLE[to]).insert(record).select('id').single()
      if (insErr || !row) return { error: insErr?.message || 'Could not create the new record.', status: 500 as const }
      made.push({ kind: to, id: row.id })
    }
  } else if (isCompany(from)) {
    // Sponsor ↔ partner: the company and its contacts, as they are.
    const omit = ({ id: _i, companyId: _c, createdAt: _a, updatedAt: _u, ...rest }: Row) => rest
    const base = omit(src)
    if (to === 'partner') base.tier = 'Association Partner'
    else if (['Media Partner', 'Association Partner'].includes(String(base.tier))) base.tier = null
    for (const k of ['onboardedAt', 'logoUrl', 'linkedinPostsDue', 'linkedinPostsDone']) if (to === 'partner') delete base[k]
    const { data: row, error: insErr } = await supabase.from(TABLE[to]).insert({ ...base, status: stage }).select('id').single()
    if (insErr || !row) return { error: insErr?.message || 'Could not create the new record.', status: 500 as const }
    made.push({ kind: to, id: row.id })
    if (children.length) {
      const kids = children.map((c) => {
        const k = omit(c)
        for (const f of ['onboardedAt', 'logoUrl', 'linkedinPostsDue', 'linkedinPostsDone']) if (to === 'partner') delete k[f]
        return { ...k, companyId: row.id }
      })
      const { error: kidsErr } = await supabase.from(TABLE[to]).insert(kids)
      if (kidsErr) return { error: kidsErr.message, status: 500 as const }
    }
  } else {
    // A person into sponsors or partners: their organisation, with them as
    // its contact; or, when it is already in the event, one more contact.
    const p = people[0]
    const companyName = p.organization || `${p.firstName} ${p.lastName}`.trim() || 'Unnamed'
    const contact = {
      contactFirstName: p.firstName || null, contactLastName: p.lastName || null, contactEmail: p.email,
      contactPhone: p.phone, contactJobTitle: p.jobTitle, contactLinkedinUrl: p.linkedinUrl,
    }
    let q = supabase.from(TABLE[to]).select('id, companyName, contactEmail').is('companyId', null).ilike('companyName', companyName.replace(/[\\%_]/g, '\\$&'))
    q = event ? q.eq('event', event) : q.is('event', null)
    const { data: existing } = await q.limit(1)
    if (existing?.length) {
      const company = existing[0]
      if (!p.email || (company.contactEmail || '').toLowerCase() !== p.email) {
        const { error: kidErr } = await supabase.from(TABLE[to]).insert({ companyId: company.id, companyName: company.companyName, event, status: stage, ...contact })
        if (kidErr) return { error: kidErr.message, status: 500 as const }
      }
      made.push({ kind: to, id: company.id, existing: true })
    } else {
      const { data: row, error: insErr } = await supabase
        .from(TABLE[to])
        .insert({
          companyName, event, status: stage, ...contact,
          tier: to === 'partner' ? 'Association Partner' : null,
          country: src.country ?? null, city: src.city ?? null, notes: src.notes ?? null, tags: src.tags ?? null,
        })
        .select('id')
        .single()
      if (insErr || !row) return { error: insErr?.message || 'Could not create the new record.', status: 500 as const }
      made.push({ kind: to, id: row.id })
    }
  }

  // The activity goes with it, to the first new record (the main contact).
  const target = made[0]
  const sourceIds = [id, ...children.map((c) => c.id)]
  const { error: actErr } = await supabase
    .from('activities')
    .update({ [FK[from]]: null, [FK[to]]: target.id, entityType: to })
    .in(FK[from], sourceIds)
  if (actErr) return { error: `Moved, but the activity did not follow: ${actErr.message}`, status: 500 as const }

  // A triage entry that made the old record now names the new one, so
  // "Remove" in the Nexus inbox still finds it.
  await supabase.from('staged_contacts').update({ assignedAs: to, assignedId: target.id }).eq('assignedId', id)

  // Then the old record (its contacts first).
  if (children.length) {
    const { error: kidsDel } = await supabase.from(TABLE[from]).delete().eq('companyId', id)
    if (kidsDel) return { error: `Moved, but the old contacts were not removed: ${kidsDel.message}`, status: 500 as const }
  }
  const { error: delErr } = await supabase.from(TABLE[from]).delete().eq('id', id)
  if (delErr) return { error: `Moved, but the old record was not removed: ${delErr.message}`, status: 500 as const }

  return { moved: made, to, event }
}
