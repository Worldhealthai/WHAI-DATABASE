// A delegate's or speaker's details corrected here go to their booking in
// the Nexus admin panel (its /api/webhooks/crm-contact), so both say the
// same thing. Matched on the email and edition the record had before the
// edit. Best-effort: never throws, never blocks the save. The admin panel
// writes the change straight to the booking, so nothing comes back here.
type Row = Record<string, any>

const FIELDS = ['firstName', 'lastName', 'email', 'phone', 'organization', 'jobTitle'] as const

export function nexusBase(): string {
  const explicit = process.env.NEXUS_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  try {
    return new URL(process.env.NEXUS_EVENTS_URL || 'https://www.worldnexusgroup.com/api/public-events').origin
  } catch {
    return 'https://www.worldnexusgroup.com'
  }
}

export async function syncContactToNexus(before: Row | null, after: Row | null): Promise<void> {
  const secret = process.env.WEBHOOK_SECRET?.trim()
  if (!secret || !before || !after) return
  const email = String(before.email || '').trim()
  if (!email) return
  const changed = FIELDS.filter((k) => (before[k] ?? null) !== (after[k] ?? null))
  if (!changed.length) return
  try {
    await fetch(`${nexusBase()}/api/webhooks/crm-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
      body: JSON.stringify({ match: { email, event: before.event ?? null }, ...Object.fromEntries(changed.map((k) => [k, after[k] ?? null])) }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    console.warn('Admin panel not told of a CRM correction:', err)
  }
}
