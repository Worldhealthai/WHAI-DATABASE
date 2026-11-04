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

// The side an event is on: World Pharma AI's are Pharma, World Health AI's
// Health. A contact with no Health or Pharma tag of their own takes the side
// of the events they are in, so a company in both directories has its
// people split without anyone tagging them; a tag, once set, wins.
export function focusOfEvent(event: unknown): Focus | null {
  const e = String(event ?? '')
  if (/world pharma ai|\bwpai\b/i.test(e)) return 'Pharma'
  if (/world health ai|\bwhai\b/i.test(e)) return 'Health'
  return null
}

// What counts for a person: their own tags, else their events' sides.
export const effectiveFocus = (x: { focus?: Focus[]; focusAuto?: Focus[] }): Focus[] => (x.focus?.length ? x.focus : x.focusAuto ?? [])
