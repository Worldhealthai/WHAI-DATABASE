'use client'

import { useState, useCallback } from 'react'
import { Upload, CheckCircle2, AlertCircle, FileText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type ImportStats = {
  total: number
  imported: number
  duplicates: number
  companiesCreated: number
  errors: number
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) return { headers: [], rows: [] }

    const parseRow = (line: string) => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes }
        else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
        else { current += ch }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseRow(lines[0])
    const rows = lines.slice(1, 6).map((line) => {
      const values = parseRow(line)
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
    })
    return { headers, rows }
  }

  const handleFile = (f: File) => {
    setFile(f)
    setStats(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      setHeaders(headers)
      setPreview(rows)
    }
    reader.readAsText(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.csv')) handleFile(f)
  }, [])

  const doImport = async () => {
    if (!file) return
    setImporting(true)
    setError(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) throw new Error('CSV is empty or invalid')

      const parseRow = (line: string) => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes }
          else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
          else { current += ch }
        }
        result.push(current.trim())
        return result
      }

      const headers = parseRow(lines[0])
      const rows = lines.slice(1).map((line) => {
        const values = parseRow(line)
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
      })

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, source: `CSV Import — ${file.name}` }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setStats(data.stats)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Import Contacts</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload a CSV file to bulk-import contacts. The system will auto-classify seniority and job function, deduplicate on email, and create missing companies.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer',
          dragOver ? 'border-[#00B4D8] bg-[#00B4D8]/5' : 'border-[#1a3a5c] hover:border-[#00B4D8]/50',
        )}
        onClick={() => document.getElementById('csv-input')?.click()}
      >
        <input
          id="csv-input"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
        {file ? (
          <div>
            <div className="flex items-center justify-center gap-2 text-white font-medium">
              <FileText className="w-4 h-4 text-[#00B4D8]" />
              {file.name}
            </div>
            <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <p className="text-white font-medium">Drop your CSV here, or click to browse</p>
            <p className="text-xs text-slate-500 mt-1">
              Supports any CSV with columns like: first_name, last_name, email, job_title, company, phone, linkedin_url, country, city
            </p>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="whai-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-white">Preview (first 5 rows)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Detected {headers.length} columns</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {headers.slice(0, 8).map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((row, i) => (
                  <tr key={i}>
                    {headers.slice(0, 8).map((h) => (
                      <td key={h} className="px-3 py-2 text-slate-300 max-w-[120px] truncate">{row[h] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import button */}
      {file && !stats && (
        <button
          onClick={doImport}
          disabled={importing}
          className="w-full py-3 rounded-lg bg-[#00B4D8] text-[#0A1628] font-semibold text-sm hover:bg-[#0096B7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {importing ? (
            <><span className="animate-spin w-4 h-4 border-2 border-[#0A1628] border-t-transparent rounded-full" /> Importing…</>
          ) : (
            <><Upload className="w-4 h-4" /> Start Import</>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-900/20 border border-red-700/30 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="whai-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
            <h2 className="font-semibold text-white">Import Complete</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Total Rows', value: stats.total, color: 'text-white' },
              { label: 'Imported', value: stats.imported, color: 'text-[#10B981]' },
              { label: 'Duplicates Skipped', value: stats.duplicates, color: 'text-amber-400' },
              { label: 'Companies Created', value: stats.companiesCreated, color: 'text-[#00B4D8]' },
              { label: 'Errors', value: stats.errors, color: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 rounded-lg bg-[#112850]">
                <div className={cn('text-2xl font-bold', s.color)}>{s.value.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-classification info */}
      <div className="whai-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">What happens during import</h2>
        {[
          { title: 'Seniority auto-detection', desc: 'Titles containing "Chief", "CEO", "President" → C-Suite; "VP" → VP; "Director" → Director; "Manager" → Manager' },
          { title: 'Job function classification', desc: 'Keywords in titles matched to Clinical, R&D, Data Science, IT, Regulatory, Commercial, Strategy and more' },
          { title: 'Deduplication', desc: 'Matches on email address first, then on (first_name + last_name + company) to skip existing records' },
          { title: 'Company auto-creation', desc: 'Companies not found in the database are created automatically as "Solution Provider / Vendor" type for later enrichment' },
        ].map((item) => (
          <div key={item.title} className="flex gap-3">
            <ChevronRight className="w-4 h-4 text-[#00B4D8] shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-white">{item.title}</div>
              <div className="text-xs text-slate-400">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
