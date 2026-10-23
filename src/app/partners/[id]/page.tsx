'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, ArrowRightLeft, Search, X } from 'lucide-react'
import { SponsorFormModal } from '@/components/crm/SponsorFormModal'
import { SponsorContactModal } from '@/components/crm/SponsorContactModal'
import { CompanyProfile } from '@/components/crm/CompanyProfile'
import type { Sponsor, SponsorContact } from '@/types'

async function fetchPartner(id: string) {
  const res = await fetch(`/api/partners/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [stageSaving, setStageSaving] = useState(false)
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<SponsorContact | null>(null)
  const [movingContact, setMovingContact] = useState<{ contact: SponsorContact; isPrimary: boolean } | null>(null)
  const [moveLoading, setMoveLoading] = useState(false)

  const { data: partner, isLoading, error, refetch } = useQuery<Sponsor & { activities: any[]; contacts: SponsorContact[] }>({
    queryKey: ['partner', id],
    queryFn: () => fetchPartner(id),
  })

  const { data: navData } = useQuery<{ data: { id: string; companyName: string }[] }>({
    queryKey: ['partners-nav'],
    queryFn: () => fetch('/api/partners?pageSize=1000&sortBy=createdAt&sortDir=desc').then(r => r.json()),
    staleTime: 60_000,
  })
  const navList = navData?.data ?? []
  const currentIdx = navList.findIndex(s => s.id === id)
  const prevItem = currentIdx > 0 ? navList[currentIdx - 1] : null
  const nextItem = currentIdx < navList.length - 1 ? navList[currentIdx + 1] : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' && prevItem) router.push(`/partners/${prevItem.id}`)
      if (e.key === 'ArrowRight' && nextItem) router.push(`/partners/${nextItem.id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevItem, nextItem, router])

  const handleMoveContact = async (targetId: string, targetName: string) => {
    if (!movingContact || !partner) return
    setMoveLoading(true)
    try {
      if (movingContact.isPrimary) {
        await fetch('/api/partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: targetId,
            companyName: targetName,
            status: 'Active',
            contactFirstName: partner.contactFirstName,
            contactLastName: partner.contactLastName,
            contactEmail: partner.contactEmail,
            contactPhone: partner.contactPhone,
            contactJobTitle: partner.contactJobTitle,
            contactLinkedinUrl: partner.contactLinkedinUrl,
          }),
        })
        await fetch(`/api/partners/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactFirstName: null, contactLastName: null,
            contactEmail: null, contactPhone: null,
            contactJobTitle: null, contactLinkedinUrl: null,
          }),
        })
      } else {
        await fetch(`/api/partners/${movingContact.contact.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: targetId, companyName: targetName }),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      await refetch()
      setMovingContact(null)
    } finally {
      setMoveLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this partner? This cannot be undone.')) return
    setDeleting(true)
    try {
      await fetch(`/api/partners/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      router.push('/partners')
    } finally { setDeleting(false) }
  }

  const handleStageChange = async (newStatus: string) => {
    if (!partner || newStatus === partner.status) return
    setStageSaving(true)
    try {
      await fetch(`/api/partners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      await refetch()
      // Confirmed: open the form so the value and package can be recorded.
      if (newStatus === 'Confirmed') setEditOpen(true)
    } finally { setStageSaving(false) }
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <div className="h-8 w-32 bg-slate-700/50 rounded animate-pulse" />
        <div className="h-24 bg-slate-700/30 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-80 bg-slate-700/30 rounded-xl animate-pulse" />
          <div className="h-80 bg-slate-700/30 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !partner) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="text-red-400 mb-4">Partner not found.</div>
        <Link href="/partners" className="text-emerald-400 text-sm hover:underline">← Back to Partners & Media</Link>
      </div>
    )
  }


  return (
    <>
      <CompanyProfile
        kind="partner"
        company={partner}
        nav={{ prev: prevItem, next: nextItem, index: currentIdx, total: navList.length }}
        onEdit={() => setEditOpen(true)}
        onDelete={handleDelete}
        deleting={deleting}
        onStageChange={handleStageChange}
        stageSaving={stageSaving}
        contacts={{
          onAdd: () => setAddContactOpen(true),
          onEdit: (c) => setEditingContact(c),
          onMove: (c, isPrimary) => setMovingContact({ contact: c, isPrimary }),
          onDelete: async (c) => {
            if (!confirm('Remove this contact?')) return
            await fetch(`/api/partners/${c.id}`, { method: 'DELETE' })
            refetch()
          },
        }}
        refetch={refetch}
      />
      {addContactOpen && (
        <SponsorContactModal
          companyId={id}
          companyName={partner.companyName}
          basePath="/api/partners"
          onClose={() => setAddContactOpen(false)}
          onSaved={() => { setAddContactOpen(false); refetch() }}
        />
      )}
      {editingContact && (
        <SponsorContactModal
          companyId={id}
          companyName={partner.companyName}
          contact={editingContact}
          basePath="/api/partners"
          onClose={() => setEditingContact(null)}
          onSaved={() => { setEditingContact(null); refetch() }}
          onSetPrimary={() => { setEditingContact(null); refetch() }}
        />
      )}
      {editOpen && (
        <SponsorFormModal
          sponsor={partner}
          entityLabel="Partner"
          keepTier
          partnerMode
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); refetch() }}
        />
      )}
      {movingContact && (
        <MoveContactModal
          contactName={[movingContact.contact.contactFirstName, movingContact.contact.contactLastName].filter(Boolean).join(' ') || 'Contact'}
          currentSponsorId={id}
          onClose={() => setMovingContact(null)}
          onMove={handleMoveContact}
          loading={moveLoading}
        />
      )}
    </>
  )
}

function MoveContactModal({ contactName, currentSponsorId, onClose, onMove, loading }: {
  contactName: string
  currentSponsorId: string
  onClose: () => void
  onMove: (targetId: string, targetName: string) => void
  loading: boolean
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data } = useQuery<{ data: Sponsor[] }>({
    queryKey: ['partners-all'],
    queryFn: () => fetch('/api/partners?pageSize=500').then((r) => r.json()),
    staleTime: 30_000,
  })

  const companies = (data?.data ?? [])
    .filter((s) => s.id !== currentSponsorId)
    .filter((s) => !query.trim() || s.companyName.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl mt-16" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--fg)] flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" /> Move Contact
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Moving <span className="text-slate-300">{contactName}</span> to a new company</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-[var(--fg)] transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 border-b border-[var(--line)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies…"
              className="w-full pl-8 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-sm text-[var(--fg)] placeholder-slate-500 outline-none focus:border-emerald-500/60 transition-colors"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {companies.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">{query ? 'No companies match your search.' : 'No other companies found.'}</p>
          )}
          {companies.map((s) => (
            <button
              key={s.id}
              onClick={() => onMove(s.id, s.companyName)}
              disabled={loading}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-emerald-500/10 transition-colors disabled:opacity-50 group"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                {s.companyName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--fg)] truncate">{s.companyName}</div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {s.event && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-slate-400 border border-[var(--line)] truncate max-w-[120px]">{s.event}</span>}
                  {s.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{s.status}</span>}
                  {typeof s.contactCount === 'number' && <span className="text-[10px] text-slate-500">{s.contactCount} contact{s.contactCount !== 1 ? 's' : ''}</span>}
                  {(s.city || s.country) && <span className="text-[10px] text-slate-500 truncate">{[s.city, s.country].filter(Boolean).join(', ')}</span>}
                </div>
              </div>
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0" />
            </button>
          ))}
        </div>

        {loading && (
          <div className="px-5 py-3 border-t border-[var(--line)] text-xs text-slate-400 text-center">Moving contact…</div>
        )}
      </div>
    </div>
  )
}

