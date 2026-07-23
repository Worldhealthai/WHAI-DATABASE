// Fuzzy company-name matching, shared by the duplicate-check API (server)
// and the sponsor/partner forms (client). Catches near-duplicates like
// "Accurx Ltd" ↔ "AccuRx" or "Palo Alto Networks Inc." ↔ "palo alto networks".

const LEGAL_SUFFIXES = new Set([
  'ltd', 'limited', 'inc', 'incorporated', 'llc', 'llp', 'plc', 'corp',
  'corporation', 'co', 'company', 'group', 'holdings', 'gmbh', 'ag', 'sa',
  'bv', 'ab', 'uk', 'usa', 'international',
])

// Lowercase, unify punctuation, drop trailing legal suffixes ("Ltd", "Inc"…).
export function normalizeCompanyName(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[&+]/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) words.pop()
  return words.join(' ')
}

// Dice coefficient over character bigrams of the space-stripped names.
function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0
  const grams = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.slice(i, i + 2)
    grams.set(g, (grams.get(g) ?? 0) + 1)
  }
  let hits = 0
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2)
    const n = grams.get(g) ?? 0
    if (n > 0) {
      hits++
      grams.set(g, n - 1)
    }
  }
  return (2 * hits) / (a.length - 1 + (b.length - 1))
}

// 1 = same company (after normalisation), ~0.9 = one name contains the other,
// otherwise bigram similarity in [0, 1].
export function companySimilarity(a: string, b: string): number {
  const na = normalizeCompanyName(a)
  const nb = normalizeCompanyName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ca = na.replace(/\s/g, '')
  const cb = nb.replace(/\s/g, '')
  if (ca === cb) return 1
  // Containment ("accurx" ⊂ "accurxhealth") — only for names long enough
  // that containment is meaningful.
  if (ca.length >= 4 && cb.length >= 4 && (ca.includes(cb) || cb.includes(ca))) return 0.9
  return diceCoefficient(ca, cb)
}

// Minimum similarity for two names to be flagged as likely the same company.
export const COMPANY_MATCH_THRESHOLD = 0.8
