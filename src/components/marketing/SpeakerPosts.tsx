'use client'

// Speaker welcome posts for one edition: every speaker registered for it,
// whether they agreed to a post on the registration form, and whether the
// post has been made. Status and link are edited in the row; "Log post"
// records the post on the speaker's timeline.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Megaphone, Search, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import type { Speaker } from '@/types'
import { EmptyState, Stat, timeAgo } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import {
  Avatar, LogPostModal, MigrationNotice, POST_STATUSES, Tone, consentLabel, speakerPostStatus, useMarketing, useMarketingActions, type PostStatus,
} from './shared'

type Filter = 'all' | 'todo' | 'posted' | 'notneeded' | 'noconsent' | 'missing'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'To do' },
  { key: 'posted', label: 'Posted' },
  { key: 'notneeded', label: 'Not needed' },
  { key: 'noconsent', label: 'No consent' },
  { key: 'missing', label: 'Missing photo or bio' },
]

function LinkCell({ s, onSave }: { s: Speaker; onSave: (url: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  if (editing) {
    return (
      <input
        autoFocus
        className="ws-input h-7 text-[12.5px] w-[200px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { setEditing(false); if (text.trim() !== (s.postUrl || '')) onSave(text.trim()) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
        placeholder="https://www.linkedin.com/posts/…"
      />
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      {s.postUrl ? (
        <a href={s.postUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] hover:underline underline-offset-4 truncate max-w-[180px]" style={{ color: 'var(--accent-ink)' }} onClick={(e) => e.stopPropagation()}>
          <ExternalLink className="w-3 h-3 shrink-0" /> {s.postUrl.replace(/^https?:\/\/(www\.)?/, '')}
        </a>
      ) : null}
      <button type="button" className="text-[12px] hover:underline underline-offset-4" style={{ color: 'var(--fg-4)' }} onClick={() => { setText(s.postUrl || ''); setEditing(true) }}>
        {s.postUrl ? 'edit' : 'add link'}
      </button>
    </span>
  )
}

export function SpeakerPosts() {
  const { labels, year } = useWorkspace()
  const { data, isLoading } = useMarketing<Speaker>('speaker', labels)
  const { patch, logPost } = useMarketingActions('speaker')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [logging, setLogging] = useState<Speaker | null>(null)

  const rows = data?.data ?? []
  const counts = useMemo(() => {
    const c = { total: rows.length, consented: 0, posted: 0, todo: 0, notneeded: 0, noconsent: 0, missing: 0 }
    for (const s of rows) {
      const st = speakerPostStatus(s)
      if (s.linkedinConsent === true) c.consented++
      if (s.linkedinConsent === false) c.noconsent++
      if (st === 'Posted') c.posted++
      else if (st === 'To do') c.todo++
      else c.notneeded++
      if (!s.headshotUrl || !s.bio) c.missing++
    }
    return c
  }, [rows])

  const shown = rows.filter((s) => {
    const st = speakerPostStatus(s)
    if (filter === 'todo' && st !== 'To do') return false
    if (filter === 'posted' && st !== 'Posted') return false
    if (filter === 'notneeded' && st !== 'Not needed') return false
    if (filter === 'noconsent' && s.linkedinConsent !== false) return false
    if (filter === 'missing' && s.headshotUrl && s.bio) return false
    if (q.trim()) {
      const hay = `${s.firstName} ${s.lastName} ${s.organization ?? ''} ${s.jobTitle ?? ''} ${s.email ?? ''}`.toLowerCase()
      if (!hay.includes(q.trim().toLowerCase())) return false
    }
    return true
  })

  return (
    <WorkspacePage title="Speaker posts" description={`Welcome posts on our LinkedIn page for the ${year} speakers. Consent comes from the registration form.`}>
      {data?.error ? (
        <MigrationNotice message={data.error} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Speakers" value={counts.total} loading={isLoading} hint={`${counts.consented} consented`} />
            <Stat label="To do" value={counts.todo} loading={isLoading} hint="Consented or not yet asked, no post yet" />
            <Stat label="Posted" value={counts.posted} loading={isLoading} hint={counts.total ? `${Math.round((counts.posted / counts.total) * 100)}% of speakers` : ''} />
            <Stat label="Missing photo or bio" value={counts.missing} loading={isLoading} hint="A post needs both" />
          </div>

          <div className="ws-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--fg-4)' }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search speakers…" className="ws-input pl-9" />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                {FILTERS.map((f) => (
                  <button key={f.key} className="ws-chip" data-active={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>
                ))}
              </div>
              <span className="ml-auto text-[12.5px] tabular whitespace-nowrap" style={{ color: 'var(--fg-3)' }}>{isLoading ? 'Loading…' : `${shown.length} of ${rows.length}`}</span>
            </div>

            {!isLoading && shown.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={rows.length === 0 ? `No speakers in the ${year} edition yet` : 'No matches'}
                body={rows.length === 0 ? 'Speakers arrive here when their registration is approved in the admin panel.' : 'Try another filter.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="ws-table w-full">
                  <thead>
                    <tr>
                      <th>Speaker</th>
                      <th style={{ width: 120 }}>Consent</th>
                      <th style={{ width: 170 }}>Welcome post</th>
                      <th style={{ width: 240 }}>Post link</th>
                      <th style={{ width: 110 }}>Posted</th>
                      <th style={{ width: 120 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading
                      ? [0, 1, 2, 3, 4].map((i) => (
                          <tr key={i}>{[0, 1, 2, 3, 4, 5].map((c) => <td key={c}><div className="h-4 rounded animate-pulse" style={{ background: 'var(--surface-3)', width: c === 0 ? '60%' : '70%' }} /></td>)}</tr>
                        ))
                      : shown.map((s) => {
                          const st = speakerPostStatus(s)
                          const consent = consentLabel(s.linkedinConsent)
                          const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()
                          const missing = !s.headshotUrl || !s.bio
                          return (
                            <tr key={s.id}>
                              <td>
                                <span className="flex items-center gap-3 min-w-0">
                                  <Avatar src={s.headshotUrl} name={name || '?'} />
                                  <span className="min-w-0">
                                    <Link href={`/speakers/${s.id}`} className="block font-medium truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{name || 'Unnamed'}</Link>
                                    <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>
                                      {[s.jobTitle, s.organization].filter(Boolean).join(' · ') || s.email || '—'}
                                      {missing && <span style={{ color: 'var(--warn)' }}> · {!s.headshotUrl && !s.bio ? 'no photo or bio' : !s.headshotUrl ? 'no photo' : 'no bio'}</span>}
                                    </span>
                                  </span>
                                </span>
                              </td>
                              <td><Tone tone={consent.tone}>{consent.text}</Tone></td>
                              <td>
                                <select
                                  value={st}
                                  onChange={(e) => patch(s.id, { postStatus: e.target.value as PostStatus, ...(e.target.value === 'Posted' && !s.postedAt ? { postedAt: new Date().toISOString() } : {}) })}
                                  className={cn('ws-input h-7 text-[12.5px] py-0 pr-7 min-w-[140px]')}
                                  style={st === 'Posted' ? { color: 'var(--ok)', fontWeight: 600 } : st === 'Not needed' ? { color: 'var(--fg-4)' } : { color: 'var(--fg)' }}
                                  aria-label="Welcome post status"
                                >
                                  {POST_STATUSES.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </td>
                              <td><LinkCell s={s} onSave={(url) => patch(s.id, { postUrl: url || null })} /></td>
                              <td className="tabular" style={{ color: 'var(--fg-3)' }}>{s.postedAt ? timeAgo(s.postedAt) : '—'}</td>
                              <td className="text-right">
                                {st !== 'Posted' && (
                                  <button className="ws-btn ws-btn-sm" onClick={() => setLogging(s)} title="Record the post as done and put it on the timeline">
                                    <Megaphone className="w-3.5 h-3.5" /> Log post
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {logging && (
        <LogPostModal
          title={`Welcome post · ${logging.firstName} ${logging.lastName}`}
          subtitle="Marks the post as done and adds it to the speaker's timeline."
          onClose={() => setLogging(null)}
          onSave={(url, note) => logPost(logging.id, url, note)}
        />
      )}
    </WorkspacePage>
  )
}
