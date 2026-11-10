'use client'

// Event → Enquired: everyone who enquired about the open edition (the admin
// panel's inbox: enquiries and agenda requests filed under it), newest
// first, each with the conversation: what they wrote, the team's note, and
// every reply sent from the admin panel. A row opens to it. Who is already
// in the CRM says so, with the stage they are at and a way to their record;
// replying and moving someone into the CRM stay in the admin panel.

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, ChevronRight, CornerDownRight, ExternalLink, Inbox, Search } from 'lucide-react'
import type { Enquiry } from '@/app/api/enquiries/route'
import { Answered, fmt, typeLabel } from '@/components/crm/EnquiryCard'
import { KINDS } from '@/lib/recordKinds'
import { eventLook } from '@/lib/portals'
import { useWorkspace } from '@/lib/workspace'
import { Pagination } from '@/components/search/Pagination'
import { EmptyState, Segmented } from './ui'
import { WorkspacePage } from './WorkspacePage'

const ADMIN = 'https://www.worldnexusgroup.com/admin/contact'
const PAGE = 40
type Show = 'all' | 'waiting' | 'answered'
const answered = (e: Enquiry) => (e.kind === 'agenda' ? !!e.sentAt || e.status === 'rejected' : e.replies.length > 0 || !!e.respondedAt)

// The edition as the admin panel files it: "pharma-london-2027".
function useEditionSlug(): string | null {
  const { category, year } = useWorkspace()
  if (!category || !year) return null
  const look = eventLook(category.name)
  if (look.series !== 'World Pharma AI' && look.series !== 'World Health AI') return null
  return `${look.series === 'World Pharma AI' ? 'pharma' : 'health'}-${look.city.toLowerCase().replace(/[^a-z]+/g, '-')}-${year}`
}

function Row({ e }: { e: Enquiry }) {
  const [open, setOpen] = useState(false)
  const who = e.from.name || e.from.email || 'Unnamed'
  const subject = e.subject && ![(e.type || '').toLowerCase(), typeLabel(e.type).toLowerCase()].includes(e.subject.toLowerCase()) ? e.subject : null
  const preview = e.kind === 'agenda' ? 'Asked for the draft agenda.' : (e.message || '').replace(/\s+/g, ' ').trim()
  return (
    <li style={{ borderTop: '1px solid var(--line)' }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 sm:px-5 py-3 text-left transition-colors hover:bg-[var(--surface-2)]">
        {open ? <ChevronDown className="w-4 h-4 mt-1" style={{ color: 'var(--fg-4)' }} /> : <ChevronRight className="w-4 h-4 mt-1" style={{ color: 'var(--fg-4)' }} />}
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[13.5px] font-medium" style={{ color: 'var(--fg)' }}>{who}</span>
            {e.from.organisation && <span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{e.from.organisation}</span>}
          </span>
          <span className="block text-[12px] mt-0.5" style={{ color: 'var(--fg-4)' }}>
            <span style={{ color: 'var(--accent-ink)' }}>{typeLabel(e.type)}</span>{subject ? ` · ${subject}` : ''} · {fmt(e.receivedAt)}
          </span>
          {!open && preview && <span className="block text-[13px] mt-1 line-clamp-1" style={{ color: 'var(--fg-3)' }}>{preview}</span>}
        </span>
        <span className="col-start-2 sm:col-start-3 flex sm:flex-col items-center sm:items-end gap-x-3 gap-y-0.5 text-[12px] sm:text-right">
          <Answered e={e} />
          <span style={{ color: 'var(--fg-4)' }}>{e.crm ? `In the CRM · ${KINDS[e.crm.kind].label}${e.crm.status ? ` · ${KINDS[e.crm.kind].statusLabel(e.crm.status)}` : ''}` : 'Not in the CRM'}</span>
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 pl-11 sm:pl-12 flex flex-col gap-3">
          {/* What they wrote */}
          <div className="rounded-lg px-3.5 py-3" style={{ border: '1px solid var(--line)' }}>
            <p className="text-[12px]" style={{ color: 'var(--fg-3)' }}>{who} · {fmt(e.receivedAt)}{e.site ? ` · ${e.site}` : ''}{e.from.email ? <> · <a href={`mailto:${e.from.email}`} className="hover:underline underline-offset-4">{e.from.email}</a></> : null}</p>
            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap mt-1.5" style={{ color: 'var(--fg-2)' }}>
              {e.kind === 'agenda' ? `Asked for the draft agenda${e.event ? ` of ${e.event}` : ''}.` : e.message || 'No message.'}
            </p>
          </div>
          {e.teamNote && (
            <p className="text-[12.5px] rounded-lg px-3.5 py-2.5" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)' }}><span className="font-semibold">Team note: </span>{e.teamNote}</p>
          )}
          {/* What we wrote back, oldest first */}
          {e.replies.map((r) => (
            <div key={r.id} className="rounded-lg px-3.5 py-3 ml-4 sm:ml-8" style={{ border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
              <p className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--fg-3)' }}><CornerDownRight className="w-3.5 h-3.5" /> Our reply · {fmt(r.at)}{r.brand ? ` · as ${r.brand}` : ''}</p>
              <p className="text-[13px] font-medium mt-1" style={{ color: 'var(--fg)' }}>{r.subject}</p>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap mt-1" style={{ color: 'var(--fg-2)' }}>{r.body}</p>
            </div>
          ))}
          {!e.replies.length && e.kind === 'enquiry' && (
            <p className="text-[12.5px] ml-4 sm:ml-8" style={{ color: e.respondedAt ? 'var(--fg-3)' : 'var(--warn)' }}>
              {e.respondedAt ? `Marked as replied on ${fmt(e.respondedAt)}; the reply itself was sent outside the admin panel, so it is not kept here.` : 'Nobody has replied yet.'}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {e.crm && <Link href={`/${e.crm.kind}s/${e.crm.id}`} className="ws-btn ws-btn-sm">Open their CRM record</Link>}
            <a href={ADMIN} target="_blank" rel="noopener noreferrer" className="ws-btn ws-btn-sm ws-btn-ghost" style={{ color: 'var(--fg-3)' }}><ExternalLink className="w-3.5 h-3.5" /> Reply in the admin panel</a>
          </div>
        </div>
      )}
    </li>
  )
}

export function EnquiredView() {
  const { year } = useWorkspace()
  const edition = useEditionSlug()
  const [show, setShow] = useState<Show>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useQuery<{ enquiries: Enquiry[] }>({
    queryKey: ['ws-enquired', edition],
    queryFn: async () => {
      const r = await fetch(`/api/enquiries?edition=${edition}`)
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || 'Could not reach the admin panel’s inbox.')
      return r.json()
    },
    enabled: !!edition,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const all = useMemo(() => data?.enquiries ?? [], [data])
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((e) => (show === 'all' || answered(e) === (show === 'answered')) &&
      (!q || `${e.from.name ?? ''} ${e.from.email ?? ''} ${e.from.organisation ?? ''} ${e.message ?? ''} ${e.subject ?? ''}`.toLowerCase().includes(q)))
  }, [all, show, query])
  const waiting = all.filter((e) => !answered(e)).length
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)
  return (
    <WorkspacePage
      title="Enquired"
      description={`Everyone who enquired about the ${year} edition, newest first, with what they wrote and what we wrote back. Open one to read the conversation.`}
      actions={<a href={ADMIN} target="_blank" rel="noopener noreferrer" className="ws-btn"><ExternalLink className="w-4 h-4" /> Open the inbox</a>}
    >
      <div className="ws-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <Segmented size="sm" value={show} onChange={(v) => { setShow(v); setPage(1) }} options={[
            { value: 'all', label: <span className="inline-flex items-center gap-1.5">All<span className="tabular" style={{ color: 'var(--fg-4)' }}>{all.length}</span></span> },
            { value: 'waiting', label: <span className="inline-flex items-center gap-1.5">No reply yet<span className="tabular" style={{ color: waiting ? 'var(--warn)' : 'var(--fg-4)' }}>{waiting}</span></span> },
            { value: 'answered', label: <span className="inline-flex items-center gap-1.5">Replied<span className="tabular" style={{ color: 'var(--fg-4)' }}>{all.length - waiting}</span></span> },
          ]} />
          <label className="relative flex-1 min-w-[180px] max-w-[320px] ml-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-4)' }} />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="Search names, companies or messages…" className="ws-input" style={{ paddingLeft: 34 }} />
          </label>
        </div>
        {!edition ? <EmptyState icon={Inbox} title="No inbox for this event" body="Enquiries are kept for World Health AI and World Pharma AI editions." /> :
         error ? <EmptyState icon={AlertTriangle} title="Couldn’t load the enquiries" body={(error as Error).message} /> :
         isLoading ? <div className="flex flex-col gap-2 p-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div> :
         rows.length === 0 ? <EmptyState icon={Inbox} title="Nobody here" body={query ? 'Try another search.' : show === 'waiting' ? 'Every enquiry has a reply.' : 'No enquiries for this edition yet.'} /> : (
          <ul>{shown.map((e) => <Row key={`${e.kind}-${e.id}`} e={e} />)}</ul>
        )}
        {rows.length > PAGE && <div className="px-4 py-3" style={{ borderTop: '1px solid var(--line)' }}><Pagination page={page} totalPages={Math.ceil(rows.length / PAGE)} total={rows.length} pageSize={PAGE} onPage={setPage} /></div>}
      </div>
    </WorkspacePage>
  )
}
