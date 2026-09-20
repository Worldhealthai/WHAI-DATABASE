'use client'

// Shared pieces of the Marketing portal: the edition's data, the "log a
// post" dialog, and the small bits every marketing screen shows.

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2 } from 'lucide-react'
import type { Speaker, Sponsor } from '@/types'
import { Field, Modal } from '@/components/workspace/ui'

export type PostStatus = 'To do' | 'Posted' | 'Not needed'
export const POST_STATUSES: PostStatus[] = ['To do', 'Posted', 'Not needed']

// A speaker's welcome-post state: what was set, else what their consent
// implies (no consent → nothing to do).
export function speakerPostStatus(s: Speaker): PostStatus {
  if (s.postStatus === 'Posted' || s.postStatus === 'Not needed' || s.postStatus === 'To do') return s.postStatus
  if (s.linkedinConsent === false) return 'Not needed'
  return 'To do'
}

export function consentLabel(v: boolean | null | undefined): { text: string; tone: 'ok' | 'bad' | 'muted' } {
  if (v === true) return { text: 'Consented', tone: 'ok' }
  if (v === false) return { text: 'Declined', tone: 'bad' }
  return { text: 'Not asked', tone: 'muted' }
}

// Welcome posts are for people actually on the line-up — the admin panel's
// approved speakers, flagged here on approval and by "Sync from admin
// panel". The speakers list also holds everyone still being invited.
export const isLineupSpeaker = (s: Speaker) => s.adminLineup === true
// Sponsor posts are owed once the deal is done.
export const isConfirmedSponsor = (s: Sponsor) => s.status === 'Confirmed'

export function sponsorRemaining(s: Sponsor): number {
  return Math.max(0, Number(s.linkedinPostsDue ?? 0) - Number(s.linkedinPostsDone ?? 0))
}

export function useMarketing<T>(kind: 'speaker' | 'sponsor', labels: string[]) {
  return useQuery<{ data: T[]; error?: string; migration?: boolean }>({
    queryKey: ['marketing', kind, labels],
    queryFn: async () => {
      const p = new URLSearchParams()
      labels.forEach((l) => p.append('events', l))
      p.set('kind', kind)
      const r = await fetch(`/api/marketing?${p}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return { data: [], error: j?.error || 'Could not load', migration: Boolean(j?.migration) }
      return j
    },
    enabled: labels.length > 0,
    placeholderData: (prev) => prev,
  })
}

export function useMarketingActions(kind: 'speaker' | 'sponsor') {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['marketing', kind] })
  const patch = async (id: string, body: Record<string, unknown>) => {
    // Show it at once; reload from the server either way.
    qc.setQueriesData<{ data: Record<string, unknown>[] }>({ queryKey: ['marketing', kind] }, (old) =>
      old ? { ...old, data: old.data.map((x) => (x.id === id ? { ...x, ...body } : x)) } : old)
    const r = await fetch(`/api/${kind === 'speaker' ? 'speakers' : 'sponsors'}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) refresh()
    return r.ok
  }
  const logPost = async (id: string, url: string, note: string) => {
    const r = await fetch('/api/marketing/log-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id, url, note }),
    })
    refresh()
    return r.ok
  }
  // Pull the admin panel's approved speakers for these editions.
  const syncLineup = async (labels: string[]) => {
    const r = await fetch('/api/marketing/sync-lineup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: labels }),
    })
    const j = await r.json().catch(() => ({}))
    // Wait for the fresh list before reporting, so the note and the table agree.
    await qc.refetchQueries({ queryKey: ['marketing', kind] })
    return r.ok ? { ok: true as const, ...j } : { ok: false as const, error: j?.error || 'Sync failed' }
  }
  return { patch, logPost, refresh, syncLineup }
}

// "Log a post": the link and a line about it. Goes on the record's timeline.
export function LogPostModal({
  title, subtitle, onClose, onSave,
}: { title: string; subtitle?: string; onClose: () => void; onSave: (url: string, note: string) => Promise<boolean> }) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setSaving(true)
    setError('')
    const ok = await onSave(url.trim(), note.trim())
    setSaving(false)
    if (ok) onClose()
    else setError('That did not save. Try again.')
  }
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <button className="ws-btn" onClick={onClose}>Cancel</button>
          <button className="ws-btn ws-btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Log post'}</button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Link to the post" hint="Optional — paste the LinkedIn URL so anyone can find it later.">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--fg-4)' }} />
            <input className="ws-input pl-9" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/posts/…" autoFocus />
          </div>
        </Field>
        <Field label="Note">
          <textarea className="ws-input min-h-[72px] py-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Welcome post went out this morning…" />
        </Field>
        {error && <p className="text-[13px]" style={{ color: 'var(--bad)' }}>{error}</p>}
      </div>
    </Modal>
  )
}

export function Tone({ tone, children }: { tone: 'ok' | 'bad' | 'muted' | 'accent'; children: React.ReactNode }) {
  const style =
    tone === 'ok' ? { background: 'var(--ok-soft)', color: 'var(--ok)' }
    : tone === 'bad' ? { background: 'var(--bad-soft)', color: 'var(--bad)' }
    : tone === 'accent' ? { background: 'var(--accent-soft)', color: 'var(--accent-ink)' }
    : { background: 'var(--surface-2)', color: 'var(--fg-3)', border: '1px solid var(--line)' }
  return <span className="inline-flex items-center h-6 px-2 rounded-md text-[12px] font-medium whitespace-nowrap" style={style}>{children}</span>
}

export function MigrationNotice({ message }: { message: string }) {
  return (
    <div className="ws-card px-5 py-4 text-[13.5px]" style={{ borderColor: 'var(--warn)', color: 'var(--fg-2)' }}>
      <p className="font-semibold" style={{ color: 'var(--warn)' }}>One-time setup needed</p>
      <p className="mt-1">{message}</p>
    </div>
  )
}

export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const text = (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)).toUpperCase()
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="rounded-lg object-cover shrink-0" style={{ width: size, height: size, background: 'var(--surface-3)' }} />
  }
  return (
    <span className="inline-flex items-center justify-center rounded-lg shrink-0 font-semibold select-none" style={{ width: size, height: size, fontSize: Math.round(size * 0.34), background: 'var(--surface-3)', color: 'var(--fg-2)' }}>
      {text}
    </span>
  )
}
