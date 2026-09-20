'use client'

// Shared pieces of the Marketing portal. The people and companies come
// live from the Nexus admin panel (the event's Speakers section, the
// sponsor onboarding forms and manually added sponsors); this CRM only
// keeps what the marketing team records against them.

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2 } from 'lucide-react'
import { eventLook } from '@/lib/portals'
import { useWorkspace } from '@/lib/workspace'
import { Field, Modal } from '@/components/workspace/ui'
import type { LineupSpeaker, LineupSponsor, Tracking } from '@/lib/marketingSource'

export type PostStatus = 'To do' | 'Posted' | 'Not needed'
export const POST_STATUSES: PostStatus[] = ['To do', 'Posted', 'Not needed']

export type SpeakerRow = LineupSpeaker & { tracking: Tracking }
export type SponsorRow = LineupSponsor & { tracking: Tracking }

// A speaker's welcome-post state: what was set, else what their consent
// implies (declined → nothing to do).
export function speakerPostStatus(s: SpeakerRow): PostStatus {
  const t = s.tracking.postStatus
  if (t === 'Posted' || t === 'Not needed' || t === 'To do') return t
  if (s.linkedin_consent === false) return 'Not needed'
  return 'To do'
}

export function consentLabel(v: boolean | null | undefined): { text: string; tone: 'ok' | 'bad' | 'muted' } {
  if (v === true) return { text: 'Consented', tone: 'ok' }
  if (v === false) return { text: 'Declined', tone: 'bad' }
  return { text: 'Not asked', tone: 'muted' }
}

// Posts a sponsor is owed: the package allowance unless overridden here.
export function sponsorDue(s: SponsorRow): number | null {
  if (s.tracking.postsDue != null) return s.tracking.postsDue
  return s.linkedin_posts_included
}
export function sponsorRemaining(s: SponsorRow): number {
  return Math.max(0, Number(sponsorDue(s) ?? 0) - Number(s.tracking.postsDone ?? 0))
}

// The edition the workspace is on, in the terms the admin panel uses.
export function useEdition() {
  const { category, year } = useWorkspace()
  if (!category || !year) return null
  const look = eventLook(category.name)
  return { series: look.series, city: look.city === '—' ? '' : look.city, year, label: `${category.name} ${year}` }
}

export function useMarketing<T>(kind: 'speaker' | 'sponsor') {
  const ed = useEdition()
  return useQuery<{ data: T[]; event?: unknown; error?: string; migration?: boolean }>({
    queryKey: ['marketing', kind, ed?.label ?? ''],
    queryFn: async () => {
      const p = new URLSearchParams({ kind, series: ed!.series, city: ed!.city, year: ed!.year, label: ed!.label })
      const r = await fetch(`/api/marketing?${p}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return { data: [], error: j?.error || 'Could not load', migration: Boolean(j?.migration) }
      return j
    },
    enabled: Boolean(ed),
    placeholderData: (prev) => prev,
  })
}

export function useMarketingActions(kind: 'speaker' | 'sponsor') {
  const qc = useQueryClient()
  const ed = useEdition()
  const refresh = () => qc.invalidateQueries({ queryKey: ['marketing', kind] })
  const applyLocal = (ref: string, patch: Partial<Tracking>) =>
    qc.setQueriesData<{ data: { id: string; tracking: Tracking }[] }>({ queryKey: ['marketing', kind] }, (old) =>
      old ? { ...old, data: old.data.map((x) => (x.id === ref ? { ...x, tracking: { ...x.tracking, ...patch } } : x)) } : old)
  const track = async (ref: string, fields: Partial<Tracking>) => {
    if (!ed) return false
    applyLocal(ref, fields)
    const r = await fetch('/api/marketing/track', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ref, edition: ed.label, ...fields }),
    })
    if (!r.ok) refresh()
    return r.ok
  }
  const logPost = async (ref: string, url: string, note: string) => {
    if (!ed) return false
    const r = await fetch('/api/marketing/log-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ref, edition: ed.label, url, note }),
    })
    await qc.refetchQueries({ queryKey: ['marketing', kind] })
    return r.ok
  }
  return { track, logPost, refresh }
}

// "Log a post": the link and a line about it.
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

export function Notice({ message, tone = 'warn' }: { message: string; tone?: 'warn' | 'bad' }) {
  const colour = tone === 'bad' ? 'var(--bad)' : 'var(--warn)'
  return (
    <div className="ws-card px-5 py-4 text-[13.5px]" style={{ borderColor: colour, color: 'var(--fg-2)' }}>
      <p className="font-semibold" style={{ color: colour }}>{tone === 'bad' ? 'Could not load the line-up' : 'One-time setup needed'}</p>
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

// Where to change the underlying record: the admin panel owns it.
export const ADMIN_URL = 'https://www.worldnexusgroup.com/admin'
