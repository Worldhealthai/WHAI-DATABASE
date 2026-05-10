'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, X, RefreshCw, Users, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── People import: column mapping ─────────────────────────────────────────────

const PEOPLE_AUTO_MAP: Record<string, string> = {
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

const PEOPLE_CRM_FIELDS = [
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

// ── Sponsor import: column mapping ────────────────────────────────────────────

const SPONSOR_AUTO_MAP: Record<string, string> = {
  'company': 'companyName',
  'company name': 'companyName',
  'organisation': 'companyName',
  'organization': 'companyName',
  'account': 'companyName',
  'website': 'website',
  'company website': 'website',
  'url': 'website',
  'country': 'country',
  'city': 'city',
  'tier': 'tier',
  'sponsorship tier': 'tier',
  'level': 'tier',
  'status': 'status',
  'sponsorship status': 'status',
  'event': 'event',
  'first name': 'contactFirstName',
  'firstname': 'contactFirstName',
  'first_name': 'contactFirstName',
  'contact first name': 'contactFirstName',
  'last name': 'contactLastName',
  'lastname': 'contactLastName',
  'last_name': 'contactLastName',
  'contact last name': 'contactLastName',
  'surname': 'contactLastName',
  'email': 'contactEmail',
  'email address': 'contactEmail',
  'contact email': 'contactEmail',
  'phone': 'contactPhone',
  'mobile': 'contactPhone',
  'telephone': 'contactPhone',
  'contact phone': 'contactPhone',
  'job title': 'contactJobTitle',
  'title': 'contactJobTitle',
  'position': 'contactJobTitle',
  'role': 'contactJobTitle',
  'contact job title': 'contactJobTitle',
  'linkedin': 'contactLinkedinUrl',
  'linkedin url': 'contactLinkedinUrl',
  'contact linkedin': 'contactLinkedinUrl',
  'notes': 'notes',
  'tags': 'tags',
}

const SPONSOR_CRM_FIELDS = [
  { value: 'companyName',        label: 'Company Name' },
  { value: 'website',            label: 'Website' },
  { value: 'country',            label: 'Country' },
  { value: 'city',               label: 'City' },
  { value: 'tier',               label: 'Tier' },
  { value: 'status',             label: 'Status' },
  { value: 'event',              label: 'Event' },
  { value: 'contactFirstName',   label: 'Contact First Name' },
  { value: 'contactLastName',    label: 'Contact Last Name' },
  { value: 'contactEmail',       label: 'Contact Email' },
  { value: 'contactPhone',       label: 'Contact Phone' },
  { value: 'contactJobTitle',    label: 'Contact Job Title' },
  { value: 'contactLinkedinUrl', label: 'Contact LinkedIn URL' },
  { value: 'notes',              label: 'Notes' },
  { value: 'tags',               label: 'Tags' },
  { value: '_skip',              label: '— Skip this column —' },
]

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

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

function autoMap(headers: string[], importType: 'people' | 'sponsors'): Record<string, string> {
  const map = importType === 'sponsors' ? SPONSOR_AUTO_MAP : PEOPLE_AUTO_MAP
  const mapping: Record<string, string> = {}
  headers.forEach((h) => {
    const key = h.toLowerCase().trim()
    mapping[h] = map[key] ?? '_skip'
  })
  return mapping
}

// ── Transform helpers ─────────────────────────────────────────────────────────

function transformPeopleRow(row: Record<string, string>, mapping: Record<string, string>): any {
  const out: any = { _raw: row }
  const notesParts: string[] = []

  Object.entries(mapping).forEach(([csvCol, crmField]) => {
    if (crmField === '_skip') return
    const val = row[csvCol]?.trim() ?? ''
    if (!val) return

    if (crmField === 'message') {
      notesParts.push(`Message: ${val}`)
    } else if (crmField === 'inquiryType' || crmField === 'secondaryEvent') {
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

  if (notesParts.length) out.notes = notesParts.join('\n\n')

  const tagParts: string[] = []
  if (out.primaryEvent) tagParts.push(out.primaryEvent.replace(/\s+/g, '-').toLowerCase())
  if (out.importStatus) tagParts.push(out.importStatus)
  if (out.attendeeType) tagParts.push(out.attendeeType.replace(/_/g, '-'))
  if (tagParts.length) {
    out.tags = [...new Set([...(out.tags ? out.tags.split(',').map((t: string) => t.trim()) : []), ...tagParts])].join(', ')
  }

  return out
}

function transformSponsorRow(row: Record<string, string>, mapping: Record<string, string>): any {
  const out: any = {}
  Object.entries(mapping).forEach(([csvCol, crmField]) => {
    if (crmField === '_skip') return
    const val = row[csvCol]?.trim() ?? ''
    if (!val) return
    out[crmField] = val
  })
  return out
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done'
type ImportType = 'people' | 'sponsors'

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importType, setImportType] = useState<ImportType>('people')
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<{
    inserted: number
    companies?: number
    contacts?: number
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
      setMapping(autoMap(h, importType))
      setStep('map')
    }
    reader.readAsText(file)
  }, [importType])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleTypeChange = (type: ImportType) => {
    setImportType(type)
    if (step !== 'upload') {
      // Re-apply auto-map with new type if already in mapping step
      setMapping(autoMap(headers, type))
    }
    setDuplicateKeys(new Set())
  }

  const previewRows = rows.slice(0, 5)
  const totalRows = rows.length

  // People: group by primary event
  const primaryEventMapped = importType === 'people' && Object.values(mapping).includes('primaryEvent')
  const eventGroups = (() => {
    if (!primaryEventMapped || !splitByEvent) return null
    const contacts = rows.map((row) => transformPeopleRow(row, mapping))
    const map = new Map<string, any[]>()
    contacts.forEach((c) => {
      const key = c.primaryEvent?.trim() || 'No Event'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    })
    return map
  })()

  // Sponsors: group by company name
  const sponsorGroups = (() => {
    if (importType !== 'sponsors') return null
    const transformed = rows.map((row) => transformSponsorRow(row, mapping))
    const map = new Map<string, any[]>()
    transformed.forEach((r) => {
      const key = r.companyName?.trim() || '(No Company)'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return map
  })()

  const handleImport = async () => {
    setStep('importing')
    setError('')
    try {
      if (importType === 'sponsors') {
        // Build structured payload: group rows by company
        const rows_transformed = rows.map((r) => transformSponsorRow(r, mapping))
        const res = await fetch('/api/sponsors/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: rows_transformed, event: importEvent || null }),
        })
        if (!res.ok) throw new Error('Import failed')
        const result = await res.json()
        setImportResult({
          inserted: result.contacts,
          companies: result.companies,
          contacts: result.contacts,
          batches: [{ name: fileName.replace(/\.[^.]+$/, ''), count: result.contacts }],
        })
      } else {
        if (eventGroups && eventGroups.size > 1) {
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
          const contacts = rows.map((row) => {
            const t = transformPeopleRow(row, mapping)
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
      }
      setStep('done')
    } catch {
      setError('Import failed. Please try again.')
      setStep('preview')
    }
  }

  const crmFields = importType === 'sponsors' ? SPONSOR_CRM_FIELDS : PEOPLE_CRM_FIELDS

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Import</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload a CSV to import contacts into the CRM.
        </p>
      </div>

      {/* Import type selector — always visible */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleTypeChange('people')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
            importType === 'people'
              ? 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/40'
              : 'text-slate-400 border-[#1a3a5c] hover:text-white hover:border-slate-500'
          )}
        >
          <Users className="w-4 h-4" />
          Delegates &amp; Speakers
        </button>
        <button
          onClick={() => handleTypeChange('sponsors')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
            importType === 'sponsors'
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
              : 'text-slate-400 border-[#1a3a5c] hover:text-white hover:border-slate-500'
          )}
        >
          <Building2 className="w-4 h-4" />
          Sponsors
        </button>
      </div>

      {importType === 'sponsors' && step === 'upload' && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
          <span className="font-semibold">Sponsor import</span> — each row represents one contact. Multiple rows with the same Company Name will be grouped under one company profile automatically.
        </div>
      )}

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs">
        {(['upload', 'map', 'preview'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px]',
              step === s
                ? importType === 'sponsors' ? 'bg-amber-500 text-[#0A1628]' : 'bg-[#00B4D8] text-[#0A1628]'
                : ['map','preview','importing','done'].indexOf(step) > ['upload','map','preview'].indexOf(s)
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
              ? importType === 'sponsors'
                ? 'border-amber-500 bg-amber-500/5'
                : 'border-[#00B4D8] bg-[#00B4D8]/5'
              : 'border-[#1a3a5c] hover:border-[#00B4D8]/50 hover:bg-[#112850]/30'
          )}
        >
          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">Drop your CSV file here</p>
          <p className="text-slate-500 text-sm">or click to browse</p>
          <p className="text-slate-600 text-xs mt-3">
            {importType === 'sponsors'
              ? 'One row per contact — rows with the same company name are grouped automatically'
              : 'Supports CSV files exported from WorldHealthAI admin'}
          </p>
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

          {/* Event assignment */}
          <div className={cn(
            'whai-card p-5 space-y-3 border',
            importType === 'sponsors' ? 'border-amber-500/20' : 'border-[#00B4D8]/20'
          )}>
            <div>
              <p className="text-sm font-semibold text-white">Which event is this import for?</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {importType === 'sponsors'
                  ? 'All companies in this batch will be assigned to the selected event.'
                  : 'All contacts in this batch will be assigned to the selected event.'}
              </p>
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
                      ? importType === 'sponsors'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/50'
                        : 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/50'
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
                    {crmFields.map((f) => (
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
                  if (importType === 'sponsors') {
                    const transformed = rows.map((r) => transformSponsorRow(r, mapping))
                    const companyNames = [...new Set(transformed.map((t) => t.companyName?.trim()).filter(Boolean))]
                    const emails = transformed.map((t) => t.contactEmail).filter(Boolean)
                    const res = await fetch('/api/check-duplicates', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ emails, names: [], companyNames }),
                    })
                    if (res.ok) {
                      const { duplicates } = await res.json()
                      setDuplicateKeys(new Set(duplicates.map((d: any) => d.key)))
                    }
                  } else {
                    const transformed = rows.map((r) => transformPeopleRow(r, mapping))
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
                  }
                } catch { /* non-blocking */ } finally {
                  setCheckingDupes(false)
                }
                setStep('preview')
              }}
              disabled={checkingDupes}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60 transition-colors',
                importType === 'sponsors'
                  ? 'bg-amber-500 text-[#0A1628] hover:bg-amber-400'
                  : 'bg-[#00B4D8] text-[#0A1628] hover:bg-[#00B4D8]/90'
              )}
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
                {importType === 'sponsors'
                  ? <>
                      <span className="text-white font-semibold">{sponsorGroups?.size ?? 0}</span> companies ·{' '}
                      <span className="text-white font-semibold">{totalRows.toLocaleString()}</span> contacts
                    </>
                  : <>Previewing first 5 of <span className="text-white font-semibold">{totalRows.toLocaleString()}</span> contacts</>
                }
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
              importEvent
                ? importType === 'sponsors'
                  ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                  : 'text-[#00B4D8] border-[#00B4D8]/30 bg-[#00B4D8]/10'
                : 'text-slate-500 border-slate-700'
            )}>
              {importEvent || 'No event assigned'}
            </span>
            <button onClick={() => setStep('map')} className="text-slate-600 hover:text-slate-400 underline transition-colors">change</button>
          </div>

          {duplicateKeys.size > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <span className="font-bold shrink-0">⚠ {duplicateKeys.size} potential {duplicateKeys.size === 1 ? 'duplicate' : 'duplicates'} found</span>
              <span className="text-amber-500/70 text-xs">
                {importType === 'sponsors'
                  ? '— these companies may already exist. Importing will add new contacts to the existing company.'
                  : '— these contacts may already exist in the CRM. You can still import them.'}
              </span>
            </div>
          )}

          {/* Sponsor preview: grouped by company */}
          {importType === 'sponsors' && sponsorGroups && (
            <div className="whai-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a3a5c] bg-[#0d2040]">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {sponsorGroups.size} {sponsorGroups.size === 1 ? 'Company' : 'Companies'} detected
                </p>
              </div>
              <div className="divide-y divide-[#1a3a5c]/50">
                {[...sponsorGroups.entries()].slice(0, 20).map(([company, contacts]) => {
                  const companyKey = company.toLowerCase().trim()
                  const isDupe = duplicateKeys.has(companyKey)
                  return (
                    <div key={company} className={cn('px-4 py-3', isDupe && 'bg-amber-500/5')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isDupe && <span className="text-amber-400 text-[10px] font-bold">⚠</span>}
                          <span className={cn('text-sm font-medium', isDupe ? 'text-amber-300' : 'text-white')}>
                            {company}
                          </span>
                          {isDupe && (
                            <span className="text-[10px] text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              Already exists — contacts will be added
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 bg-[#112850] px-2 py-0.5 rounded-full">
                          {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
                        </span>
                      </div>
                      {/* Show contact names */}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {contacts.map((c, i) => (
                          <span key={i} className="text-[11px] text-slate-500 bg-[#112850]/60 px-2 py-0.5 rounded">
                            {[c.contactFirstName, c.contactLastName].filter(Boolean).join(' ') || c.contactEmail || 'Unnamed'}
                            {c.contactJobTitle && <span className="text-slate-600"> · {c.contactJobTitle}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {sponsorGroups.size > 20 && (
                  <div className="px-4 py-3 text-xs text-slate-500">
                    + {sponsorGroups.size - 20} more companies
                  </div>
                )}
              </div>
            </div>
          )}

          {/* People preview table */}
          {importType === 'people' && (
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
                      const t = transformPeopleRow(row, mapping)
                      const emailKey = t.email?.toLowerCase().trim()
                      const nameKey = `${t.firstName ?? ''} ${t.lastName ?? ''}`.toLowerCase().trim()
                      const isDupe = (emailKey && duplicateKeys.has(emailKey)) || (nameKey && duplicateKeys.has(nameKey))
                      return (
                        <tr key={i} className={cn('border-b border-[#1a3a5c]/40', isDupe && 'bg-amber-500/5')}>
                          <td className="px-3 py-2.5 w-6">
                            {isDupe && (
                              <span title="Possible duplicate" className="text-amber-400 text-[10px] font-bold cursor-default">⚠</span>
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
          )}

          {/* Event split summary (people only) */}
          {importType === 'people' && primaryEventMapped && eventGroups && (
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
            <div className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
              importType === 'sponsors' ? 'bg-amber-500/10' : 'bg-[#00B4D8]/10'
            )}>
              {importType === 'sponsors'
                ? <Building2 className="w-4 h-4 text-amber-400" />
                : <Upload className="w-4 h-4 text-[#00B4D8]" />}
            </div>
            <div className="flex-1">
              {importType === 'sponsors' ? (
                <>
                  <p className="text-sm text-white font-medium">
                    Ready to import {sponsorGroups?.size ?? 0} {(sponsorGroups?.size ?? 0) === 1 ? 'company' : 'companies'} · {totalRows.toLocaleString()} contacts
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Each company gets one profile. Contacts are linked underneath. Existing companies will have new contacts added.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-white font-medium">Ready to import {totalRows.toLocaleString()} contacts</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {primaryEventMapped && splitByEvent && eventGroups && eventGroups.size > 1
                      ? `Will create ${eventGroups.size} batches — one per event — so you can filter them separately in the inbox.`
                      : "They'll appear in the Unassigned inbox for triage — nothing is created in Delegates, Speakers, or Sponsors yet."
                    }
                  </p>
                </>
              )}
            </div>
            <button
              onClick={handleImport}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors shrink-0',
                importType === 'sponsors'
                  ? 'bg-amber-500 text-[#0A1628] hover:bg-amber-400'
                  : 'bg-[#00B4D8] text-[#0A1628] hover:bg-[#00B4D8]/90'
              )}
            >
              Import <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Importing ── */}
      {step === 'importing' && (
        <div className="whai-card p-12 text-center space-y-4">
          <div className={cn(
            'w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto',
            importType === 'sponsors' ? 'border-amber-500' : 'border-[#00B4D8]'
          )} />
          <p className="text-white font-medium">
            {importType === 'sponsors'
              ? `Importing ${sponsorGroups?.size ?? 0} companies…`
              : `Importing ${totalRows.toLocaleString()} contacts…`}
          </p>
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
            {importType === 'sponsors' ? (
              <>
                <p className="text-xl font-bold text-white">
                  {importResult.companies} {importResult.companies === 1 ? 'company' : 'companies'} · {importResult.contacts} {importResult.contacts === 1 ? 'contact' : 'contacts'} imported
                </p>
                <p className="text-slate-400 text-sm mt-2">
                  Companies and contacts are live in the Sponsors section.
                </p>
              </>
            ) : (
              <>
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
                <p className="text-slate-400 text-sm mt-3">
                  They're waiting in the Unassigned inbox. Go through them and assign each one as a Delegate, Speaker, or Sponsor.
                </p>
              </>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {importType === 'sponsors' ? (
              <button
                onClick={() => router.push('/sponsors')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-[#0A1628] font-semibold text-sm hover:bg-amber-400 transition-colors"
              >
                Go to Sponsors <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => router.push('/unassigned')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00B4D8] text-[#0A1628] font-semibold text-sm hover:bg-[#00B4D8]/90 transition-colors"
              >
                Go to Triage Inbox <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => { setStep('upload'); setFileName(''); setHeaders([]); setRows([]); setImportResult(null); setDuplicateKeys(new Set()) }}
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
