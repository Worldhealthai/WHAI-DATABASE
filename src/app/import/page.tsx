'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, X, RefreshCw, Users, Building2, Mic, Network } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'
import { useEventOptions } from '@/lib/useEventOptions'

// ── People import: column mapping ─────────────────────────────────────────────

const PEOPLE_AUTO_MAP: Record<string, string> = {
  'name': 'firstName', 'full name': 'firstName', 'fullname': 'firstName', 'contact name': 'firstName',
  'first name': 'firstName', 'firstname': 'firstName', 'first_name': 'firstName', 'given name': 'firstName',
  'last name': 'lastName', 'lastname': 'lastName', 'last_name': 'lastName', 'surname': 'lastName', 'family name': 'lastName',
  'email': 'email', 'email address': 'email', 'e-mail': 'email',
  'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone', 'telephone': 'phone',
  'company': 'organization', 'organisation': 'organization', 'organization': 'organization', 'company name': 'organization', 'employer': 'organization',
  'job title': 'jobTitle', 'job position': 'jobTitle', 'position': 'jobTitle', 'title': 'jobTitle', 'role': 'jobTitle',
  'country': 'country', 'city': 'city', 'location': 'city',
  'linkedin': 'linkedinUrl', 'linkedin url': 'linkedinUrl', 'linkedin profile': 'linkedinUrl',
  'bio': 'bio', 'biography': 'bio', 'about': 'bio',
  'tags': 'tags', 'notes': 'notes', 'admin notes': 'notes',
  'message': 'message', 'attendee type': 'attendeeType', 'type': 'attendeeType',
  'status': 'importStatus', 'primary event': 'primaryEvent', 'event': 'primaryEvent',
  'secondary': 'secondaryEvent', 'inquiry type': 'inquiryType',
}

const PEOPLE_CRM_FIELDS = [
  { value: 'firstName',    label: 'First Name' },
  { value: 'lastName',     label: 'Last Name' },
  { value: 'email',        label: 'Email' },
  { value: 'phone',        label: 'Phone' },
  { value: 'organization', label: 'Organisation / Company' },
  { value: 'jobTitle',     label: 'Job Title' },
  { value: 'country',      label: 'Country' },
  { value: 'city',         label: 'City' },
  { value: 'linkedinUrl',  label: 'LinkedIn URL' },
  { value: 'bio',          label: 'Bio' },
  { value: 'tags',         label: 'Tags' },
  { value: 'notes',        label: 'Notes' },
  { value: 'attendeeType', label: 'Attendee Type (auto-suggest)' },
  { value: 'importStatus', label: 'Status (approved/rejected)' },
  { value: 'primaryEvent', label: 'Primary Event' },
  { value: 'message',      label: 'Message' },
  { value: '_skip',        label: '— Skip this column —' },
]

// ── Sponsor / Partner import: column mapping ──────────────────────────────────

const SPONSOR_AUTO_MAP: Record<string, string> = {
  'company': 'companyName', 'company name': 'companyName', 'organisation': 'companyName', 'organization': 'companyName', 'account': 'companyName',
  'website': 'website', 'company website': 'website', 'url': 'website',
  'country': 'country', 'city': 'city',
  'tier': 'tier', 'sponsorship tier': 'tier', 'level': 'tier',
  'status': 'status', 'sponsorship status': 'status',
  'event': 'event',
  'name': 'contactFirstName', 'full name': 'contactFirstName', 'fullname': 'contactFirstName', 'contact name': 'contactFirstName',
  'first name': 'contactFirstName', 'firstname': 'contactFirstName', 'first_name': 'contactFirstName', 'contact first name': 'contactFirstName',
  'last name': 'contactLastName', 'lastname': 'contactLastName', 'last_name': 'contactLastName', 'contact last name': 'contactLastName', 'surname': 'contactLastName',
  'email': 'contactEmail', 'email address': 'contactEmail', 'contact email': 'contactEmail',
  'phone': 'contactPhone', 'mobile': 'contactPhone', 'telephone': 'contactPhone', 'contact phone': 'contactPhone',
  'job title': 'contactJobTitle', 'title': 'contactJobTitle', 'position': 'contactJobTitle', 'role': 'contactJobTitle', 'contact job title': 'contactJobTitle',
  'linkedin': 'contactLinkedinUrl', 'linkedin url': 'contactLinkedinUrl', 'contact linkedin': 'contactLinkedinUrl',
  'notes': 'notes', 'tags': 'tags',
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

// ── Type config ────────────────────────────────────────────────────────────────

type ImportType = 'delegates' | 'speakers' | 'sponsors' | 'partners'

const TYPE_CONFIG: Record<ImportType, {
  label: string; shortLabel: string; icon: any
  hex: string; activeBg: string; activeBorder: string; activeText: string; spinBorder: string
  isCompany: boolean
}> = {
  delegates: {
    label: 'Delegates', shortLabel: 'Delegates', icon: Users,
    hex: '#00B4D8', activeBg: 'bg-[#00B4D8]/15', activeBorder: 'border-[#00B4D8]/40', activeText: 'text-[#00B4D8]', spinBorder: 'border-[#00B4D8]',
    isCompany: false,
  },
  speakers: {
    label: 'Speakers', shortLabel: 'Speakers', icon: Mic,
    hex: '#a855f7', activeBg: 'bg-purple-500/15', activeBorder: 'border-purple-500/40', activeText: 'text-purple-400', spinBorder: 'border-purple-500',
    isCompany: false,
  },
  sponsors: {
    label: 'Sponsors', shortLabel: 'Sponsors', icon: Building2,
    hex: '#f59e0b', activeBg: 'bg-amber-500/15', activeBorder: 'border-amber-500/40', activeText: 'text-amber-400', spinBorder: 'border-amber-500',
    isCompany: true,
  },
  partners: {
    label: 'Association & Media Partners', shortLabel: 'Partners & Media', icon: Network,
    hex: '#10b981', activeBg: 'bg-emerald-500/15', activeBorder: 'border-emerald-500/40', activeText: 'text-emerald-400', spinBorder: 'border-emerald-500',
    isCompany: true,
  },
}

// ── File parsers (CSV + Excel) ────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const cells: string[] = []
    let cur = '', inQuote = false
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

function parseExcel(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (raw.length < 2) return { headers: [], rows: [] }
  const headers = (raw[0] as any[]).map((h) => String(h ?? '').trim())
  const rows = raw.slice(1)
    .map((cells) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = String(cells[i] ?? '').trim() })
      return obj
    })
    .filter((row) => Object.values(row).some((v) => v))
  return { headers, rows }
}

// Detects numbered contact columns like "Contact 1 First Name", "Contact 2 Email", etc.
// and expands each company row into one row per contact found.
const CONTACT_NUM_RE = /^contact\s*(\d+)\s+(.+)$/i
const CONTACT_FIELD_MAP: Record<string, string> = {
  'first name': 'contactFirstName', 'firstname': 'contactFirstName',
  'last name': 'contactLastName', 'lastname': 'contactLastName', 'surname': 'contactLastName',
  'email': 'contactEmail', 'email address': 'contactEmail',
  'phone': 'contactPhone', 'mobile': 'contactPhone', 'telephone': 'contactPhone',
  'job title': 'contactJobTitle', 'title': 'contactJobTitle', 'position': 'contactJobTitle', 'role': 'contactJobTitle',
  'linkedin': 'contactLinkedinUrl', 'linkedin url': 'contactLinkedinUrl',
  'name': 'contactFirstName', // fallback
}

function expandMultiContactRows(headers: string[], rows: Record<string, string>[]): { headers: string[]; rows: Record<string, string>[] } {
  // Find which headers are numbered contact columns
  const numberedCols = new Map<number, Map<string, string>>() // contactNum → {header → crmField}
  let hasNumbered = false

  for (const h of headers) {
    const m = h.match(CONTACT_NUM_RE)
    if (!m) continue
    const num = parseInt(m[1])
    const fieldKey = m[2].toLowerCase().trim()
    const crmField = CONTACT_FIELD_MAP[fieldKey]
    if (!crmField) continue
    hasNumbered = true
    if (!numberedCols.has(num)) numberedCols.set(num, new Map())
    numberedCols.get(num)!.set(h, crmField)
  }

  if (!hasNumbered) return { headers, rows }

  // Base fields: everything that is NOT a numbered contact column
  const baseHeaders = headers.filter((h) => !h.match(CONTACT_NUM_RE))
  const sortedNums = [...numberedCols.keys()].sort((a, b) => a - b)

  const expanded: Record<string, string>[] = []

  for (const row of rows) {
    // Build base object (company-level fields)
    const base: Record<string, string> = {}
    for (const h of baseHeaders) base[h] = row[h] ?? ''

    for (const num of sortedNums) {
      const colMap = numberedCols.get(num)!
      // Check if this contact slot has any data
      const hasData = [...colMap.keys()].some((h) => row[h]?.trim())
      if (!hasData) continue

      // Create a new row with base fields + this contact's fields mapped to standard names
      const contactRow: Record<string, string> = { ...base }
      for (const [srcHeader, crmField] of colMap) {
        // Find if there's already a standard header for this crmField; if not, use the crmField key directly
        contactRow[crmField] = row[srcHeader] ?? ''
      }
      expanded.push(contactRow)
    }

    // Also check if there's a plain (non-numbered) primary contact on this row
    const hasPlainContact = baseHeaders.some((h) => {
      const lower = h.toLowerCase().trim()
      return (lower === 'first name' || lower === 'firstname' || lower === 'email' || lower === 'contact first name' || lower === 'contact email') && row[h]?.trim()
    })
    if (hasPlainContact && sortedNums.length > 0) {
      // Primary contact already included via base fields — don't double-add
    } else if (sortedNums.length === 0) {
      expanded.push(base)
    }
  }

  // Rebuild headers to include standard contact fields instead of numbered ones
  const standardContactHeaders = ['contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone', 'contactJobTitle', 'contactLinkedinUrl']
  const newHeaders = [
    ...baseHeaders.filter((h) => !standardContactHeaders.includes(h)),
    ...standardContactHeaders.filter((h) => expanded.some((r) => r[h])),
  ]

  return { headers: newHeaders, rows: expanded }
}

function autoMap(headers: string[], importType: ImportType): Record<string, string> {
  const map = TYPE_CONFIG[importType].isCompany ? SPONSOR_AUTO_MAP : PEOPLE_AUTO_MAP
  const mapping: Record<string, string> = {}
  headers.forEach((h) => { mapping[h] = map[h.toLowerCase().trim()] ?? '_skip' })
  return mapping
}

// A full name landing in the first-name field ("Jane van der Berg") is split
// into first name + the rest as last name. Only applies when there is no
// separate last name, so real first names stay intact.
function splitFullName(out: any, firstKey: string, lastKey: string) {
  const v = out[firstKey]
  if (typeof v !== 'string' || out[lastKey] || !/\s/.test(v.trim())) return
  const parts = v.trim().split(/\s+/)
  out[firstKey] = parts[0]
  out[lastKey] = parts.slice(1).join(' ')
}

// ── Transform helpers ─────────────────────────────────────────────────────────

// Column headers whose values need no label prefix when collected into Notes.
const PLAIN_NOTES_HEADERS = new Set(['notes', 'note', 'admin notes', 'comments', 'comment'])


function transformPeopleRow(row: Record<string, string>, mapping: Record<string, string>): any {
  const out: any = { _raw: row }
  const notesParts: string[] = []

  Object.entries(mapping).forEach(([csvCol, crmField]) => {
    if (crmField === '_skip') return
    const val = row[csvCol]?.trim() ?? ''
    if (!val) return
    if (crmField === 'message') notesParts.push(`Message: ${val}`)
    else if (crmField === 'inquiryType' || crmField === 'secondaryEvent') { /* skip */ }
    else if (crmField === 'importStatus') out.importStatus = val
    else if (crmField === 'attendeeType') out.attendeeType = val
    else if (crmField === 'primaryEvent') out.primaryEvent = val
    else if (crmField === 'notes') {
      // Several columns can map to Notes — collect them all, labelled with
      // their CSV column so nothing overrides anything.
      notesParts.push(PLAIN_NOTES_HEADERS.has(csvCol.trim().toLowerCase()) ? val : `${csvCol.trim()}: ${val}`)
    }
    else if (crmField === 'tags') out.tags = out.tags ? `${out.tags}, ${val}` : val
    else if (!(crmField in out)) out[crmField] = val
  })

  if (notesParts.length) out.notes = notesParts.join(' / ')

  splitFullName(out, 'firstName', 'lastName')

  const tagParts: string[] = []
  if (out.primaryEvent) tagParts.push(out.primaryEvent.replace(/\s+/g, '-').toLowerCase())
  if (out.importStatus) tagParts.push(out.importStatus)
  if (out.attendeeType) tagParts.push(out.attendeeType.replace(/_/g, '-'))
  if (tagParts.length) {
    out.tags = [...new Set([...(out.tags ? out.tags.split(',').map((t: string) => t.trim()) : []), ...tagParts])].join(', ')
  }

  return out
}

function transformCompanyRow(row: Record<string, string>, mapping: Record<string, string>): any {
  const out: any = {}
  const notesParts: string[] = []
  const tagParts: string[] = []
  Object.entries(mapping).forEach(([csvCol, crmField]) => {
    if (crmField === '_skip') return
    const val = row[csvCol]?.trim() ?? ''
    if (!val) return
    if (crmField === 'notes') {
      // Several columns can map to Notes — collect them all, labelled with
      // their CSV column so nothing overrides anything.
      notesParts.push(PLAIN_NOTES_HEADERS.has(csvCol.trim().toLowerCase()) ? val : `${csvCol.trim()}: ${val}`)
    } else if (crmField === 'tags') {
      tagParts.push(val)
    } else if (!(crmField in out)) {
      // Two columns mapped to the same field (e.g. Mobile + Phone → Contact
      // Phone): the first column with a value wins, later ones don't override.
      out[crmField] = val
    }
  })
  if (notesParts.length) out.notes = notesParts.join(' / ')
  if (tagParts.length) out.tags = tagParts.join(', ')
  splitFullName(out, 'contactFirstName', 'contactLastName')
  return out
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done'

export default function ImportPage() {
  const eventOptions = useEventOptions()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importType, setImportType] = useState<ImportType>('delegates')
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<{
    inserted: number; companies?: number; contacts?: number
    batches: { name: string; count: number }[]
  } | null>(null)
  const [splitByEvent, setSplitByEvent] = useState(true)
  const [importEvent, setImportEvent] = useState<string>('')
  const [duplicateKeys, setDuplicateKeys] = useState<Set<string>>(new Set())
  // Fuzzy company matches from the duplicate check, keyed by the incoming
  // company name (lowercased): who it matched and what to do about it.
  const [dupMatches, setDupMatches] = useState<Map<string, { id: string; existingName: string; table: string; status: string }>>(new Map())
  const [dupActions, setDupActions] = useState<Record<string, 'merge' | 'create' | 'skip'>>({})
  const [checkingDupes, setCheckingDupes] = useState(false)
  const [error, setError] = useState('')

  const cfg = TYPE_CONFIG[importType]
  const isCompany = cfg.isCompany

  const handleFile = useCallback((file: File) => {
    setError('')
    setFileName(file.name)
    const isExcel = /\.(xlsx|xls|ods)$/i.test(file.name)

    const process = (parsed: { headers: string[]; rows: Record<string, string>[] }) => {
      let { headers: h, rows: r } = parsed
      if (h.length === 0) { setError('Could not parse file — is it a valid CSV or Excel file?'); return }
      // For company imports, auto-expand numbered contact columns
      if (TYPE_CONFIG[importType].isCompany) {
        const expanded = expandMultiContactRows(h, r)
        h = expanded.headers
        r = expanded.rows
      }
      setHeaders(h)
      setRows(r)
      setMapping(autoMap(h, importType))
      setStep('map')
    }

    if (isExcel) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          process(parseExcel(e.target?.result as ArrayBuffer))
        } catch {
          setError('Could not parse Excel file — try saving as CSV and re-uploading.')
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (e) => process(parseCSV(e.target?.result as string))
      reader.readAsText(file)
    }
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
    if (step !== 'upload') setMapping(autoMap(headers, type))
    setDuplicateKeys(new Set())
    setDupMatches(new Map()); setDupActions({})
  }

  const previewRows = rows.slice(0, 5)
  const totalRows = rows.length

  const primaryEventMapped = !isCompany && Object.values(mapping).includes('primaryEvent')
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

  const companyGroups = (() => {
    if (!isCompany) return null
    const transformed = rows.map((row) => transformCompanyRow(row, mapping))
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
      if (isCompany) {
        const rows_transformed = rows
          .map((r) => {
            const row = transformCompanyRow(r, mapping)
            // For partners, default tier to 'Media Partner' if not set
            if (importType === 'partners' && !row.tier) row.tier = 'Media Partner'
            // Apply the duplicate decision made in the preview: "merge" renames
            // the row to the existing company's exact name so the bulk import
            // folds its contacts into that record; "skip" drops the rows.
            const dupKey = row.companyName?.trim().toLowerCase()
            const match = dupKey ? dupMatches.get(dupKey) : undefined
            const action = match ? (dupActions[dupKey!] ?? 'merge') : undefined
            if (action === 'skip') return null
            if (action === 'merge' && match) row.companyName = match.existingName
            return row
          })
          .filter(Boolean)
        const res = await fetch(importType === 'partners' ? '/api/partners/bulk-import' : '/api/sponsors/bulk-import', {
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
        // People import (delegates or speakers) — tag with type if not already set
        const defaultAttendeeType = importType === 'speakers' ? 'speaker' : 'delegate'
        if (eventGroups && eventGroups.size > 1) {
          let totalInserted = 0
          const batches: { name: string; count: number }[] = []
          for (const [eventName, contacts] of eventGroups) {
            const tagged = contacts.map((c: any) => {
              if (!c.attendeeType) c.attendeeType = defaultAttendeeType
              return importEvent ? { ...c, _raw: { ...c._raw, event: importEvent } } : c
            })
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
            if (!t.attendeeType) t.attendeeType = defaultAttendeeType
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

  const crmFields = isCompany ? SPONSOR_CRM_FIELDS : PEOPLE_CRM_FIELDS

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Import</h1>
        <p className="text-sm text-slate-400 mt-1">Upload a CSV to import contacts into the CRM.</p>
      </div>

      {/* Import type tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#0d2040] border border-[#1a3a5c] rounded-xl w-fit">
        {(Object.entries(TYPE_CONFIG) as [ImportType, typeof TYPE_CONFIG[ImportType]][]).map(([type, c]) => {
          const active = importType === type
          const Icon = c.icon
          return (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                active ? `${c.activeBg} ${c.activeText} ${c.activeBorder} border` : 'text-slate-500 hover:text-slate-300 border border-transparent'
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {c.shortLabel}
            </button>
          )
        })}
      </div>

      {isCompany && step === 'upload' && (
        <div className={cn('px-4 py-3 rounded-lg text-sm border', importType === 'partners' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300')}>
          <span className="font-semibold">{cfg.label} import</span>
          {importType === 'partners'
            ? ' — each row represents one contact at an association or media organisation. Rows with the same Company Name are grouped automatically. Supports numbered contact columns (Contact 1 Email, Contact 2 Email…). Imported as "Media Partner" tier by default.'
            : ' — each row represents one contact, or use numbered columns (Contact 1 First Name, Contact 2 First Name…) to put multiple contacts on one row. Rows with the same Company Name are grouped automatically.'}
        </div>
      )}

      {/* Steps */}
      <div className="flex items-center gap-2 text-xs">
        {(['upload', 'map', 'preview'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px]',
              step === s
                ? `text-[#0A1628]`
                : ['map','preview','importing','done'].indexOf(step) > ['upload','map','preview'].indexOf(s)
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-[#112850] text-slate-500'
            )}
              style={step === s ? { background: cfg.hex } : {}}
            >
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
            isDragging ? 'bg-opacity-5' : 'border-[#1a3a5c] hover:bg-[#112850]/30'
          )}
          style={isDragging
            ? { borderColor: cfg.hex, backgroundColor: `${cfg.hex}08` }
            : { borderColor: undefined }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${cfg.hex}50` }}
          onMouseLeave={(e) => { if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = '' }}
        >
          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">Drop your file here</p>
          <p className="text-slate-500 text-sm">or click to browse · CSV or Excel (.xlsx)</p>
          <p className="text-slate-600 text-xs mt-3">
            {isCompany
              ? 'One row per contact (or numbered columns like "Contact 1 Email", "Contact 2 Email") — grouped by company automatically'
              : `Supports CSV or Excel files exported from WorldHealthAI admin · Importing as ${cfg.label}`}
          </p>
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls,.ods" onChange={onFileInput} className="hidden" />
        </div>
      )}

      {/* ── Step 2: Map ── */}
      {step === 'map' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: cfg.hex }} /> {fileName}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{totalRows.toLocaleString()} rows · {headers.length} columns · importing as <span style={{ color: cfg.hex }}>{cfg.label}</span></p>
            </div>
            <button onClick={() => setStep('upload')} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
              <X className="w-3.5 h-3.5" /> Change file
            </button>
          </div>

          {/* Event assignment */}
          <div className="whai-card p-5 space-y-3" style={{ borderColor: `${cfg.hex}30` }}>
            <div>
              <p className="text-sm font-semibold text-white">Which event is this import for?</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {isCompany ? 'All companies in this batch will be assigned to the selected event.' : 'All contacts in this batch will be assigned to the selected event.'}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {eventOptions.map((ev) => (
                <button key={ev} type="button" onClick={() => setImportEvent(ev)}
                  className={cn('px-5 py-2.5 rounded-lg text-sm font-semibold border transition-all',
                    importEvent === ev ? 'text-white border-white/30 bg-white/10' : 'text-slate-300 border-[#1a3a5c] hover:text-white hover:border-slate-500 hover:bg-[#112850]/50'
                  )}
                  style={importEvent === ev ? { borderColor: `${cfg.hex}50`, background: `${cfg.hex}15`, color: cfg.hex } : {}}
                >
                  {ev}
                </button>
              ))}
              <button type="button" onClick={() => setImportEvent('')}
                className={cn('px-5 py-2.5 rounded-lg text-sm font-medium border transition-all',
                  importEvent === '' ? 'bg-slate-500/15 text-slate-300 border-slate-500/40' : 'text-slate-500 border-[#1a3a5c] hover:text-slate-300 hover:border-slate-600'
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
                    {rows[0]?.[h] && <div className="text-xs text-slate-500 truncate mt-0.5">{rows[0][h]}</div>}
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
                  if (isCompany) {
                    const transformed = rows.map((r) => transformCompanyRow(r, mapping))
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
                      // Rich company matches → default each to "merge" when the
                      // existing record lives in the table we're importing into,
                      // otherwise "create" (can't merge a sponsor into a partner).
                      const target = importType === 'partners' ? 'partners' : 'sponsors'
                      const matches = new Map<string, { id: string; existingName: string; table: string; status: string }>()
                      const actions: Record<string, 'merge' | 'create' | 'skip'> = {}
                      for (const d of duplicates) {
                        if (d.match === 'company' && d.id && d.existingName) {
                          matches.set(d.key, { id: d.id, existingName: d.existingName, table: d.table, status: d.status })
                          actions[d.key] = d.table === target ? 'merge' : 'create'
                        }
                      }
                      setDupMatches(matches)
                      setDupActions(actions)
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
                } catch { /* non-blocking */ } finally { setCheckingDupes(false) }
                setStep('preview')
              }}
              disabled={checkingDupes}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60 transition-colors text-[#0A1628] hover:opacity-90"
              style={{ background: cfg.hex }}
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
                {isCompany
                  ? <><span className="text-white font-semibold">{companyGroups?.size ?? 0}</span> companies · <span className="text-white font-semibold">{totalRows.toLocaleString()}</span> contacts</>
                  : <>Previewing first 5 of <span className="text-white font-semibold">{totalRows.toLocaleString()}</span> contacts</>
                }
              </p>
            </div>
            <button onClick={() => setStep('map')} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Edit mapping
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Importing as:</span>
            <span className="px-2 py-0.5 rounded border font-medium" style={{ color: cfg.hex, borderColor: `${cfg.hex}30`, background: `${cfg.hex}10` }}>
              {cfg.label}
            </span>
            {importEvent && (
              <>
                <span>·</span>
                <span>Event:</span>
                <span className="px-2 py-0.5 rounded border font-medium" style={{ color: cfg.hex, borderColor: `${cfg.hex}30`, background: `${cfg.hex}10` }}>{importEvent}</span>
              </>
            )}
            <button onClick={() => setStep('map')} className="text-slate-600 hover:text-slate-400 underline transition-colors">change</button>
          </div>

          {duplicateKeys.size > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <span className="font-bold shrink-0">⚠ {duplicateKeys.size} potential {duplicateKeys.size === 1 ? 'duplicate' : 'duplicates'} found</span>
              <span className="text-amber-500/70 text-xs">
                {isCompany
                  ? '— these companies may already exist. Importing will add new contacts to the existing company.'
                  : '— these contacts may already exist in the CRM. You can still import them.'}
              </span>
            </div>
          )}

          {/* Company preview */}
          {isCompany && companyGroups && (
            <div className="whai-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a3a5c] bg-[#0d2040]">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {companyGroups.size} {companyGroups.size === 1 ? 'Company' : 'Companies'} detected
                  {importType === 'partners' && <span className="ml-2 normal-case font-normal text-emerald-400/70">· will be tagged as Media Partner</span>}
                </p>
              </div>
              <div className="divide-y divide-[#1a3a5c]/50">
                {[...companyGroups.entries()].slice(0, 20).map(([company, contacts]) => {
                  const dupKey = company.toLowerCase().trim()
                  const match = dupMatches.get(dupKey)
                  const action = match ? (dupActions[dupKey] ?? 'merge') : undefined
                  const isDupe = !!match || duplicateKeys.has(dupKey)
                  const canMerge = match && match.table === (importType === 'partners' ? 'partners' : 'sponsors')
                  const setAction = (a: 'merge' | 'create' | 'skip') =>
                    setDupActions((prev) => ({ ...prev, [dupKey]: a }))
                  return (
                    <div key={company} className={cn('px-4 py-3', isDupe && action !== 'skip' && 'bg-amber-500/5', action === 'skip' && 'opacity-40')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {isDupe && <span className="text-amber-400 text-[10px] font-bold shrink-0">⚠</span>}
                          <span className={cn('text-sm font-medium truncate', isDupe ? 'text-amber-300' : 'text-white')}>{company}</span>
                        </div>
                        <span className="text-xs text-slate-400 bg-[#112850] px-2 py-0.5 rounded-full shrink-0">
                          {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
                        </span>
                      </div>
                      {match && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-amber-400/90">
                            Matches existing: <span className="font-semibold">{match.existingName}</span>
                            <span className="text-amber-500/60"> · {match.table === 'partners' ? 'Partners' : 'Sponsors'} · {match.status}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            {canMerge && (
                              <button
                                onClick={() => setAction('merge')}
                                className={cn('text-[10px] px-2 py-0.5 rounded border transition-colors',
                                  action === 'merge' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-[#1a3a5c] text-slate-400 hover:text-white')}
                              >
                                Merge into existing
                              </button>
                            )}
                            <button
                              onClick={() => setAction('create')}
                              className={cn('text-[10px] px-2 py-0.5 rounded border transition-colors',
                                action === 'create' ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'border-[#1a3a5c] text-slate-400 hover:text-white')}
                            >
                              Create new
                            </button>
                            <button
                              onClick={() => setAction('skip')}
                              className={cn('text-[10px] px-2 py-0.5 rounded border transition-colors',
                                action === 'skip' ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'border-[#1a3a5c] text-slate-400 hover:text-white')}
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      )}
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
                {companyGroups.size > 20 && (
                  <div className="px-4 py-3 text-xs text-slate-500">+ {companyGroups.size - 20} more companies</div>
                )}
              </div>
            </div>
          )}

          {/* People preview table */}
          {!isCompany && (
            <div className="whai-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a3a5c] bg-[#0d2040]">
                      {['', 'Name', 'Email', 'Organisation', 'Job Title', 'Type', 'Status', 'Event', 'Notes'].map((h) => (
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
                            {isDupe && <span title="Possible duplicate" className="text-amber-400 text-[10px] font-bold cursor-default">⚠</span>}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={isDupe ? 'text-amber-300' : 'text-white'}>{[t.firstName, t.lastName].filter(Boolean).join(' ') || '—'}</span>
                            {isDupe && <div className="text-[10px] text-amber-500/80 mt-0.5">Possible duplicate</div>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 truncate max-w-[140px]">{t.email || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-400 truncate max-w-[120px]">{t.organization || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-400 truncate max-w-[120px]">{t.jobTitle || '—'}</td>
                          <td className="px-3 py-2.5">
                            {(t.attendeeType || importType) && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${cfg.hex}20`, color: cfg.hex }}>
                                {t.attendeeType || importType}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {t.importStatus && (
                              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', t.importStatus === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
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
          {!isCompany && primaryEventMapped && eventGroups && (
            <div className="whai-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a3a5c] bg-[#0d2040] flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Events detected — {eventGroups.size} {eventGroups.size === 1 ? 'batch' : 'batches'}
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-slate-400">Split by event</span>
                  <div onClick={() => setSplitByEvent((v) => !v)}
                    className="w-9 h-5 rounded-full transition-colors relative cursor-pointer"
                    style={{ background: splitByEvent ? cfg.hex : '#334155' }}
                  >
                    <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', splitByEvent ? 'translate-x-4' : 'translate-x-0.5')} />
                  </div>
                </label>
              </div>
              <div className="divide-y divide-[#1a3a5c]/50">
                {[...eventGroups.entries()].map(([name, contacts]) => (
                  <div key={name} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-white">{name}</span>
                    <span className="text-xs text-slate-400 bg-[#112850] px-2 py-0.5 rounded-full">{contacts.length.toLocaleString()} contacts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="whai-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${cfg.hex}18` }}>
              {(() => { const Icon = cfg.icon; return <Icon className="w-4 h-4" style={{ color: cfg.hex }} /> })()}
            </div>
            <div className="flex-1">
              {isCompany ? (
                <>
                  <p className="text-sm text-white font-medium">
                    Ready to import {companyGroups?.size ?? 0} {(companyGroups?.size ?? 0) === 1 ? 'company' : 'companies'} · {totalRows.toLocaleString()} contacts
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Each company gets one profile. Contacts are linked underneath. Existing companies will have new contacts added.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-white font-medium">Ready to import {totalRows.toLocaleString()} {cfg.label.toLowerCase()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {primaryEventMapped && splitByEvent && eventGroups && eventGroups.size > 1
                      ? `Will create ${eventGroups.size} batches — one per event.`
                      : "They'll appear in the Unassigned inbox for triage — nothing is created in Delegates or Speakers yet."
                    }
                  </p>
                </>
              )}
            </div>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors shrink-0 text-[#0A1628] hover:opacity-90"
              style={{ background: cfg.hex }}
            >
              Import <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Importing ── */}
      {step === 'importing' && (
        <div className="whai-card p-12 text-center space-y-4">
          <div className={cn('w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto', cfg.spinBorder)} />
          <p className="text-white font-medium">
            {isCompany ? `Importing ${companyGroups?.size ?? 0} companies…` : `Importing ${totalRows.toLocaleString()} ${cfg.label.toLowerCase()}…`}
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
            {isCompany ? (
              <>
                <p className="text-xl font-bold text-white">
                  {importResult.companies} {importResult.companies === 1 ? 'company' : 'companies'} · {importResult.contacts} {importResult.contacts === 1 ? 'contact' : 'contacts'} imported
                </p>
                <p className="text-slate-400 text-sm mt-2">
                  {importType === 'partners'
                    ? 'Associations and media partners are live in the Partners section.'
                    : 'Companies and contacts are live in the Sponsors section.'}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-white">{importResult.inserted.toLocaleString()} {cfg.label.toLowerCase()} imported</p>
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
            {isCompany ? (
              <button onClick={() => router.push('/sponsors')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-[#0A1628] hover:opacity-90 transition-colors"
                style={{ background: cfg.hex }}
              >
                Go to Sponsors <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => router.push('/unassigned')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-[#0A1628] hover:opacity-90 transition-colors"
                style={{ background: cfg.hex }}
              >
                Go to Triage Inbox <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => { setStep('upload'); setFileName(''); setHeaders([]); setRows([]); setImportResult(null); setDuplicateKeys(new Set()); setDupMatches(new Map()); setDupActions({}) }}
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
