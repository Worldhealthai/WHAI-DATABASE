'use client'

// Sponsor posts for one edition: every sponsor company, the LinkedIn posts
// its package includes (set when the onboarding form is approved), how many
// have gone out, and what is still owed. Counts are edited in the row;
// "Log post" records one on the company's timeline.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Megaphone, Search, SearchX } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import type { Sponsor } from '@/types'
import { EmptyState, Stat, StagePill, timeAgo } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { Avatar, LogPostModal, MigrationNotice, Tone, sponsorRemaining, useMarketing, useMarketingActions } from './shared'

type Filter = 'all' | 'outstanding' | 'complete' | 'none'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'outstanding', label: 'Posts owed' },
  { key: 'complete', label: 'Complete' },
  { key: 'none', label: 'No allowance set' },
]

// A number edited in place: click, type, Enter or click away.
function Count({ value, onSave, placeholder = '0' }: { value: number | null | undefined; onSave: (n: number | null) => void; placeholder?: string }) {
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
    <button type="button" onClick={() => { setText(value == null ? '' : String(value)); setEditing(true) }} className="inline-flex items-center justify-center h-7 min-w-[40px] px-2 rounded-md tabular font-medium transition-colors hover:bg-[var(--surface-3)]" style={{ color: value == null ? 'var(--fg-4)' : 'var(--fg)' }} title="Click to edit">
      {value == null ? placeholder : value}
    </button>
  )
}

export function SponsorPosts() {
  const { labels, year } = useWorkspace()
  const { data, isLoading } = useMarketing<Sponsor>('sponsor', labels)
  const { patch, logPost } = useMarketingActions('sponsor')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [logging, setLogging] = useState<Sponsor | null>(null)

  const rows = data?.data ?? []
  const counts = useMemo(() => {
    const c = { companies: rows.length, due: 0, done: 0, owed: 0, owedCompanies: 0, unset: 0 }
    for (const s of rows) {
      const due = Number(s.linkedinPostsDue ?? 0)
      const done = Number(s.linkedinPostsDone ?? 0)
      c.due += due
      c.done += Math.min(done, due) + Math.max(0, done - due)
      const rem = sponsorRemaining(s)
      c.owed += rem
      if (rem > 0) c.owedCompanies++
      if (s.linkedinPostsDue == null) c.unset++
    }
    return c
  }, [rows])

  const shown = rows.filter((s) => {
    const rem = sponsorRemaining(s)
    if (filter === 'outstanding' && rem === 0) return false
    if (filter === 'complete' && (rem > 0 || !s.linkedinPostsDue)) return false
    if (filter === 'none' && s.linkedinPostsDue != null) return false
    if (q.trim()) {
      const hay = `${s.companyName} ${s.tier ?? ''} ${s.contactFirstName ?? ''} ${s.contactLastName ?? ''} ${s.contactEmail ?? ''}`.toLowerCase()
      if (!hay.includes(q.trim().toLowerCase())) return false
    }
    return true
  })

  return (
    <WorkspacePage title="Sponsor posts" description={`LinkedIn posts each ${year} sponsor package includes, and how many have gone out. Allowances arrive with the onboarding form; edit them here any time.`}>
      {data?.error ? (
        <MigrationNotice message={data.error} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Sponsors" value={counts.companies} loading={isLoading} hint={counts.unset ? `${counts.unset} without an allowance yet` : 'All have an allowance'} />
            <Stat label="Posts included" value={counts.due} loading={isLoading} hint="Across every package" />
            <Stat label="Posts made" value={counts.done} loading={isLoading} hint={counts.due ? `${Math.round((Math.min(counts.done, counts.due) / counts.due) * 100)}% of what is included` : ''} />
            <Stat label="Still owed" value={counts.owed} loading={isLoading} hint={`${counts.owedCompanies} ${counts.owedCompanies === 1 ? 'company' : 'companies'} waiting`} />
          </div>

          <div className="ws-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--fg-4)' }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sponsors…" className="ws-input pl-9" />
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
                title={rows.length === 0 ? `No sponsors in the ${year} edition yet` : 'No matches'}
                body={rows.length === 0 ? 'Sponsors arrive here when their onboarding form is approved in the admin panel, or from the Sales pipeline.' : 'Try another filter.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="ws-table w-full">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th style={{ width: 150 }}>Stage</th>
                      <th style={{ width: 100 }} className="text-center">Included</th>
                      <th style={{ width: 100 }} className="text-center">Made</th>
                      <th style={{ width: 200 }}>Progress</th>
                      <th style={{ width: 110 }}>Onboarded</th>
                      <th style={{ width: 120 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading
                      ? [0, 1, 2, 3, 4].map((i) => (
                          <tr key={i}>{[0, 1, 2, 3, 4, 5, 6].map((c) => <td key={c}><div className="h-4 rounded animate-pulse" style={{ background: 'var(--surface-3)', width: c === 0 ? '60%' : '70%' }} /></td>)}</tr>
                        ))
                      : shown.map((s) => {
                          const due = s.linkedinPostsDue ?? null
                          const done = Number(s.linkedinPostsDone ?? 0)
                          const rem = sponsorRemaining(s)
                          const pct = due ? Math.min(100, Math.round((done / due) * 100)) : 0
                          const contact = `${s.contactFirstName ?? ''} ${s.contactLastName ?? ''}`.trim()
                          return (
                            <tr key={s.id}>
                              <td>
                                <span className="flex items-center gap-3 min-w-0">
                                  <Avatar src={s.logoUrl} name={s.companyName || '?'} />
                                  <span className="min-w-0">
                                    <Link href={`/sponsors/${s.id}`} className="block font-medium truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{s.companyName}</Link>
                                    <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[s.tier, contact].filter(Boolean).join(' · ') || s.contactEmail || '—'}</span>
                                  </span>
                                </span>
                              </td>
                              <td><StagePill kind="sponsor" status={s.status} /></td>
                              <td className="text-center"><Count value={due} onSave={(n) => patch(s.id, { linkedinPostsDue: n })} placeholder="set" /></td>
                              <td className="text-center"><Count value={done} onSave={(n) => patch(s.id, { linkedinPostsDone: n ?? 0 })} /></td>
                              <td>
                                {due ? (
                                  <span className="flex items-center gap-2.5">
                                    <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                                      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: rem === 0 ? 'var(--ok)' : 'var(--accent)' }} />
                                    </span>
                                    {rem === 0 ? <Tone tone="ok">Complete</Tone> : <Tone tone="accent">{rem} owed</Tone>}
                                  </span>
                                ) : (
                                  <span className="text-[12.5px]" style={{ color: 'var(--fg-4)' }}>No allowance set</span>
                                )}
                              </td>
                              <td className="tabular" style={{ color: 'var(--fg-3)' }}>{s.onboardedAt ? timeAgo(s.onboardedAt) : '—'}</td>
                              <td className="text-right">
                                <button className="ws-btn ws-btn-sm" onClick={() => setLogging(s)} title="Record a post as made and put it on the timeline">
                                  <Megaphone className="w-3.5 h-3.5" /> Log post
                                </button>
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
          title={`LinkedIn post · ${logging.companyName}`}
          subtitle={`${sponsorRemaining(logging)} still owed after this one is logged.`.replace(/^(\d+)/, (m) => String(Math.max(0, Number(m) - 1)))}
          onClose={() => setLogging(null)}
          onSave={(url, note) => logPost(logging.id, url, note)}
        />
      )}
    </WorkspacePage>
  )
}
