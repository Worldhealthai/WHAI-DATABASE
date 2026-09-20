'use client'

// Sponsor posts for one edition. The sponsors are the event's sponsors in
// the Nexus admin panel, read live: onboarded through the sponsor form or
// added by hand. Each carries the LinkedIn posts its package includes;
// this CRM records how many have gone out. "Log post" records one.

import { useMemo, useState } from 'react'
import { ExternalLink, Megaphone, Search, SearchX } from 'lucide-react'
import { EmptyState, Stat, timeAgo } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { ADMIN_URL, Avatar, LogPostModal, Notice, Tone, sponsorDue, sponsorRemaining, useEdition, useMarketing, useMarketingActions, type SponsorRow } from './shared'

type Filter = 'all' | 'outstanding' | 'complete' | 'none'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'outstanding', label: 'Posts owed' },
  { key: 'complete', label: 'Complete' },
  { key: 'none', label: 'No allowance' },
]

// A number edited in place: click, type, Enter or click away.
function Count({ value, onSave, placeholder = '0', title }: { value: number | null | undefined; onSave: (n: number | null) => void; placeholder?: string; title?: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  if (editing) {
    return (
      <input
        autoFocus
        inputMode="numeric"
        className="ws-input h-7 w-[64px] text-[13px] tabular text-center"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={() => { setEditing(false); const n = text === '' ? null : Number(text); if (n !== (value ?? null)) onSave(n) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }
  return (
    <button type="button" onClick={() => { setText(value == null ? '' : String(value)); setEditing(true) }} className="inline-flex items-center justify-center h-7 min-w-[40px] px-2 rounded-md tabular font-medium transition-colors hover:bg-[var(--surface-3)]" style={{ color: value == null ? 'var(--fg-4)' : 'var(--fg)' }} title={title || 'Click to edit'}>
      {value == null ? placeholder : value}
    </button>
  )
}

export function SponsorPosts() {
  const ed = useEdition()
  const year = ed?.year ?? ''
  const { data, isLoading } = useMarketing<SponsorRow>('sponsor')
  const { track, logPost } = useMarketingActions('sponsor')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [logging, setLogging] = useState<SponsorRow | null>(null)

  const rows = data?.data ?? []
  const counts = useMemo(() => {
    const c = { companies: rows.length, due: 0, done: 0, owed: 0, owedCompanies: 0, unset: 0, onboarded: 0 }
    for (const s of rows) {
      const due = Number(sponsorDue(s) ?? 0)
      const done = Number(s.tracking.postsDone ?? 0)
      c.due += due
      c.done += done
      const rem = sponsorRemaining(s)
      c.owed += rem
      if (rem > 0) c.owedCompanies++
      if (sponsorDue(s) == null) c.unset++
      if (s.source === 'onboarding') c.onboarded++
    }
    return c
  }, [rows])

  const shown = rows.filter((s) => {
    const rem = sponsorRemaining(s)
    if (filter === 'outstanding' && rem === 0) return false
    if (filter === 'complete' && (rem > 0 || !sponsorDue(s))) return false
    if (filter === 'none' && sponsorDue(s) != null) return false
    if (q.trim()) {
      const hay = `${s.name} ${s.tier ?? ''} ${s.category ?? ''} ${s.contact_name} ${s.contact_email ?? ''}`.toLowerCase()
      if (!hay.includes(q.trim().toLowerCase())) return false
    }
    return true
  })

  return (
    <WorkspacePage
      title="Sponsor posts"
      description={`LinkedIn posts each ${year} sponsor package includes, and how many have gone out. Sponsors come from the onboarding forms and the event's sponsors in the admin panel.`}
      actions={
        <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="ws-btn" title="Sponsors and packages are managed in the Nexus admin panel">
          Manage in admin panel <ExternalLink className="w-3.5 h-3.5" />
        </a>
      }
    >
      {data?.error ? (
        <Notice message={data.error} tone={data.migration ? 'warn' : 'bad'} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Sponsors" value={counts.companies} loading={isLoading} hint={`${counts.onboarded} through the onboarding form${counts.unset ? ` · ${counts.unset} without an allowance` : ''}`} />
            <Stat label="Posts included" value={counts.due} loading={isLoading} hint="From the packages" />
            <Stat label="Posts made" value={counts.done} loading={isLoading} hint={counts.due ? `${Math.round((Math.min(counts.done, counts.due) / counts.due) * 100)}% of what is included` : ''} />
            <Stat label="Still owed" value={counts.owed} loading={isLoading} hint={`${counts.owedCompanies} ${counts.owedCompanies === 1 ? 'company' : 'companies'} waiting`} />
          </div>

          <div className="ws-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--fg-4)' }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sponsors…" className="ws-input pl-9" />
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
                title={rows.length === 0 ? `No sponsors on the ${year} event yet` : 'No matches'}
                body={rows.length === 0 ? 'Sponsors appear here once an onboarding form is approved for this event, or a sponsor is added to the event in the admin panel.' : 'Try another filter.'}
              />
            ) : (
              <table className="ws-table ws-table-fixed w-full">
                <colgroup>
                  <col />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 84 }} />
                  <col style={{ width: 76 }} />
                  <col style={{ width: 190 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 112 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Package</th>
                    <th className="text-center">Included</th>
                    <th className="text-center">Made</th>
                    <th>Progress</th>
                    <th>Onboarded</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? [0, 1, 2, 3, 4].map((i) => (
                        <tr key={i}>{[0, 1, 2, 3, 4, 5, 6].map((c) => <td key={c}><div className="h-4 rounded animate-pulse" style={{ background: 'var(--surface-3)', width: c === 0 ? '60%' : '70%' }} /></td>)}</tr>
                      ))
                    : shown.map((s) => {
                        const due = sponsorDue(s)
                        const done = Number(s.tracking.postsDone ?? 0)
                        const rem = sponsorRemaining(s)
                        const pct = due ? Math.min(100, Math.round((done / due) * 100)) : 0
                        const overridden = s.tracking.postsDue != null && s.tracking.postsDue !== s.linkedin_posts_included
                        return (
                          <tr key={s.id}>
                            <td>
                              <span className="flex items-center gap-3 min-w-0">
                                <Avatar src={s.logo} name={s.name || '?'} />
                                <span className="min-w-0 flex-1">
                                  <span className="block font-medium truncate" style={{ color: 'var(--fg)' }}>{s.name}</span>
                                  <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[s.contact_name, s.contact_email].filter(Boolean).join(' · ') || (s.source === 'manual' ? 'Added in the admin panel' : '—')}</span>
                                </span>
                              </span>
                            </td>
                            <td>
                              <span className="block text-[13px] truncate" style={{ color: s.tier ? 'var(--fg-2)' : 'var(--fg-4)' }}>{s.tier || 'No package'}</span>
                              {s.source === 'onboarding' && <span className="block text-[11.5px]" style={{ color: 'var(--fg-4)' }}>Onboarding form</span>}
                            </td>
                            <td className="text-center">
                              <Count value={due} onSave={(n) => track(s.id, { postsDue: n })} placeholder="set" title={overridden ? `Package says ${s.linkedin_posts_included ?? 0}; overridden here` : 'From the package — click to override'} />
                            </td>
                            <td className="text-center"><Count value={done} onSave={(n) => track(s.id, { postsDone: n ?? 0 })} /></td>
                            <td>
                              {due ? (
                                <span className="flex items-center gap-2.5">
                                  <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: rem === 0 ? 'var(--ok)' : 'var(--accent)' }} />
                                  </span>
                                  {rem === 0 ? <Tone tone="ok">Complete</Tone> : <Tone tone="accent">{rem} owed</Tone>}
                                </span>
                              ) : (
                                <span className="text-[12.5px]" style={{ color: 'var(--fg-4)' }}>No allowance</span>
                              )}
                            </td>
                            <td className="tabular" style={{ color: 'var(--fg-3)' }}>{s.onboarded_at ? timeAgo(s.onboarded_at) : '—'}</td>
                            <td className="text-right">
                              <button className="ws-btn ws-btn-sm" onClick={() => setLogging(s)} title="Record a post as made">
                                <Megaphone className="w-3.5 h-3.5" /> Log post
                              </button>
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
          title={`LinkedIn post · ${logging.name}`}
          subtitle={`${Math.max(0, sponsorRemaining(logging) - 1)} still owed after this one is logged.`}
          onClose={() => setLogging(null)}
          onSave={(url, note) => logPost(logging.id, url, note)}
        />
      )}
    </WorkspacePage>
  )
}
