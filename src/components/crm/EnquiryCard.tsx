'use client'

// "From an enquiry" on a record: the enquiries (and agenda requests) behind
// it, as the admin panel's inbox holds them (GET /api/enquiries): what was
// asked, when and where, the team's note, and every reply sent from the
// admin panel, oldest first, or that none has been sent.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, CornerDownRight, Inbox } from 'lucide-react'
import type { Enquiry } from '@/app/api/enquiries/route'

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const TYPE: Record<string, string> = { sponsorship: 'Sponsorship', speaker: 'Speaking', speaking: 'Speaking', delegate: 'Attending', partnership: 'Partnership', media: 'Media', general: 'General' }
const typeLabel = (t: string | null) => (t ? TYPE[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1) : 'Enquiry')

export function useEnquiries(kind: string, id: string) {
  return useQuery<{ enquiries: Enquiry[] }>({
    queryKey: ['enquiries', kind, id],
    queryFn: async () => {
      const r = await fetch(`/api/enquiries?kind=${kind}&id=${id}`)
      if (!r.ok) throw new Error('enquiries')
      return r.json()
    },
    staleTime: 60_000,
  })
}

function Answered({ e }: { e: Enquiry }) {
  if (e.kind === 'agenda') {
    return e.sentAt
      ? <span style={{ color: 'var(--ok)' }}>Agenda sent {fmt(e.sentAt)}</span>
      : <span style={{ color: e.status === 'rejected' ? 'var(--bad)' : 'var(--warn)' }}>{e.status === 'rejected' ? 'Turned down' : 'Agenda not sent yet'}</span>
  }
  if (e.replies.length) return <span style={{ color: 'var(--ok)' }}>Replied {e.replies.length > 1 ? `${e.replies.length} times, last ` : ''}{fmt(e.replies[e.replies.length - 1].at)}</span>
  if (e.respondedAt) return <span style={{ color: 'var(--ok)' }}>Marked replied {fmt(e.respondedAt)}</span>
  return <span style={{ color: 'var(--warn)' }}>No reply yet</span>
}

function One({ e, startOpen }: { e: Enquiry; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <li style={{ borderTop: '1px solid var(--line)' }}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-start gap-2 px-5 py-3 text-left transition-colors hover:bg-[var(--surface-2)]" aria-expanded={open}>
        {open ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--fg-4)' }} /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--fg-4)' }} />}
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium" style={{ color: 'var(--fg)' }}>
            {typeLabel(e.type)}{e.subject && ![(e.type || '').toLowerCase(), typeLabel(e.type).toLowerCase()].includes(e.subject.toLowerCase()) ? ` · ${e.subject}` : ''}
          </span>
          <span className="block text-[12px]" style={{ color: 'var(--fg-3)' }}>
            {fmt(e.receivedAt)}{e.site ? ` · ${e.site}` : ''}{e.event ? ` · ${e.event}` : ''}
          </span>
        </span>
        <span className="text-[12px] shrink-0 mt-0.5"><Answered e={e} /></span>
      </button>
      {open && (
        <div className="px-5 pb-4 pl-11 flex flex-col gap-3">
          {e.message ? (
            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--fg-2)' }}>{e.message}</p>
          ) : e.kind === 'agenda' ? (
            <p className="text-[13px]" style={{ color: 'var(--fg-3)' }}>Asked for the draft agenda{e.event ? ` of ${e.event}` : ''}.</p>
          ) : (
            <p className="text-[13px]" style={{ color: 'var(--fg-4)' }}>No message.</p>
          )}
          {e.teamNote && (
            <p className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)' }}>
              <span className="font-semibold">Team note: </span>{e.teamNote}
            </p>
          )}
          {e.replies.map((r) => (
            <div key={r.id} className="rounded-lg px-3 py-2.5" style={{ border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
              <p className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--fg-3)' }}>
                <CornerDownRight className="w-3.5 h-3.5" /> Our reply · {fmt(r.at)}{r.brand ? ` · as ${r.brand}` : ''}
              </p>
              <p className="text-[13px] font-medium mt-1" style={{ color: 'var(--fg)' }}>{r.subject}</p>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap mt-1" style={{ color: 'var(--fg-2)' }}>{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

export function EnquiryCard({ kind, id }: { kind: string; id: string }) {
  const { data, isLoading } = useEnquiries(kind, id)
  const list = data?.enquiries ?? []
  if (isLoading || !list.length) return null
  const unanswered = list.filter((e) => e.kind === 'enquiry' && !e.replies.length && !e.respondedAt).length
  return (
    <section className="ws-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: 'var(--fg)' }}>
          <Inbox className="w-4 h-4" style={{ color: 'var(--fg-4)' }} /> From {list.length === 1 ? 'an enquiry' : `${list.length} enquiries`}
        </h2>
        {unanswered > 0 && <span className="text-[12px] font-medium" style={{ color: 'var(--warn)' }}>{unanswered} without a reply</span>}
      </div>
      <ul>
        {list.map((e, i) => <One key={`${e.kind}-${e.id}`} e={e} startOpen={i === 0} />)}
      </ul>
    </section>
  )
}
