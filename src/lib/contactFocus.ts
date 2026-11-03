// Which side of the business a contact is for (November 2026): within one
// company, some people matter for World Health AI and some for World Pharma
// AI. Kept as a "Health" or "Pharma" tag in the record's own tags (text,
// comma separated, beside any others such as "Lead list"), so no column is
// needed; a person can be both. A person with several records (one per
// event) is tagged on all of them together.

export const FOCUSES = ['Health', 'Pharma'] as const
export type Focus = (typeof FOCUSES)[number]

const TOKEN = /^(health|pharma)$/i

// The record's tags as a list.
export const tagList = (tags: unknown): string[] =>
  String(tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

// The focuses a record's tags hold.
export function focusOf(tags: unknown): Focus[] {
  const set = new Set(tagList(tags).filter((t) => TOKEN.test(t)).map((t) => (t.toLowerCase() === 'health' ? 'Health' : 'Pharma') as Focus))
  return FOCUSES.filter((f) => set.has(f))
}

// The tags with the focuses replaced by these, every other tag kept as it was.
export function withFocus(tags: unknown, focus: Focus[]): string | null {
  const kept = tagList(tags).filter((t) => !TOKEN.test(t))
  const next = [...kept, ...FOCUSES.filter((f) => focus.includes(f))]
  return next.length ? next.join(', ') : null
}
