'use client'

// Import scraped contacts straight into this edition (lib/eventImport): a
// spreadsheet or CSV, or rows pasted from one. The columns are matched to
// Company, Contact name, Job title, Email and Contact number (from the
// headers, or in that order when there are none), each can be changed, and
// the first rows show how they will be read before anything is filed.

import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileUp } from 'lucide-react'
import { IMPORT_FIELDS, guessColumns, readRows, type ImportField } from '@/lib/eventImport'
import { Modal } from './ui'

type Result =
  | { kind: 'sponsor'; companiesAdded: number; contactsAdded: number; skipped: { already: number; noCompany: number } }
  | { kind: 'speaker'; added: number; skipped: { already: number; noName: number } }

const cellText = (v: unknown) => (v == null ? '' : String(v).trim())

// Pasted rows: tab-separated (as copied from a sheet), else commas.
function parsePaste(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const tabs = lines.some((l) => l.includes('\t'))
  return lines.map((l) => (tabs ? l.split('\t') : l.split(',')).map(cellText))
}

export function ImportToEventModal({
  kind, event, onClose, onDone,
}: { kind: 'sponsor' | 'speaker'; event: string; onClose: () => void; onDone: () => void }) {
  const [grid, setGrid] = useState<string[][] | null>(null)
  const [source, setSource] = useState('')
  const [paste, setPaste] = useState('')
  const [header, setHeader] = useState(false)
  const [columns, setColumns] = useState<Record<ImportField, number>>({ company: 0, name: 1, jobTitle: 2, email: 3, phone: 4 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = (rows: string[][], from: string) => {
    const clean = rows.map((r) => r.map(cellText)).filter((r) => r.some(Boolean))
    if (!clean.length) { setError('Nothing to read in that.'); return }
    const guess = guessColumns(clean)
    setGrid(clean); setSource(from); setHeader(guess.header); setColumns(guess.columns); setError(''); setResult(null)
  }
  const onFile = async (file: File) => {
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = book.Sheets[book.SheetNames[0]]
      load(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false }) as string[][], file.name)
    } catch {
      setError('That file could not be read. Use a .xlsx, .xls or .csv file.')
    }
  }

  const rows = useMemo(() => (grid ? readRows(grid, header, columns) : []), [grid, header, columns])
  const width = grid ? Math.max(...grid.slice(0, 50).map((r) => r.length)) : 0
  const headings = grid
    ? Array.from({ length: width }, (_, i) => (header && grid[0][i] ? `${grid[0][i]}` : `Column ${String.fromCharCode(65 + (i % 26))}`))
    : []
  const companies = new Set(rows.map((r) => r.company.toLowerCase()).filter(Boolean)).size
  const noCompany = rows.filter((r) => !r.company).length
  const plural = kind === 'sponsor' ? 'Sponsors' : 'Speakers'

  const run = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/events/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, event, rows }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || 'The import did not go through.')
      setResult({ kind, ...j })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The import did not go through.')
    } finally {
      setBusy(false)
    }
  }

  const summary = result
    ? result.kind === 'sponsor'
      ? [`${result.companiesAdded} new ${result.companiesAdded === 1 ? 'company' : 'companies'}`, `${result.contactsAdded} ${result.contactsAdded === 1 ? 'contact' : 'contacts'} added`,
         result.skipped.already ? `${result.skipped.already} already on their company, skipped` : '',
         result.skipped.noCompany ? `${result.skipped.noCompany} without a company, skipped` : ''].filter(Boolean)
      : [`${result.added} ${result.added === 1 ? 'speaker' : 'speakers'} added`,
         result.skipped.already ? `${result.skipped.already} already in this edition, skipped` : '',
         result.skipped.noName ? `${result.skipped.noName} without a name or email, skipped` : ''].filter(Boolean)
    : []

  return (
    <Modal
      title={`Import ${plural.toLowerCase()}`}
      subtitle={`Into ${event}, as Not Contacted`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        result ? (
          <button onClick={onClose} className="ws-btn ws-btn-primary">Done</button>
        ) : (
          <>
            <button onClick={onClose} className="ws-btn ws-btn-ghost">Cancel</button>
            <button onClick={run} disabled={busy || !rows.length} className="ws-btn ws-btn-primary">
              {busy ? 'Importing…' : rows.length ? `Import ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}` : 'Import'}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-1.5 text-[13.5px]" style={{ color: 'var(--fg-2)' }}>
          <p className="font-semibold" style={{ color: 'var(--fg)' }}>Imported into {event}</p>
          {summary.map((s) => <p key={s}>{s}</p>)}
          <p className="text-[12px] mt-2" style={{ color: 'var(--fg-4)' }}>Each one is tagged “Imported”.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* The file, or rows pasted from a sheet */}
          <div>
            <p className="text-[13px]" style={{ color: 'var(--fg-2)' }}>
              One person per row: <b>Company, Contact name, Job title, Email, Contact number</b>. A header row is optional.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
              <button onClick={() => fileRef.current?.click()} className="ws-btn"><FileUp className="w-4 h-4" /> Choose a file</button>
              {source && <span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{source}</span>}
            </div>
            <textarea
              className="ws-input mt-3 font-mono text-[12px]"
              rows={grid && source !== 'Pasted rows' ? 2 : 5}
              placeholder={'…or paste rows from a sheet here\nAcme Health\tJane Smith\tHead of Data\tjane@acme.com\t+44 7700 900000'}
              value={paste}
              onChange={(e) => { setPaste(e.target.value); if (e.target.value.trim()) load(parsePaste(e.target.value), 'Pasted rows'); else if (source === 'Pasted rows') setGrid(null) }}
            />
          </div>

          {grid && (
            <>
              {/* Which column is which */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="ws-label !mb-0">Columns</span>
                  <label className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--fg-3)' }}>
                    <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> First row is a header
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {IMPORT_FIELDS.map((f) => (
                    <label key={f.key} className="block">
                      <span className="block text-[11.5px] mb-1" style={{ color: 'var(--fg-3)' }}>{f.label}</span>
                      <select
                        className="ws-input !py-1.5 text-[12.5px]"
                        value={columns[f.key]}
                        onChange={(e) => setColumns({ ...columns, [f.key]: Number(e.target.value) })}
                      >
                        <option value={-1}>Not in the file</option>
                        {headings.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {/* How the first rows will be read */}
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--line)' }}>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', color: 'var(--fg-3)' }}>
                      {IMPORT_FIELDS.map((f) => <th key={f.key} className="text-left font-medium px-3 py-2 whitespace-nowrap">{f.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 6).map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--line)', color: 'var(--fg-2)' }}>
                        {IMPORT_FIELDS.map((f) => (
                          <td key={f.key} className="px-3 py-2 whitespace-nowrap max-w-[220px] truncate">{r[f.key] || <span style={{ color: 'var(--fg-4)' }}>—</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[12.5px] -mt-2" style={{ color: 'var(--fg-3)' }}>
                {rows.length} {rows.length === 1 ? 'row' : 'rows'}
                {kind === 'sponsor' ? ` · ${companies} ${companies === 1 ? 'company' : 'companies'}` : ''}
                {kind === 'sponsor' && noCompany ? ` · ${noCompany} without a company will be skipped` : ''}
                {kind === 'sponsor'
                  ? '. A company already in this edition keeps its stage and gains only the people it hasn’t got.'
                  : '. Anyone already a speaker in this edition is skipped.'}
              </p>
            </>
          )}

          {error && <p className="text-[13px]" style={{ color: 'var(--danger, #dc2626)' }}>{error}</p>}
        </div>
      )}
    </Modal>
  )
}
