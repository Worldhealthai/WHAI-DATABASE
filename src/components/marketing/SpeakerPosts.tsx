'use client'

// Speaker welcome posts for one edition. The speakers are the event's
// Speakers section in the Nexus admin panel, read live; consent comes
// from their registration form. Status and link are edited in the row;
// "Log post" records the post.

import { useMemo, useState } from 'react'
import { ExternalLink, Megaphone, Search, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, Stat, timeAgo } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import {
  ADMIN_URL, Avatar, LogPostModal, Notice, POST_STATUSES, Tone, consentLabel, speakerPostStatus, useEdition, useMarketing, useMarketingActions, type PostStatus, type SpeakerRow,
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

// The post's link and when it went out, edited in place.
function PostCell({ s, onSave }: { s: SpeakerRow; onSave: (url: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const url = s.tracking.postUrl
  if (editing) {
    return (
      <input
        autoFocus
        className="ws-input h-7 text-[12.5px] w-full"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { setEditing(false); if (text.trim() !== (url || '')) onSave(text.trim()) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
        placeholder="https://www.linkedin.com/posts/…"
      />
    )
  }
  return (
    <span className="block min-w-0">
      <span className="flex items-center gap-1.5 min-w-0">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] hover:underline underline-offset-4 truncate min-w-0" style={{ color: 'var(--accent-ink)' }}>
            <ExternalLink className="w-3 h-3 shrink-0" /> <span className="truncate">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
          </a>
        ) : null}
        <button type="button" className="text-[12px] shrink-0 hover:underline underline-offset-4" style={{ color: 'var(--fg-4)' }} onClick={() => { setText(url || ''); setEditing(true) }}>
          {url ? 'edit' : 'add link'}
        </button>
      </span>
      {s.tracking.postedAt && <span className="block text-[11.5px] tabular" style={{ color: 'var(--fg-4)' }}>posted {timeAgo(s.tracking.postedAt)}</span>}
    </span>
  )
}

export function SpeakerPosts() {
  const ed = useEdition()
  const year = ed?.year ?? ''
  const { data, isLoading } = useMarketing<SpeakerRow>('speaker')
  const { track, logPost } = useMarketingActions('speaker')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [logging, setLogging] = useState<SpeakerRow | null>(null)

  const rows = data?.data ?? []
  const counts = useMemo(() => {
    const c = { total: rows.length, consented: 0, posted: 0, todo: 0, notneeded: 0, noconsent: 0, missing: 0 }
    for (const s of rows) {
      const st = speakerPostStatus(s)
      if (s.linkedin_consent === true) c.consented++
      if (s.linkedin_consent === false) c.noconsent++
      if (st === 'Posted') c.posted++
      else if (st === 'To do') c.todo++
      else c.notneeded++
      if (!s.image || !s.bio) c.missing++
    }
    return c
  }, [rows])

  const shown = rows.filter((s) => {
    const st = speakerPostStatus(s)
    if (filter === 'todo' && st !== 'To do') return false
    if (filter === 'posted' && st !== 'Posted') return false
    if (filter === 'notneeded' && st !== 'Not needed') return false
    if (filter === 'noconsent' && s.linkedin_consent !== false) return false
    if (filter === 'missing' && s.image && s.bio) return false
    if (q.trim()) {
      const hay = `${s.name} ${s.org ?? ''} ${s.role ?? ''} ${s.email ?? ''}`.toLowerCase()
      if (!hay.includes(q.trim().toLowerCase())) return false
    }
    return true
  })

  return (
    <WorkspacePage
      title="Speaker posts"
      description={`Welcome posts on our LinkedIn page for the ${year} speakers — the line-up as the admin panel holds it. Consent comes from the registration form.`}
      actions={
        <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="ws-btn" title="Speakers are managed in the Nexus admin panel">
          Manage line-up in admin panel <ExternalLink className="w-3.5 h-3.5" />
        </a>
      }
    >
      {data?.error ? (
        <Notice message={data.error} tone={data.migration ? 'warn' : 'bad'} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Speakers on the line-up" value={counts.total} loading={isLoading} hint={`${counts.consented} consented`} />
            <Stat label="To do" value={counts.todo} loading={isLoading} hint="No post yet" />
            <Stat label="Posted" value={counts.posted} loading={isLoading} hint={counts.total ? `${Math.round((counts.posted / counts.total) * 100)}% of speakers` : ''} />
            <Stat label="Missing photo or bio" value={counts.missing} loading={isLoading} hint="A post needs both — add them in the admin panel" />
          </div>

          <div className="ws-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--fg-4)' }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search speakers…" className="ws-input pl-9" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {FILTERS.map((f) => (
                  <button key={f.key} className="ws-chip" data-active={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>
                ))}
              </div>
              <span className="ml-auto text-[12.5px] tabular whitespace-nowrap" style={{ color: 'var(--fg-3)' }}>{isLoading ? 'Loading…' : `${shown.length} of ${rows.length}`}</span>
            </div>

            {!isLoading && shown.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={rows.length === 0 ? `No speakers on the ${year} line-up yet` : 'No matches'}
                body={rows.length === 0 ? 'Speakers appear here as soon as they are in the event’s Speakers section in the admin panel.' : 'Try another filter.'}
              />
            ) : (
              <table className="ws-table ws-table-fixed w-full">
                <colgroup>
                  <col />
                  <col style={{ width: 108 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 210 }} />
                  <col style={{ width: 112 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Speaker</th>
                    <th>Consent</th>
                    <th>Welcome post</th>
                    <th>Post</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? [0, 1, 2, 3, 4].map((i) => (
                        <tr key={i}>{[0, 1, 2, 3, 4].map((c) => <td key={c}><div className="h-4 rounded animate-pulse" style={{ background: 'var(--surface-3)', width: c === 0 ? '60%' : '70%' }} /></td>)}</tr>
                      ))
                    : shown.map((s) => {
                        const st = speakerPostStatus(s)
                        const consent = consentLabel(s.linkedin_consent)
                        const missing = !s.image && !s.bio ? 'no photo or bio' : !s.image ? 'no photo' : !s.bio ? 'no bio' : ''
                        return (
                          <tr key={s.id}>
                            <td>
                              <span className="flex items-center gap-3 min-w-0">
                                <Avatar src={s.image} name={s.name || '?'} />
                                <span className="min-w-0 flex-1">
                                  <span className="block font-medium truncate" style={{ color: 'var(--fg)' }}>{s.name}</span>
                                  <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>
                                    {[s.role, s.org].filter(Boolean).join(' · ') || s.email || '—'}
                                    {missing && <span style={{ color: 'var(--warn)' }}> · {missing}</span>}
                                  </span>
                                </span>
                              </span>
                            </td>
                            <td><Tone tone={consent.tone}>{consent.text}</Tone></td>
                            <td>
                              <select
                                value={st}
                                onChange={(e) => track(s.id, { postStatus: e.target.value as PostStatus })}
                                className={cn('ws-input h-7 text-[12.5px] py-0 pr-7 w-full')}
                                style={st === 'Posted' ? { color: 'var(--ok)', fontWeight: 600 } : st === 'Not needed' ? { color: 'var(--fg-4)' } : { color: 'var(--fg)' }}
                                aria-label="Welcome post status"
                              >
                                {POST_STATUSES.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </td>
                            <td><PostCell s={s} onSave={(url) => track(s.id, { postUrl: url || null })} /></td>
                            <td className="text-right">
                              {st !== 'Posted' && (
                                <button className="ws-btn ws-btn-sm" onClick={() => setLogging(s)} title="Record the post as done">
                                  <Megaphone className="w-3.5 h-3.5" /> Log post
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {logging && (
        <LogPostModal
          title={`Welcome post · ${logging.name}`}
          subtitle="Marks the post as done and keeps the link."
          onClose={() => setLogging(null)}
          onSave={(url, note) => logPost(logging.id, url, note)}
        />
      )}
    </WorkspacePage>
  )
}
