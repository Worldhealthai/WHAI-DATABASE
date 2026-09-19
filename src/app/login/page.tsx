'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock, Loader2, Sparkles, ArrowRight } from 'lucide-react'
import { ThemeToggle } from '@/components/shell/ThemeToggle'

function LoginForm() {
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = (el: HTMLInputElement | null) => { if (el) el.focus() }

  useEffect(() => { document.title = 'Sign in · Nexus CRM' }, [])

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
        setError('That password isn’t right. Try again.')
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
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(900px 500px at 50% -10%, var(--teal-soft) 0%, transparent 60%), var(--bg)' }}>
      <header className="flex items-center justify-end px-6 h-16"><ThemeToggle /></header>
      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm anim-fade-up">
          <div className="flex flex-col items-center mb-7">
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, var(--teal) 0%, #0b3b5c 100%)', boxShadow: 'var(--shadow-md)' }}>
              <Sparkles className="w-7 h-7 text-white" />
            </span>
            <h1 className="display text-[24px]" style={{ color: 'var(--fg)', fontWeight: 600 }}>Nexus CRM</h1>
            <p className="text-[13.5px] mt-1" style={{ color: 'var(--fg-3)' }}>World Nexus Group · Sales &amp; Production</p>
          </div>

          <form onSubmit={handleSubmit} className="ws-card p-6" style={{ boxShadow: 'var(--shadow-md)' }}>
            <label className="ws-label" htmlFor="pw">Team password</label>
            <div className="flex items-center gap-2 px-3 rounded-lg transition-colors" style={{ background: 'var(--surface)', border: '1px solid var(--line-2)' }}>
              <Lock className="w-4 h-4 shrink-0" style={{ color: 'var(--fg-4)' }} />
              <input
                id="pw"
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                className="flex-1 h-10 bg-transparent text-[14px] outline-none"
                style={{ color: 'var(--fg)' }}
              />
            </div>

            {error && (
              <div className="mt-3 text-[13px] rounded-lg px-3 py-2" style={{ color: 'var(--bad)', background: 'var(--bad-soft)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !password} className="ws-btn ws-btn-primary w-full mt-4 h-10">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-[12px] mt-6" style={{ color: 'var(--fg-4)' }}>World Health AI · World Pharma AI</p>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--bg)' }} />}>
      <LoginForm />
    </Suspense>
  )
}
