'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, X, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Column mapping ────────────────────────────────────────────────────────────
// Maps common CSV header variations to our internal field names

const AUTO_MAP: Record<string, string> = {
  'first name': 'firstName',
  'firstname': 'firstName',
  'first_name': 'firstName',
  'given name': 'firstName',
  'last name': 'lastName',
  'lastname': 'lastName',
  'last_name': 'lastName',
  'surname': 'lastName',
  'family name': 'lastName',
  'email': 'email',
  'email address': 'email',
  'e-mail': 'email',
  'phone': 'phone',
  'phone number': 'phone',
  'mobile': 'phone',
  'telephone': 'phone',
  'company': 'organization',
  'organisation': 'organization',
  'organization': 'organization',
  'company name': 'organization',
  'employer': 'organization',
  'job title': 'jobTitle',
  'job position': 'jobTitle',
  'position': 'jobTitle',
  'title': 'jobTitle',
  'role': 'jobTitle',
  'country': 'country',
  'city': 'city',
  'location': 'city',
  'linkedin': 'linkedinUrl',
  'linkedin url': 'linkedinUrl',
  'linkedin profile': 'linkedinUrl',
  'bio': 'bio',
  'biography': 'bio',
  'about': 'bio',
  'tags': 'tags',
  'notes': 'notes',
  'admin notes': 'notes',
  'message': 'message',
  'attendee type': 'attendeeType',
  'type': 'attendeeType',
  'status': 'importStatus',
  'primary event': 'primaryEvent',
  'event': 'primaryEvent',
  'secondary': 'secondaryEvent',
  'inquiry type': 'inquiryType',
}

const CRM_FIELDS = [
  { value: 'firstName',     label: 'First Name' },
  { value: 'lastName',      label: 'Last Name' },
  { value: 'email',         label: 'Email' },
  { value: 'phone',         label: 'Phone' },
  { value: 'organization',  label: 'Organisation / Company' },
  { value: 'jobTitle',      label: 'Job Title' },
  { value: 'country',       label: 'Country' },
  { value: 'city',          label: 'City' },
  { value: 'linkedinUrl',   label: 'LinkedIn URL' },
  { value: 'bio',           label: 'Bio' },
  { value: 'tags',          label: 'Tags' },
  { value: 'notes',         label: 'Notes' },
  { value: 'attendeeType',  label: 'Attendee Type (auto-suggest)' },
  { value: 'importStatus',  label: 'Status (approved/rejected)' },
  { value: 'primaryEvent',  label: 'Primary Event' },
  { value: 'message',       label: 'Message' },
  { value: '_skip',         label: '— Skip this column —' },
]

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  // Simple CSV parser handling quoted fields
  function parseLine(line: string): string[] {
    const cells: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        cells.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur.trim())
    return cells
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
    return obj
  }).filter((row) => Object.values(row).some((v) => v.trim()))

  return { headers, rows }
}

function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  headers.forEach((h) => {
    const key = h.toLowerCase().trim()
    mapping[h] = AUTO_MAP[key] ?? '_skip'
  })
  return mapping
}

function transformRow(row: Record<string, string>, mapping: Record<string, string>): any {
  const out: any = { _raw: row }
  const notesParts: string[] = []

  Object.entries(mapping).forEach(([csvCol, crmField]) => {
    if (crmField === '_skip') return
    const val = row[csvCol]?.trim() ?? ''
    if (!val) return

    if (crmField === 'message') {
      if (val) notesParts.push(`Message: ${val}`)
    } else if (crmField === 'inquiryType') {
      // skip
    } else if (crmField === 'secondaryEvent') {
      // skip
    } else if (crmField === 'importStatus') {
      out.importStatus = val
    } else if (crmField === 'attendeeType') {
      out.attendeeType = val
    } else if (crmField === 'primaryEvent') {
      out.primaryEvent = val
    } else if (crmField === 'notes') {
      notesParts.push(val)
    } else {
      out[crmField] = val
    }
  })

  // Merge notes
  if (notesParts.length) {
    out.notes = notesParts.join('\n\n')
  }

  // Build tags from event + status
  const tagParts: string[] = []
  if (out.primaryEvent) tagParts.push(out.primaryEvent.replace(/\s+/g, '-').toLowerCase())
  if (out.importStatus) tagParts.push(out.importStatus)
  if (out.attendeeType) tagParts.push(out.attendeeType.replace(/_/g, '-'))
  if (tagParts.length) {
    out.tags = [...new Set([...(out.tags ? out.tags.split(',').map((t: string) => t.trim()) : []), ...tagParts])].join(', ')
  }

  return out
}

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done'

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<{
    inserted: number
    batches: { name: string; count: number }[]
  } | null>(null)
  const [splitByEvent, setSplitByEvent] = useState(true)
  const [importEvent, setImportEvent] = useState<string>('')
  const [duplicateKeys, setDuplicateKeys] = useState<Set<string>>(new Set())
  const [checkingDupes, setCheckingDupes] = useState(false)
  const [error, setError] = useState('')

  const handleFile = useCallback((file: File) => {
    setError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers: h, rows: r } = parseCSV(text)
      if (h.length === 0) { setError('Could not parse file — is it a valid CSV?'); return }
      setHeaders(h)
      setRows(r)
      setMapping(autoMap(h))
      setStep('map')
    }
    reader.readAsText(file)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const previewRows = rows.slice(0, 5)
  const totalRows = rows.length

  const primaryEventMapped = Object.values(mapping).includes('primaryEvent')

  // Group transformed contacts by event (for split-by-event preview + import)
  const eventGroups = (() => {
    if (!primaryEventMapped || !splitByEvent) return null
    const contacts = rows.map((row) => transformRow(row, mapping))
    const map = new Map<string, any[]>()
    contacts.forEach((c) => {
      const key = c.primaryEvent?.trim() || 'No Event'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    })
    return map
  })()

  const handleImport = async () => {
    setStep('importing')
    setError('')
    try {
      if (eventGroups && eventGroups.size > 1) {
        // Import one batch per event
        let totalInserted = 0
        const batches: { name: string; count: number }[] = []
        for (const [eventName, contacts] of eventGroups) {
          const tagged = importEvent
            ? contacts.map((c: any) => ({ ...c, _raw: { ...c._raw, event: importEvent } }))
            : contacts
          const res = await fetch('/api/staged-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: tagged, importBatch: eventName }),
          })
          if (!res.ok) throw new Error('Import failed')
          const result = await res.json()
          totalInserted += result.inserted
          batches.push({ name: eventName, count: result.inserted })
        }
        setImportResult({ inserted: totalInserted, batches })
      } else {
        // Single batch — name by filename
        const contacts = rows.map((row) => {
          const t = transformRow(row, mapping)
          if (importEvent) t._raw = { ...t._raw, event: importEvent }
          return t
        })
        const batchName = (eventGroups?.size === 1
          ? [...eventGroups.keys()][0]
          : fileName.replace(/\.[^.]+$/, '')) + ' — ' +
          new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        const res = await fetch('/api/staged-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts, importBatch: batchName }),
        })
        if (!res.ok) throw new Error('Import failed')
        const result = await res.json()
        setImportResult({ inserted: result.inserted, batches: [{ name: result.batch, count: result.inserted }] })
      }
      setStep('done')
    } catch {
      setError('Import failed. Please try again.')
      setStep('preview')
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Import Contacts</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload a CSV export from WorldHealthAI admin. Contacts land in the triage inbox where you can assign them as delegates, speakers, or sponsors.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs">
        {(['upload', 'map', 'preview'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px]',
              step === s ? 'bg-[#00B4D8] text-[#0A1628]' :
              ['map','preview','importing','done'].indexOf(step) > ['upload','map','preview'].indexOf(s)
                ? 'bg-green-500/20 text-green-400'
                : 'bg-[#112850] text-slate-500'
            )}>
              {i + 1}
            </div>
            <span className={step === s ? 'text-white' : 'text-slate-500'}>
              {s === 'upload' ? 'Upload' : s === 'map' ? 'Map columns' : 'Preview & import'}
            </span>
            {i < 2 && <div className="w-6 h-px bg-[#1a3a5c]" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
            isDragging
              ? 'border-[#00B4D8] bg-[#00B4D8]/5'
              : 'border-[#1a3a5c] hover:border-[#00B4D8]/50 hover:bg-[#112850]/30'
          )}
        >
          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">Drop your CSV file here</p>
          <p className="text-slate-500 text-sm">or click to browse</p>
          <p className="text-slate-600 text-xs mt-3">Supports CSV files exported from WorldHealthAI admin</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFileInput} className="hidden" />
        </div>
      )}

      {/* ── Step 2: Column mapping ── */}
      {step === 'map' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00B4D8]" /> {fileName}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{totalRows.toLocaleString()} rows detected · {headers.length} columns</p>
            </div>
            <button onClick={() => setStep('upload')} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
              <X className="w-3.5 h-3.5" /> Change file
            </button>
          </div>

          {/* Event assignment — shown first, prominently */}
          <div className="whai-card p-5 space-y-3 border border-[#00B4D8]/20">
            <div>
              <p className="text-sm font-semibold text-white">Which event is this import for?</p>
              <p className="text-xs text-slate-500 mt-0.5">All contacts in this batch will be assigned to the selected event.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {['UK Forum', 'US Forum'].map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => setImportEvent(ev)}
                  className={cn(
                    'px-5 py-2.5 rounded-lg text-sm font-semibold border transition-all',
                    importEvent === ev
                      ? 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/50'
                      : 'text-slate-300 border-[#1a3a5c] hover:text-white hover:border-slate-500 hover:bg-[#112850]/50'
                  )}
                >
                  {ev}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setImportEvent('')}
                className={cn(
                  'px-5 py-2.5 rounded-lg text-sm font-medium border transition-all',
                  importEvent === ''
                    ? 'bg-slate-500/15 text-slate-300 border-slate-500/40'
                    : 'text-slate-500 border-[#1a3a5c] hover:text-slate-300 hover:border-slate-600'
                )}
              >
                No assignment
              </button>
            </div>
          </div>

          <div className="whai-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a3a5c] bg-[#0d2040]">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Map CSV columns to CRM fields</p>
            </div>
            <div className="divide-y divide-[#1a3a5c]/50">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-48 shrink-0">
                    <span className="text-sm text-white font-medium">{h}</span>
                    {rows[0]?.[h] && (
                      <div className="text-xs text-slate-500 truncate mt-0.5">{rows[0][h]}</div>
                    )}
                  </div>
                  <div className="text-slate-600 text-xs shrink-0">→</div>
                  <select
                    value={mapping[h] ?? '_skip'}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                    className="flex-1 px-3 py-1.5 bg-[#0A1628] border border-[#1a3a5c] rounded-lg text-sm text-white outline-none focus:border-[#00B4D8]/50"
                  >
                    {CRM_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={async () => {
                setCheckingDupes(true)
                try {
                  const transformed = rows.map((r) => transformRow(r, mapping))
                  const emails = transformed.map((t) => t.email).filter(Boolean)
                  const names = transformed.map((t) => ({ first: t.firstName ?? '', last: t.lastName ?? '' }))
                  const res = await fetch('/api/check-duplicates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emails, names }),
                  })
                  if (res.ok) {
                    const { duplicates } = await res.json()
                    setDuplicateKeys(new Set(duplicates.map((d: any) => d.key)))
                  }
                } catch { /* non-blocking */ } finally {
                  setCheckingDupes(false)
                }
                setStep('preview')
              }}
              disabled={checkingDupes}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00B4D8] text-[#0A1628] font-semibold text-sm hover:bg-[#00B4D8]/90 disabled:opacity-60 transition-colors"
            >
              {checkingDupes ? 'Checking…' : <> Preview <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">{fileName}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Previewing first 5 of <span className="text-white font-semibold">{totalRows.toLocaleString()}</span> contacts
              </p>
            </div>
            <button onClick={() => setStep('map')} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Edit mapping
            </button>
          </div>

          {/* Event reminder chip */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Importing to:</span>
            <span className={cn(
              'px-2 py-0.5 rounded border font-medium',
              importEvent ? 'text-[#00B4D8] border-[#00B4D8]/30 bg-[#00B4D8]/10' : 'text-slate-500 border-slate-700'
            )}>
              {importEvent || 'No event assigned'}
            </span>
            <button onClick={() => setStep('map')} className="text-slate-600 hover:text-slate-400 underline transition-colors">change</button>
          </div>

          {duplicateKeys.size > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <span className="font-bold shrink-0">⚠ {duplicateKeys.size} potential {duplicateKeys.size === 1 ? 'duplicate' : 'duplicates'} found</span>
              <span className="text-amber-500/70 text-xs">— these contacts may already exist in the CRM. You can still import them.</span>
            </div>
          )}

          <div className="whai-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a3a5c] bg-[#0d2040]">
                    {['', 'Name', 'Email', 'Organisation', 'Job Title', 'Attendee Type', 'Status', 'Event', 'Notes'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => {
                    const t = transformRow(row, mapping)
                    const emailKey = t.email?.toLowerCase().trim()
                    const nameKey = `${t.firstName ?? ''} ${t.lastName ?? ''}`.toLowerCase().trim()
                    const isDupe = (emailKey && duplicateKeys.has(emailKey)) || (nameKey && duplicateKeys.has(nameKey))
                    return (
                      <tr key={i} className={cn('border-b border-[#1a3a5c]/40', isDupe && 'bg-amber-500/5')}>
                        <td className="px-3 py-2.5 w-6">
                          {isDupe && (
                            <span title="Possible duplicate — already exists in CRM" className="text-amber-400 text-[10px] font-bold cursor-default">⚠</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={isDupe ? 'text-amber-300' : 'text-white'}>{[t.firstName, t.lastName].filter(Boolean).join(' ') || '—'}</span>
                          {isDupe && <div className="text-[10px] text-amber-500/80 mt-0.5">Possible duplicate</div>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 truncate max-w-[140px]">{t.email || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-400 truncate max-w-[120px]">{t.organization || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-400 truncate max-w-[120px]">{t.jobTitle || '—'}</td>
                        <td className="px-3 py-2.5">
                          {t.attendeeType && (
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
                              t.attendeeType.includes('speaker') ? 'bg-purple-500/20 text-purple-400' : 'bg-[#00B4D8]/15 text-[#00B4D8]'
                            )}>
                              {t.attendeeType}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {t.importStatus && (
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
                              t.importStatus === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            )}>
                              {t.importStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{t.primaryEvent || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500 truncate max-w-[160px]">{t.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {totalRows > 5 && (
              <div className="px-4 py-3 border-t border-[#1a3a5c] text-xs text-slate-500 bg-[#0d2040]">
                + {(totalRows - 5).toLocaleString()} more contacts will be imported
              </div>
            )}
          </div>

          {/* Event split summary */}
          {primaryEventMapped && eventGroups && (
            <div className="whai-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a3a5c] bg-[#0d2040] flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Events detected — {eventGroups.size} {eventGroups.size === 1 ? 'batch' : 'batches'}
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-slate-400">Split by event</span>
                  <div
                    onClick={() => setSplitByEvent((v) => !v)}
                    className={cn(
                      'w-9 h-5 rounded-full transition-colors relative cursor-pointer',
                      splitByEvent ? 'bg-[#00B4D8]' : 'bg-slate-700'
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      splitByEvent ? 'translate-x-4' : 'translate-x-0.5'
                    )} />
                  </div>
                </label>
              </div>
              <div className="divide-y divide-[#1a3a5c]/50">
                {[...eventGroups.entries()].map(([name, contacts]) => (
                  <div key={name} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-white">{name}</span>
                    <span className="text-xs text-slate-400 bg-[#112850] px-2 py-0.5 rounded-full">
                      {contacts.length.toLocaleString()} contacts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="whai-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#00B4D8]/10 flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4 text-[#00B4D8]" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Ready to import {totalRows.toLocaleString()} contacts</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {primaryEventMapped && splitByEvent && eventGroups && eventGroups.size > 1
                  ? `Will create ${eventGroups.size} batches — one per event — so you can filter them separately in the inbox.`
                  : "They'll appear in the Unassigned inbox for triage — nothing is created in Delegates, Speakers, or Sponsors yet."
                }
              </p>
            </div>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00B4D8] text-[#0A1628] font-semibold text-sm hover:bg-[#00B4D8]/90 transition-colors shrink-0"
            >
              Import <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Importing ── */}
      {step === 'importing' && (
        <div className="whai-card p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#00B4D8] border-t-transparent animate-spin mx-auto" />
          <p className="text-white font-medium">Importing {totalRows.toLocaleString()} contacts…</p>
          <p className="text-slate-500 text-sm">This will only take a moment.</p>
        </div>
      )}

      {/* ── Done ── */}
      {step === 'done' && importResult && (
        <div className="whai-card p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{importResult.inserted.toLocaleString()} contacts imported</p>
            {importResult.batches.length > 1 ? (
              <div className="mt-3 text-left max-w-sm mx-auto space-y-1.5">
                {importResult.batches.map((b) => (
                  <div key={b.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300 truncate">{b.name}</span>
                    <span className="text-slate-500 ml-3 shrink-0">{b.count} contacts</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm mt-1">Batch: <span className="text-slate-300">{importResult.batches[0]?.name}</span></p>
            )}
          </div>
          <p className="text-slate-400 text-sm">
            They're waiting in the Unassigned inbox. Go through them and assign each one as a Delegate, Speaker, or Sponsor.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => router.push('/unassigned')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00B4D8] text-[#0A1628] font-semibold text-sm hover:bg-[#00B4D8]/90 transition-colors"
            >
              Go to Triage Inbox <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setStep('upload'); setFileName(''); setHeaders([]); setRows([]); setImportResult(null) }}
              className="px-4 py-2.5 rounded-lg border border-[#1a3a5c] text-slate-300 hover:text-white text-sm transition-colors"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
