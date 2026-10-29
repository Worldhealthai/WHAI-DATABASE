'use client'

// The Event area's first screen: the edition's bookings exactly as the
// Nexus admin panel holds them (GET /api/registrations), so what the team
// sees here is what the admin panel shows. Each booking says how it is
// filed in the CRM and links there. Approving, rejecting and editing stay in
// the admin panel; they sync into the CRM records.

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ClipboardList, ExternalLink, Search } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { Pagination } from '@/components/search/Pagination'
import { EmptyState, Initials, Segmented, timeAgo } from './ui'
import { WaveBand } from './WaveBand'
import { WorkspacePage } from './WorkspacePage'

interface Booking {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  company: string | null
  job_position: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | string
  attendee_type: string | null
  inquiry_type: string | null
  payment_status: string | null
  ticket_name: string | null
  source_site: string | null
  created_at: string
  crm: { kind: 'speaker' | 'delegate'; id: string; status: string | null } | null
}

const STATUS_LABEL: Record<string, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' }
const STATUS_INK: Record<string, string> = { pending: 'var(--warn)', approved: 'var(--ok)', rejected: 'var(--bad)', cancelled: 'var(--fg-4)' }

const role = (b: Booking) => (/^speaker/.test(b.attendee_type || '') ? 'Speaker' : 'Delegate')
const companyType = (b: Booking) => (/solution_provider$/.test(b.attendee_type || '') ? 'Solution Provider' : /end_user$/.test(b.attendee_type || '') ? 'End User' : null)
// The pass, as the CRM files it (lib/crm on the Nexus side).
const pass = (b: Booking) => (/^sponsor /i.test(b.inquiry_type || '') ? 'Sponsor' : companyType(b) === 'Solution Provider' ? (b.payment_status === 'paid' ? 'Ticket' : 'Complimentary') : null)

const PAGE = 50

export function RegistrationsView() {
  const { labels, year } = useWorkspace()
  const { data, isLoading, error } = useQuery<{ data: Booking[]; admin: string }>({
    queryKey: ['ws-registrations', labels],
    queryFn: async () => {
      const p = new URLSearchParams()
      labels.forEach((l) => p.append('events', l))
      const r = await fetch(`/api/registrations?${p}`)
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || 'Could not reach the admin panel’s bookings.')
      return r.json()
    },
    enabled: labels.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [who, setWho] = useState<'all' | 'Delegate' | 'Speaker'>('all')
  const [type, setType] = useState<'all' | 'Solution Provider' | 'End User'>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const all = useMemo(() => data?.data ?? [], [data])
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((b) =>
      (status === 'all' || b.status === status) && (who === 'all' || role(b) === who) && (type === 'all' || companyType(b) === type) &&
      (!q || `${b.first_name ?? ''} ${b.last_name ?? ''} ${b.email ?? ''} ${b.company ?? ''}`.toLowerCase().includes(q)))
  }, [all, status, who, type, query])
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)
  const count = (f: (b: Booking) => boolean) => all.filter(f).length
  const reset = () => setPage(1)

  return (
    <WorkspacePage
      title="Registrations"
      description={`Every booking for the ${year} edition, as the admin panel has it. Approve, reject and edit there; the CRM follows.`}
      actions={data?.admin ? <a href={data.admin} target="_blank" rel="noopener noreferrer" className="ws-btn"><ExternalLink className="w-4 h-4" /> Open the admin panel</a> : null}
    >
      <div className="mb-4">
        <WaveBand
          loading={isLoading}
          items={[
            { label: 'Bookings', value: all.length, hint: `${count((b) => role(b) === 'Speaker')} speakers · ${count((b) => role(b) === 'Delegate')} delegates` },
            { label: 'Waiting for review', value: count((b) => b.status === 'pending') },
            { label: 'Approved', value: count((b) => b.status === 'approved'), hint: `${count((b) => b.payment_status === 'paid')} paid` },
            { label: 'Not in the CRM yet', value: count((b) => b.status === 'approved' && !b.crm), hint: 'Approved, not filed' },
          ]}
        />
      </div>
      <div className="ws-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <label className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-4)' }} />
            <input value={query} onChange={(e) => { setQuery(e.target.value); reset() }} placeholder="Search names, emails or companies…" className="ws-input" style={{ paddingLeft: 34 }} />
          </label>
          <Segmented size="sm" value={status} onChange={(v) => { setStatus(v); reset() }} options={[{ value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
          <Segmented size="sm" value={type} onChange={(v) => { setType(v); reset() }} options={[{ value: 'all', label: 'Any company' }, { value: 'Solution Provider', label: 'Solution providers' }, { value: 'End User', label: 'End users' }]} />
          <Segmented size="sm" value={who} onChange={(v) => { setWho(v); reset() }} options={[{ value: 'all', label: 'Everyone' }, { value: 'Delegate', label: 'Delegates' }, { value: 'Speaker', label: 'Speakers' }]} />
          <span className="ml-auto text-[12.5px] tabular" style={{ color: 'var(--fg-4)' }}>{rows.length.toLocaleString()} shown</span>
        </div>
        {error ? <EmptyState icon={AlertTriangle} title="Couldn’t load the bookings" body={(error as Error).message} /> :
         isLoading ? <div className="flex flex-col gap-2 p-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-11 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div> :
         rows.length === 0 ? <EmptyState icon={ClipboardList} title={all.length ? 'No bookings match' : `No bookings for ${year} yet`} body={all.length ? 'Try another filter, or clear the search.' : 'Bookings made on the website appear here as they come in.'} /> : (
          <div className="overflow-x-auto">
            <table className="ws-table w-full min-w-[980px]">
              <thead><tr><th>Person</th><th>Company</th><th>Booked as</th><th>Pass</th><th>Admin panel</th><th>In the CRM</th><th className="text-right">Booked</th></tr></thead>
              <tbody>
                {shown.map((b) => {
                  const name = `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim() || b.email || 'Unnamed'
                  return (
                    <tr key={b.id}>
                      <td>
                        <span className="flex items-center gap-3 min-w-0">
                          <Initials name={name} size={30} />
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{name}</span>
                            <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[b.job_position, b.email].filter(Boolean).join(' · ') || '—'}</span>
                          </span>
                        </span>
                      </td>
                      <td className="text-[13px] truncate max-w-[200px]" style={{ color: 'var(--fg-2)' }}>{b.company || '—'}</td>
                      <td className="text-[13px]" style={{ color: 'var(--fg-2)' }}>{role(b)}{companyType(b) ? <span style={{ color: 'var(--fg-4)' }}> · {companyType(b)}</span> : null}</td>
                      <td className="text-[13px]" style={{ color: pass(b) ? 'var(--fg-2)' : 'var(--fg-4)' }}>{pass(b) ?? '—'}</td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: 'var(--fg-2)' }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: STATUS_INK[b.status] ?? 'var(--fg-4)' }} />
                          {STATUS_LABEL[b.status] ?? b.status}
                        </span>
                      </td>
                      <td className="text-[12.5px]">
                        {b.crm ? (
                          <Link href={`/${b.crm.kind}s/${b.crm.id}`} className="hover:underline underline-offset-4" style={{ color: 'var(--accent-ink)' }}>
                            {b.crm.kind === 'speaker' ? 'Speaker' : 'Delegate'}{b.crm.status ? ` · ${b.crm.status}` : ''}
                          </Link>
                        ) : <span style={{ color: 'var(--fg-4)' }}>{b.status === 'approved' ? 'Not filed' : '—'}</span>}
                      </td>
                      <td className="text-right text-[12.5px]" style={{ color: 'var(--fg-4)' }}>{timeAgo(b.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > PAGE && <div className="px-4 py-3"><Pagination page={page} totalPages={Math.ceil(rows.length / PAGE)} total={rows.length} pageSize={PAGE} onPage={setPage} onPageSize={() => {}} /></div>}
      </div>
    </WorkspacePage>
  )
}
