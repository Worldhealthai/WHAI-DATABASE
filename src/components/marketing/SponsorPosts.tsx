'use client'

// Sponsor posts for one edition: every sponsor company, the LinkedIn posts
// its package includes (set when the onboarding form is approved), how many
// have gone out, and what is still owed. Counts are edited in the row;
// "Log post" records one on the company's timeline.

import { useMemo, useState } from 'react'
import { ExternalLink, Megaphone, Search, SearchX } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import type { Sponsor } from '@/types'
import { EmptyState, Segmented, Stat, StagePill, timeAgo } from '@/components/workspace/ui'
import { SponsorFormModal } from '@/components/crm/SponsorFormModal'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { Avatar, LogPostModal, MigrationNotice, Tone, isConfirmedSponsor, sponsorRemaining, useMarketing, useMarketingActions } from './shared'

type Filter = 'all' | 'outstanding' | 'complete' | 'none'
type Scope = 'confirmed' | 'everyone'

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
  const { patch, logPost, refresh } = useMarketingActions('sponsor')
  const [scope, setScope] = useState<Scope>('confirmed')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [logging, setLogging] = useState<Sponsor | null>(null)
  const [editing, setEditing] = useState<Sponsor | null>(null)

  const everyone = data?.data ?? []
  const rows = useMemo(() => (scope === 'confirmed' ? everyone.filter(isConfirmedSponsor) : everyone), [everyone, scope])
  const unconfirmed = everyone.length - everyone.filter(isConfirmedSponsor).length
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
    <WorkspacePage
      title="Sponsor posts"
      description={`LinkedIn posts each ${year} sponsor package includes, and how many have gone out. Allowances arrive with the onboarding form; edit them here any time.`}
      actions={
        <Segmented
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'confirmed', label: 'Confirmed sponsors', hint: 'Deals that are done' },
            { value: 'everyone', label: `Every stage${unconfirmed ? ` (+${unconfirmed})` : ''}`, hint: 'Including companies still in the pipeline' },
          ]}
        />
      }
    >
      {data?.error ? (
        <MigrationNotice message={data.error} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label={scope === 'confirmed' ? 'Confirmed sponsors' : 'Sponsors'} value={counts.companies} loading={isLoading} hint={counts.unset ? `${counts.unset} without an allowance yet` : 'All have an allowance'} />
            <Stat label="Posts included" value={counts.due} loading={isLoading} hint="Across every package" />
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
                title={rows.length === 0 ? (scope === 'confirmed' ? `No confirmed sponsors in the ${year} edition yet` : `No sponsors in the ${year} edition yet`) : 'No matches'}
                body={rows.length === 0 ? (scope === 'confirmed' && unconfirmed ? `${unconfirmed} ${unconfirmed === 1 ? 'company is' : 'companies are'} still in the pipeline — switch to Every stage to see them.` : 'Sponsors arrive here when their onboarding form is approved in the admin panel, or from the Sales pipeline.') : 'Try another filter.'}
              />
            ) : (
              <div>
                <table className="ws-table ws-table-fixed w-full">
                  <colgroup>
                    <col />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 84 }} />
                    <col style={{ width: 76 }} />
                    <col style={{ width: 190 }} />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 112 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Stage</th>
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
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5 min-w-0">
                                      <button type="button" onClick={() => setEditing(s)} title="Edit this sponsor" className="font-medium truncate text-left hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{s.companyName}</button>
                                      <a href={`/sponsors/${s.id}`} target="_blank" rel="noreferrer" title="Open the full profile in a new tab" className="shrink-0 opacity-50 hover:opacity-100" style={{ color: 'var(--fg-3)' }}><ExternalLink className="w-3 h-3" /></a>
                                    </span>
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
      {editing && <SponsorFormModal sponsor={editing} entityLabel="Sponsor" onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
    </WorkspacePage>
  )
}
