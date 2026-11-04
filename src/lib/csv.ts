'use client'

// A CSV of what a view shows (every page, with its search and filters),
// downloaded in the browser, for Excel.
export function downloadCsv(name: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const t = v == null ? '' : String(v)
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const text = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  // The byte-order mark makes Excel read the names' accents right.
  const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
