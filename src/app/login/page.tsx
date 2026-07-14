'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutDashboard, Lock, Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = (el: HTMLInputElement | null) => { if (el) el.focus() }

  useEffect(() => { document.title = 'Sign in · WHAI CRM' }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError('Incorrect password. Please try again.')
        setPassword('')
        setLoading(false)
        return
      }
      const rawFrom = searchParams.get('from') || '/'
      // Only allow same-origin absolute paths (guard against open redirects).
      const from = rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/'
      // Full navigation so the new auth cookie is sent on the next request.
      window.location.assign(from)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0A1628]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#00B4D8] flex items-center justify-center mb-4">
            <LayoutDashboard className="w-6 h-6 text-[#0A1628]" />
          </div>
          <h1 className="font-bold text-lg tracking-wide text-white">
            WHAI <span className="text-[#00B4D8]">CRM</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Enter the password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0d2040] border border-[#1a3a5c] rounded-2xl p-6 shadow-2xl">
          <label className="text-xs font-medium text-slate-400">Password</label>
          <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-[#0A1628] border border-[#1a3a5c] rounded-lg focus-within:border-[#00B4D8]/60 transition-colors">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
            />
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#00B4D8] text-[#0A1628] text-sm font-semibold hover:bg-[#00B4D8]/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">World Health AI Events</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A1628]" />}>
      <LoginForm />
    </Suspense>
  )
}
