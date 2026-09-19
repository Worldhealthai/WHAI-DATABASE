'use client'

// Speaker welcome posts for one edition: the confirmed speakers (everyone
// else in the speakers list is still being lined up), whether they agreed
// to a post on the registration form, and whether the post has been made.
// Status and link are edited in the row; the name opens the speaker's form
// in place; "Log post" records the post on the speaker's timeline.

import { useMemo, useState } from 'react'
import { ExternalLink, Megaphone, RefreshCw, Search, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import type { Speaker } from '@/types'
import { EmptyState, Segmented, Stat, timeAgo } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { SpeakerFormModal } from '@/components/crm/SpeakerFormModal'
import {
  Avatar, LogPostModal, MigrationNotice, POST_STATUSES, Tone, consentLabel, isLineupSpeaker, speakerPostStatus, useMarketing, useMarketingActions, type PostStatus,
} from './shared'

type Filter = 'all' | 'todo' | 'posted' | 'notneeded' | 'noconsent' | 'missing'
type Scope = 'lineup' | 'everyone'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'To do' },
  { key: 'posted', label: 'Posted' },
  { key: 'notneeded', label: 'Not needed' },
  { key: 'noconsent', label: 'No consent' },
  { key: 'missing', label: 'Missing photo or bio' },
]

// The post's link and when it went out, edited in place.
function PostCell({ s, onSave }: { s: Speaker; onSave: (url: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  if (editing) {
    return (
      <input
        autoFocus
        className="ws-input h-7 text-[12.5px] w-full"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { setEditing(false); if (text.trim() !== (s.postUrl || '')) onSave(text.trim()) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
        placeholder="https://www.linkedin.com/posts/…"
      />
    )
  }
  return (
    <span className="block min-w-0">
      <span className="flex items-center gap-1.5 min-w-0">
        {s.postUrl ? (
          <a href={s.postUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] hover:underline underline-offset-4 truncate min-w-0" style={{ color: 'var(--accent-ink)' }}>
            <ExternalLink className="w-3 h-3 shrink-0" /> <span className="truncate">{s.postUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
          </a>
        ) : null}
        <button type="button" className="text-[12px] shrink-0 hover:underline underline-offset-4" style={{ color: 'var(--fg-4)' }} onClick={() => { setText(s.postUrl || ''); setEditing(true) }}>
          {s.postUrl ? 'edit' : 'add link'}
        </button>
      </span>
      {s.postedAt && <span className="block text-[11.5px] tabular" style={{ color: 'var(--fg-4)' }}>posted {timeAgo(s.postedAt)}</span>}
    </span>
  )
}

export function SpeakerPosts() {
  const { labels, year } = useWorkspace()
  const { data, isLoading } = useMarketing<Speaker>('speaker', labels)
  const { patch, logPost, refresh, syncLineup } = useMarketingActions('speaker')
  const [scope, setScope] = useState<Scope>('lineup')
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [logging, setLogging] = useState<Speaker | null>(null)
  const [editing, setEditing] = useState<Speaker | null>(null)

  const everyone = data?.data ?? []
  const rows = useMemo(() => (scope === 'lineup' ? everyone.filter(isLineupSpeaker) : everyone), [everyone, scope])
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

  const unconfirmed = everyone.length - everyone.filter(isLineupSpeaker).length

  const sync = async () => {
    setSyncing(true)
    setSyncNote('')
    const r = await syncLineup(labels)
    setSyncing(false)
    setSyncNote(r.ok ? `Admin panel line-up: ${r.lineup} speaker${r.lineup === 1 ? '' : 's'} · ${r.created} added · ${r.updated} updated${r.unflagged ? ` · ${r.unflagged} no longer on it` : ''}` : r.error)
  }

  return (
    <WorkspacePage
      title="Speaker posts"
      description={`Welcome posts on our LinkedIn page for the ${year} speakers. Consent comes from the registration form.`}
      actions={
        <>
          <Segmented
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'lineup', label: 'Admin panel line-up', hint: 'Approved speakers, as the admin panel holds them' },
              { value: 'everyone', label: `Everyone${unconfirmed ? ` (+${unconfirmed})` : ''}`, hint: 'Including speakers still being lined up in the CRM' },
            ]}
          />
          <button className="ws-btn ws-btn-primary" onClick={sync} disabled={syncing} title="Pull the approved speakers from the admin panel">
            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} /> {syncing ? 'Syncing…' : 'Sync from admin panel'}
          </button>
        </>
      }
    >
      {syncNote && <p className="text-[13px] mb-3" style={{ color: 'var(--fg-2)' }}>{syncNote}</p>}
      {data?.error ? (
        <MigrationNotice message={data.error} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label={scope === 'lineup' ? 'On the line-up' : 'Speakers'} value={counts.total} loading={isLoading} hint={`${counts.consented} consented`} />
            <Stat label="To do" value={counts.todo} loading={isLoading} hint="No post yet" />
            <Stat label="Posted" value={counts.posted} loading={isLoading} hint={counts.total ? `${Math.round((counts.posted / counts.total) * 100)}% of speakers` : ''} />
            <Stat label="Missing photo or bio" value={counts.missing} loading={isLoading} hint="A post needs both" />
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
                title={rows.length === 0 ? (scope === 'lineup' ? `No line-up for ${year} here yet` : `No speakers in the ${year} edition yet`) : 'No matches'}
                body={rows.length === 0 ? (scope === 'lineup' ? 'Use Sync from admin panel to pull the approved speakers. New approvals arrive on their own from now on.' : 'Speakers arrive here when their registration is approved in the admin panel.') : 'Try another filter.'}
                action={rows.length === 0 && scope === 'lineup' ? <button className="ws-btn ws-btn-primary" onClick={sync} disabled={syncing}><RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} /> Sync from admin panel</button> : undefined}
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
                        const consent = consentLabel(s.linkedinConsent)
                        const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()
                        const missing = !s.headshotUrl && !s.bio ? 'no photo or bio' : !s.headshotUrl ? 'no photo' : !s.bio ? 'no bio' : ''
                        return (
                          <tr key={s.id}>
                            <td>
                              <span className="flex items-center gap-3 min-w-0">
                                <Avatar src={s.headshotUrl} name={name || '?'} />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <button type="button" onClick={() => setEditing(s)} title="Edit this speaker" className="font-medium truncate text-left hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{name || 'Unnamed'}</button>
                                    <a href={`/speakers/${s.id}`} target="_blank" rel="noreferrer" title="Open the full profile in a new tab" className="shrink-0 opacity-50 hover:opacity-100" style={{ color: 'var(--fg-3)' }}><ExternalLink className="w-3 h-3" /></a>
                                  </span>
                                  <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>
                                    {[s.jobTitle, s.organization].filter(Boolean).join(' · ') || s.email || '—'}
                                    {missing && <span style={{ color: 'var(--warn)' }}> · {missing}</span>}
                                  </span>
                                </span>
                              </span>
                            </td>
                            <td><Tone tone={consent.tone}>{consent.text}</Tone></td>
                            <td>
                              <select
                                value={st}
                                onChange={(e) => patch(s.id, { postStatus: e.target.value as PostStatus, ...(e.target.value === 'Posted' && !s.postedAt ? { postedAt: new Date().toISOString() } : {}) })}
                                className={cn('ws-input h-7 text-[12.5px] py-0 pr-7 w-full')}
                                style={st === 'Posted' ? { color: 'var(--ok)', fontWeight: 600 } : st === 'Not needed' ? { color: 'var(--fg-4)' } : { color: 'var(--fg)' }}
                                aria-label="Welcome post status"
                              >
                                {POST_STATUSES.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </td>
                            <td><PostCell s={s} onSave={(url) => patch(s.id, { postUrl: url || null })} /></td>
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
      {editing && <SpeakerFormModal speaker={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
    </WorkspacePage>
  )
}
