// The search box's filter for a PostgREST or(): every listed field holding
// the text typed, plus a looser match on a few fields (a company or
// organisation name) that ignores spacing and punctuation, so
// "lybridhealth" also finds "Lybrid Health" and "Lybrid-Health".

// A value quoted for an or() list, so commas, brackets or quotes in what was
// typed can't break the filter.
function quoted(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

// The letters and digits typed, in order, with anything that is not a
// letter or digit allowed between them. Null for very short searches, where
// it would match too much.
export function looseRegex(q: string): string | null {
  const chars = q.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (chars.length < 4) return null
  return chars.split('').join('[^a-z0-9]*')
}

export function searchFilter(q: string, fields: string[], looseFields: string[] = []): string {
  const like = quoted(`%${q}%`)
  const parts = fields.map((f) => `${f}.ilike.${like}`)
  const rx = looseRegex(q)
  if (rx) for (const f of looseFields) parts.push(`${f}.imatch.${quoted(rx)}`)
  return parts.join(',')
}
