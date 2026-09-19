// Team notes written on a contact enquiry in the worldhealth.ai or
// worldnexusgroup.com admin panel, and how they travel into the CRM.
//
// "Add to CRM" stages the enquiry with the original submission row in
// `rawData`; the admin panels put the team's note in it as `team_note`
// (older stagings only carry the panel's own column name). Pure helpers
// here — safe to import from client pages; the Supabase side lives in
// inboxNoteActivity.ts.

export const INBOX_NOTE_KIND = 'inbox_note'

type StagedLike = { rawData?: string | null; importBatch?: string | null }

function parseRaw(contact: StagedLike): Record<string, unknown> {
  try {
    const raw = JSON.parse(contact.rawData ?? '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// Enquiries staged from the admin panels ("Add to CRM" on a contact
// submission) carry an "enquiries" import batch.
export function isEnquiry(contact: StagedLike): boolean {
  return /enquir/i.test(contact.importBatch ?? '')
}

// The team's note as last saved in the admin panel, if any.
export function teamNoteFromStaged(contact: StagedLike): string | null {
  const raw = parseRaw(contact)
  const explicit = str(raw.team_note)
  if (explicit) return explicit
  if (!isEnquiry(contact)) return null
  // Stagings from before the panels sent `team_note`: worldnexusgroup.com
  // stores the note as admin_notes, worldhealth.ai as notes.
  return str(raw.admin_notes) || str(raw.notes) || null
}

// Which inbox the note was written in — shown as the activity's author.
export function teamNoteSource(contact: StagedLike): string {
  const raw = parseRaw(contact)
  const explicit = str(raw.team_note_source)
  if (explicit) return explicit
  if (/nexus/i.test(contact.importBatch ?? '')) return 'worldnexusgroup.com contact inbox'
  return 'worldhealth.ai contact inbox'
}
