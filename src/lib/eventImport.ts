// Bulk import into one edition, from the sheets the team scrapes: one person
// per row, usually in this order with or without a header row:
//
//   Company | Contact name | Job title | Email | Contact number
//
// The import dialog (components/workspace/ImportToEventModal) guesses which
// column is which from the headers (or, with no header row, from that
// order) and lets the admin change it; /api/events/import files the rows.

export type ImportField = 'company' | 'name' | 'jobTitle' | 'email' | 'phone'

export const IMPORT_FIELDS: { key: ImportField; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'name', label: 'Contact name' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Contact number' },
]

export interface ImportRow {
  company: string
  name: string
  jobTitle: string
  email: string
  phone: string
}

// Header words for each field, compared lower-case with spaces, dots,
// underscores and dashes taken out.
const HEADER_WORDS: Record<ImportField, string[]> = {
  company: ['company', 'companyname', 'organisation', 'organization', 'org', 'employer', 'account', 'business'],
  name: ['contactname', 'name', 'fullname', 'contact', 'person', 'firstandlastname'],
  jobTitle: ['jobtitle', 'title', 'position', 'role', 'jobrole', 'designation', 'jobposition'],
  email: ['email', 'emailaddress', 'mail', 'workemail', 'contactemail'],
  phone: ['contactnumber', 'phone', 'phonenumber', 'mobile', 'mobilenumber', 'telephone', 'tel', 'number', 'cell', 'directdial'],
}
const squash = (s: string) => s.toLowerCase().replace(/[\s._\-/]+/g, '')

// Which column each field comes from (an index into the row, or -1 for
// none), and whether the first row is a header.
export function guessColumns(rows: string[][]): { header: boolean; columns: Record<ImportField, number> } {
  const first = rows[0] ?? []
  const columns = { company: -1, name: -1, jobTitle: -1, email: -1, phone: -1 } as Record<ImportField, number>
  // A header row has no email address in it and names at least two fields.
  const taken = new Set<number>()
  if (!first.some((c) => c.includes('@'))) {
    for (const f of IMPORT_FIELDS.map((x) => x.key)) {
      const i = first.findIndex((c, idx) => !taken.has(idx) && HEADER_WORDS[f].includes(squash(c)))
      if (i >= 0) { columns[f] = i; taken.add(i) }
    }
  }
  if (taken.size >= 2) return { header: true, columns }
  // No header: the usual order, as far as the sheet has columns.
  const width = Math.max(0, ...rows.slice(0, 20).map((r) => r.length))
  IMPORT_FIELDS.forEach((f, i) => { columns[f.key] = i < width ? i : -1 })
  // The email column is the one with addresses in it, wherever it is.
  const emailCol = Array.from({ length: width }, (_, i) => i).find((i) => rows.slice(0, 20).filter((r) => (r[i] || '').includes('@')).length >= 1)
  if (emailCol !== undefined && emailCol !== columns.email) {
    const clash = (Object.keys(columns) as ImportField[]).find((k) => columns[k] === emailCol)
    if (clash) columns[clash] = columns.email
    columns.email = emailCol
  }
  return { header: false, columns }
}

export function readRows(rows: string[][], header: boolean, columns: Record<ImportField, number>): ImportRow[] {
  const cell = (r: string[], f: ImportField) => (columns[f] >= 0 ? String(r[columns[f]] ?? '').trim() : '')
  return (header ? rows.slice(1) : rows)
    .map((r) => ({ company: cell(r, 'company'), name: cell(r, 'name'), jobTitle: cell(r, 'jobTitle'), email: cell(r, 'email').toLowerCase(), phone: cell(r, 'phone') }))
    .filter((r) => r.company || r.name || r.email)
}

// "Jane van der Berg" → Jane / van der Berg. A name with no space is a first
// name; no name at all borrows the email's local part.
export function splitName(name: string, email = ''): { firstName: string; lastName: string } {
  const n = name.replace(/\s+/g, ' ').trim()
  if (!n) return { firstName: email.split('@')[0] || '', lastName: '' }
  const i = n.indexOf(' ')
  return i < 0 ? { firstName: n, lastName: '' } : { firstName: n.slice(0, i), lastName: n.slice(i + 1) }
}

export const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
