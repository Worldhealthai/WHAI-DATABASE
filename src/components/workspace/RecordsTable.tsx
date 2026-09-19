'use client'

// One clean table for any kind of record. Speakers and delegates belong to
// an edition; sponsors and partners are companies that come back year after
// year, so their tables show every company and the pipeline holds the
// per-year work.
// Search, a stage filter, sorting, paging, an inline stage change on each
// row, and the existing forms for adding and editing.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, Plus, Search, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import { KINDS, STATUS_OPTIONS, changeStage, listParams, recordName, recordSubtitle, type RecordKind } from '@/lib/recordKinds'
import { editionLabel } from '@/lib/portals'
import { Pagination } from '@/components/search/Pagination'
import { SponsorFormModal } from '@/components/crm/SponsorFormModal'
import { SpeakerFormModal } from '@/components/crm/SpeakerFormModal'
import { DelegateFormModal } from '@/components/crm/DelegateFormModal'
import { EmptyState, Initials, StageDot, StagePill, formatMoney, timeAgo } from './ui'
import { WorkspacePage } from './WorkspacePage'

type Row = Record<string, any>

interface Column {
  key: string
  label: string
  sortable?: boolean
  width?: string
  render: (r: Row) => React.ReactNode
}

function columnsFor(kind: RecordKind, onStage: (r: Row, to: string) => void, busyId: string | null, showEdition: boolean): Column[] {
  const def = KINDS[kind]
  const stageCell = (r: Row) => (
    <span className="relative inline-flex items-center">
      <select
        value={r.status}
        disabled={busyId === r.id}
        onChange={(e) => onStage(r, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        aria-label="Change stage"
      >
        {STATUS_OPTIONS[kind].map((s) => <option key={s} value={s}>{def.statusLabel(s)}</option>)}
      </select>
      <span className={cn('pointer-events-none', busyId === r.id && 'opacity-50')}><StagePill kind={kind} status={r.status} /></span>
      <ChevronDown className="w-3 h-3 ml-1 pointer-events-none" style={{ color: 'var(--fg-4)' }} />
    </span>
  )
  const nameCell = (r: Row) => {
    const name = recordName(kind, r)
    return (
      <span className="flex items-center gap-3 min-w-0">
        <Initials name={name || '?'} size={34} />
        <span className="min-w-0">
          <span className="block font-medium truncate" style={{ color: 'var(--fg)' }}>{name || 'Unnamed'}</span>
          <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{recordSubtitle(kind, r) || (r.email ?? r.contactEmail ?? '—')}</span>
        </span>
      </span>
    )
  }
  const added: Column = { key: 'createdAt', label: 'Added', sortable: true, width: '90px', render: (r) => <span className="tabular" style={{ color: 'var(--fg-3)' }}>{timeAgo(r.createdAt)}</span> }
  // "World Health AI London 2027" → "London 2027": the series is the workspace.
  const edition: Column = { key: 'event', label: 'Edition', sortable: true, width: '130px', render: (r) => <span style={{ color: r.event ? 'var(--fg-2)' : 'var(--fg-4)' }}>{r.event ? String(r.event).replace(/^World (Health|Pharma) AI\s*/i, '') : '—'}</span> }

  if (kind === 'sponsor' || kind === 'partner') {
    return [
      { key: 'companyName', label: 'Company', sortable: true, render: nameCell },
      { key: 'tier', label: kind === 'partner' ? 'Type' : 'Tier', sortable: true, width: '160px', render: (r) => <span style={{ color: r.tier ? 'var(--fg-2)' : 'var(--fg-4)' }}>{r.tier || '—'}</span> },
      ...(showEdition ? [edition] : []),
      { key: 'status', label: 'Stage', sortable: true, width: '170px', render: stageCell },
      { key: 'valueAmount', label: 'Value', sortable: true, width: '110px', render: (r) => <span className="tabular font-medium" style={{ color: r.valueAmount ? 'var(--fg)' : 'var(--fg-4)' }}>{formatMoney(r.valueAmount, r.valueCurrency || 'GBP')}</span> },
      { key: 'contactEmail', label: 'Email', width: '200px', render: (r) => <span className="truncate block max-w-[200px]" style={{ color: 'var(--fg-3)' }}>{r.contactEmail || '—'}</span> },
      added,
    ]
  }
  if (kind === 'speaker') {
    return [
      { key: 'lastName', label: 'Speaker', sortable: true, render: nameCell },
      { key: 'status', label: 'Stage', sortable: true, width: '190px', render: stageCell },
      { key: 'subType', label: 'Type', sortable: true, width: '130px', render: (r) => <span style={{ color: r.subType ? 'var(--fg-2)' : 'var(--fg-4)' }}>{r.subType || '—'}</span> },
      { key: 'sessionType', label: 'Session', width: '120px', render: (r) => <span style={{ color: r.sessionType ? 'var(--fg-2)' : 'var(--fg-4)' }}>{r.sessionType || '—'}</span> },
      { key: 'email', label: 'Email', width: '200px', render: (r) => <span className="truncate block max-w-[200px]" style={{ color: 'var(--fg-3)' }}>{r.email || '—'}</span> },
      added,
    ]
  }
  return [
    { key: 'lastName', label: 'Delegate', sortable: true, render: nameCell },
    { key: 'status', label: 'Status', sortable: true, width: '160px', render: stageCell },
    { key: 'subType', label: 'Type', sortable: true, width: '130px', render: (r) => <span style={{ color: r.subType ? 'var(--fg-2)' : 'var(--fg-4)' }}>{r.subType || '—'}</span> },
    { key: 'ticketType', label: 'Ticket', width: '120px', render: (r) => <span style={{ color: r.ticketType ? 'var(--fg-2)' : 'var(--fg-4)' }}>{r.ticketType || '—'}</span> },
    { key: 'email', label: 'Email', width: '200px', render: (r) => <span className="truncate block max-w-[200px]" style={{ color: 'var(--fg-3)' }}>{r.email || '—'}</span> },
    added,
  ]
}

export function RecordsTable({ kind }: { kind: RecordKind }) {
  // Companies are not tied to a year; people are.
  const allEditions = kind === 'sponsor' || kind === 'partner'
  const ws = useWorkspace()
  const def = KINDS[kind]
  const queryClient = useQueryClient()
  const router = useRouter()
  const { labels, category, year } = ws

  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  // Edition changes reset the paging; a filter that made sense for one year
  // rarely does for another.
  useEffect(() => { setPage(1) }, [labels.join('|')])

  const { data, isLoading, isFetching, refetch } = useQuery<{ data: Row[]; total: number; totalPages: number }>({
    queryKey: ['ws-list', kind, labels, query, status, page, pageSize, sortBy, sortDir],
    queryFn: async () => {
      const p = listParams(kind, allEditions ? [] : labels, { query, statuses: status ? [status] : undefined, page: String(page), pageSize: String(pageSize), sortBy, sortDir })
      const r = await fetch(`${def.api}?${p}`)
      if (!r.ok) throw new Error('list')
      return r.json()
    },
    enabled: allEditions || labels.length > 0,
    placeholderData: (prev) => prev,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0

  const onKeyword = (v: string) => {
    setKeyword(v)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { setQuery(v.trim()); setPage(1) }, 300)
  }
  const sort = (key: string) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir(key === 'createdAt' ? 'desc' : 'asc') }
  }
  const onStage = async (r: Row, to: string) => {
    if (r.status === to) return
    setBusyId(r.id)
    // Show the new stage at once; put it back if the save fails.
    queryClient.setQueriesData<{ data: Row[] }>({ queryKey: ['ws-list', kind] }, (old) =>
      old ? { ...old, data: old.data.map((x) => (x.id === r.id ? { ...x, status: to } : x)) } : old)
    const ok = await changeStage(kind, r.id, r.status, to)
    if (!ok) await refetch()
    queryClient.invalidateQueries({ queryKey: ['ws-stats'] })
    queryClient.invalidateQueries({ queryKey: ['ws-board'] })
    setBusyId(null)
  }
  const exportCsv = () => {
    const p = new URLSearchParams()
    // The sponsor/partner exports read `event`, the others `events`.
    const key = kind === 'sponsor' || kind === 'partner' ? 'event' : 'events'
    if (!allEditions) labels.forEach((l) => p.append(key, l))
    if (kind === 'sponsor') KINDS.sponsor.fixedParams.excludeTiers.forEach((t) => p.append('excludeTiers', t))
    if (status) p.append(kind === 'sponsor' || kind === 'partner' ? 'status' : 'statuses', status)
    const a = document.createElement('a')
    a.href = `${def.api}/export?${p}`
    a.download = `${def.plural.toLowerCase().replace(/[^a-z]+/g, '-')}-${allEditions ? 'all' : year}.csv`
    a.click()
  }

  const columns = columnsFor(kind, onStage, busyId, allEditions)
  const preset = category && year ? { event: editionLabel(category.name, year) } : {}
  const saved = () => { setAdding(false); refetch(); queryClient.invalidateQueries({ queryKey: ['ws-stats'] }) }

  return (
    <WorkspacePage
      title={def.plural}
      description={allEditions ? `Every ${kind === 'partner' ? 'partner and media' : 'sponsor'} company, across all editions. The year-by-year work lives in the pipeline.` : `${def.plural} for this edition.`}
      actions={
        <>
          <button onClick={exportCsv} className="ws-btn" title="Download this list as CSV"><Download className="w-4 h-4" /> Export</button>
          <button onClick={() => setAdding(true)} className="ws-btn ws-btn-primary"><Plus className="w-4 h-4" /> Add {def.label.toLowerCase()}</button>
        </>
      }
    >
      <div className="ws-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--fg-4)' }} />
            <input value={keyword} onChange={(e) => onKeyword(e.target.value)} placeholder={`Search ${def.plural.toLowerCase()}…`} className="ws-input pl-9" />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <button className="ws-chip" data-active={status === ''} onClick={() => { setStatus(''); setPage(1) }}>All</button>
            {def.stages.map((s) => (
              <button key={s.status} className="ws-chip" data-active={status === s.status} onClick={() => { setStatus(status === s.status ? '' : s.status); setPage(1) }}>
                <StageDot hex={s.hex} /> {s.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[12.5px] tabular whitespace-nowrap" style={{ color: 'var(--fg-3)' }}>
            {isLoading ? 'Loading…' : `${total.toLocaleString()} ${total === 1 ? 'record' : 'records'}`}{isFetching && !isLoading ? ' · updating' : ''}
          </span>
        </div>

        {/* Table */}
        {!isLoading && rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={query || status ? 'No matches' : allEditions ? `No ${def.plural.toLowerCase()} yet` : `No ${def.plural.toLowerCase()} in the ${year} edition yet`}
            body={query || status ? 'Try a different search or clear the stage filter.' : allEditions ? `Add the first ${def.label.toLowerCase()}, or start them in the pipeline.` : `Add the first ${def.label.toLowerCase()}, or pick another edition above.`}
            action={query || status ? <button onClick={() => { setKeyword(''); setQuery(''); setStatus('') }} className="ws-btn">Clear filters</button> : <button onClick={() => setAdding(true)} className="ws-btn ws-btn-primary"><Plus className="w-4 h-4" /> Add {def.label.toLowerCase()}</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ws-table w-full">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} style={{ width: c.width }}>
                      {c.sortable ? (
                        <button onClick={() => sort(c.key)} className="inline-flex items-center gap-1 hover:opacity-80">
                          {c.label}
                          {sortBy === c.key ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronsUpDown className="w-3 h-3 opacity-50" />}
                        </button>
                      ) : c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? [0, 1, 2, 3, 4, 5].map((i) => (
                      <tr key={i}>{columns.map((c) => <td key={c.key}><div className="h-4 rounded animate-pulse" style={{ background: 'var(--surface-3)', width: c.key === columns[0].key ? '60%' : '70%' }} /></td>)}</tr>
                    ))
                  : rows.map((r) => (
                      <tr key={r.id} className="cursor-pointer" onClick={() => router.push(`${def.detailPath}/${r.id}`)}>
                        {columns.map((c, i) => (
                          <td key={c.key} onClick={c.key === 'status' ? (e) => e.stopPropagation() : undefined}>
                            {i === 0 ? <Link href={`${def.detailPath}/${r.id}`} onClick={(e) => e.stopPropagation()} className="block">{c.render(r)}</Link> : c.render(r)}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="px-4 pb-3">
            <Pagination page={page} totalPages={data?.totalPages ?? 1} total={total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1) }} />
          </div>
        )}
      </div>

      {adding && (kind === 'sponsor' || kind === 'partner') && (
        <SponsorFormModal sponsor={preset} partnerMode={kind === 'partner'} entityLabel={def.label} onClose={() => setAdding(false)} onSaved={saved} />
      )}
      {adding && kind === 'speaker' && <SpeakerFormModal speaker={{ ...preset, year: year ? Number(year) : undefined }} onClose={() => setAdding(false)} onSaved={saved} />}
      {adding && kind === 'delegate' && <DelegateFormModal delegate={preset} onClose={() => setAdding(false)} onSaved={saved} />}
    </WorkspacePage>
  )
}

