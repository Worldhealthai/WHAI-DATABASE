'use client'

// Event → Registrations: the edition's bookings exactly as the Nexus admin
// panel lists them (GET /api/registrations reads its registrations table,
// in the same database): Approved first, with Pending, Rejected and
// Cancelled as queues, and attending or speaking. One more queue, Added in
// the CRM, holds the people filed here with no booking behind them
// (imported, typed in, moved from an enquiry). Every row opens its CRM
// record. Approving and rejecting stay in the admin panel; the speaker
// board shows the speakers still waiting as its Applied column.

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ClipboardList, ExternalLink, Search } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { Pagination } from '@/components/search/Pagination'
import { EmptyState, Initials, Segmented, timeAgo } from './ui'
import { WorkspacePage } from './WorkspacePage'

export interface Booking {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  company: string | null
  job_position: string | null
  status: string
  attendee_type: string | null
  inquiry_type: string | null
  payment_status: string | null
  pass?: string | null
  created_at: string
  crm: { kind: 'speaker' | 'delegate'; id: string; status: string | null } | null
}

export const isSpeakerBooking = (b: Booking) => /^speaker/.test(b.attendee_type || '')
export const bookingCompanyType = (b: Booking) => (/solution_provider$/.test(b.attendee_type || '') ? 'Solution Provider' : /end_user$/.test(b.attendee_type || '') ? 'End User' : null)
export const bookingName = (b: Booking) => `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim() || b.email || 'Unnamed'

function useBookings() {
  const { labels } = useWorkspace()
  return useQuery<{ data: Booking[]; added: Booking[]; admin: string }>({
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
}

// The edition's bookings still waiting for approval in the admin panel.
export function usePendingBookings() {
  const q = useBookings()
  const pending = (q.data?.data ?? []).filter((b) => b.status === 'pending')
  return { pending, admin: q.data?.admin ?? null, isLoading: q.isLoading }
}

// The pass, as the CRM files it (lib/crm on the Nexus side).
const pass = (b: Booking) => b.pass ?? (/^sponsor /i.test(b.inquiry_type || '') ? 'Sponsor' : bookingCompanyType(b) === 'Solution Provider' ? (b.payment_status === 'paid' ? 'Ticket' : 'Complimentary') : null)

type Queue = 'approved' | 'pending' | 'rejected' | 'cancelled' | 'crm'
const QUEUES: { key: Queue; label: string }[] = [
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'crm', label: 'Added in the CRM' },
]
const PAGE = 50

export function RegistrationsView() {
  const { year } = useWorkspace()
  const { data, isLoading, error } = useBookings()
  const [queue, setQueue] = useState<Queue>('approved')
  const [who, setWho] = useState<'all' | 'delegate' | 'speaker'>('all')
  const [type, setType] = useState<'all' | 'Solution Provider' | 'End User'>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const all = useMemo(() => [...(data?.data ?? []), ...(data?.added ?? [])], [data])
  const inQueue = (b: Booking, q: Queue) => (q === 'crm' ? b.status === 'crm' : b.status === q)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((b) =>
      inQueue(b, queue) && (who === 'all' || isSpeakerBooking(b) === (who === 'speaker')) && (type === 'all' || bookingCompanyType(b) === type) &&
      (!q || `${bookingName(b)} ${b.email ?? ''} ${b.company ?? ''}`.toLowerCase().includes(q)))
  }, [all, queue, who, type, query])
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)
  const count = (q: Queue) => all.filter((b) => inQueue(b, q)).length
  const reset = () => setPage(1)

  return (
    <WorkspacePage
      title="Registrations"
      description={`Everyone coming to the ${year} edition, as the admin panel lists them, plus anyone added in the CRM. Approve and reject in the admin panel; it updates here.`}
      actions={data?.admin ? <a href={data.admin} target="_blank" rel="noopener noreferrer" className="ws-btn"><ExternalLink className="w-4 h-4" /> Open the admin panel</a> : null}
    >
      <div className="ws-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <Segmented
            size="sm"
            value={queue}
            onChange={(v) => { setQueue(v); reset() }}
            options={QUEUES.map((q) => ({
              value: q.key,
              label: <span className="inline-flex items-center gap-1.5">{q.label}<span className="tabular" style={{ color: q.key === 'pending' && count('pending') ? 'var(--warn)' : 'var(--fg-4)' }}>{count(q.key)}</span></span>,
            }))}
          />
          <Segmented size="sm" value={who} onChange={(v) => { setWho(v); reset() }} options={[{ value: 'all', label: 'All' }, { value: 'delegate', label: 'Attending' }, { value: 'speaker', label: 'Speaking' }]} />
          <Segmented size="sm" value={type} onChange={(v) => { setType(v); reset() }} options={[{ value: 'all', label: 'Any company' }, { value: 'Solution Provider', label: 'Solution providers' }, { value: 'End User', label: 'End users' }]} />
          <label className="relative flex-1 min-w-[180px] max-w-[300px] ml-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-4)' }} />
            <input value={query} onChange={(e) => { setQuery(e.target.value); reset() }} placeholder="Search names, emails or companies…" className="ws-input" style={{ paddingLeft: 34 }} />
          </label>
        </div>
        {error ? <EmptyState icon={AlertTriangle} title="Couldn’t load the registrations" body={(error as Error).message} /> :
         isLoading ? <div className="flex flex-col gap-2 p-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-11 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div> :
         rows.length === 0 ? <EmptyState icon={ClipboardList} title="No one here" body={query ? 'Try another search.' : 'Nobody in this queue for the edition.'} /> : (
          <div className="overflow-x-auto">
            <table className="ws-table w-full min-w-[900px]">
              <thead><tr><th>Person</th><th>Company</th><th>Type</th><th>Pass</th><th>Stage</th><th className="text-right">{queue === 'crm' ? 'Added' : 'Booked'}</th></tr></thead>
              <tbody>
                {shown.map((b) => {
                  const name = bookingName(b)
                  const href = b.crm ? `/${b.crm.kind}s/${b.crm.id}` : null
                  return (
                    <tr key={b.id}>
                      <td>
                        {href ? (
                          <Link href={href} className="flex items-center gap-3 min-w-0">
                            <Initials name={name} size={30} />
                            <span className="min-w-0">
                              <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{name}</span>
                              <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[b.job_position, b.email].filter(Boolean).join(' · ') || '—'}</span>
                            </span>
                          </Link>
                        ) : (
                          <span className="flex items-center gap-3 min-w-0">
                            <Initials name={name} size={30} />
                            <span className="min-w-0">
                              <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{name}</span>
                              <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[b.job_position, b.email].filter(Boolean).join(' · ') || '—'}</span>
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="text-[13px] truncate max-w-[200px]" style={{ color: 'var(--fg-2)' }}>{b.company || '—'}</td>
                      <td className="text-[13px] whitespace-nowrap" style={{ color: 'var(--fg-2)' }}>{bookingCompanyType(b) ?? '—'}<span style={{ color: 'var(--fg-4)' }}> · {isSpeakerBooking(b) ? 'Speaking' : 'Attending'}</span></td>
                      <td className="text-[13px]" style={{ color: pass(b) ? 'var(--fg-2)' : 'var(--fg-4)' }}>{pass(b) ?? '—'}</td>
                      <td className="text-[12.5px] whitespace-nowrap" style={{ color: b.crm ? 'var(--fg-2)' : 'var(--fg-4)' }}>{b.crm?.status ?? (b.status === 'approved' ? 'Not filed yet' : '—')}</td>
                      <td className="text-right text-[12.5px] whitespace-nowrap" style={{ color: 'var(--fg-4)' }}>{timeAgo(b.created_at)}</td>
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
