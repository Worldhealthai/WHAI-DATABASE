'use client'

import { useState } from 'react'

export default function MigrateProspectingPage() {
  const [result, setResult] = useState<any>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    try {
      const res = await fetch('/api/migrate-prospecting', { method: 'POST' })
      setResult(await res.json())
    } catch (e: any) {
      setResult({ error: e.message })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-[#0d2040] border border-[#1a3a5c] rounded-xl p-6 space-y-4">
        <h1 className="text-white font-bold text-lg">One-time Migration</h1>
        <p className="text-slate-400 text-sm">
          Updates all records with status <strong className="text-amber-400">Prospecting</strong> to{' '}
          <strong className="text-emerald-400">Not Contacted</strong> across sponsors, delegates, and speakers.
        </p>
        <button
          onClick={run}
          disabled={running || !!result?.results}
          className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#0A1628] font-semibold text-sm transition-colors"
        >
          {running ? 'Running…' : result?.results ? 'Done ✓' : 'Run Migration'}
        </button>
        {result && (
          <pre className="text-xs text-slate-300 bg-[#0A1628] rounded-lg p-3 overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
