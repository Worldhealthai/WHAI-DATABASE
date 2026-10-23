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

async function fetchSponsor(id: string) {
  const res = await fetch(`/api/sponsors/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export default function SponsorDetailPage() {
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

  const handleMoveContact = async (targetId: string, targetName: string) => {
    if (!movingContact || !sponsor) return
    setMoveLoading(true)
    try {
      if (movingContact.isPrimary) {
        // Create a linked contact on the target company with the primary contact's fields
        await fetch('/api/sponsors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: targetId,
            companyName: targetName,
            status: 'Active',
            contactFirstName: sponsor.contactFirstName,
            contactLastName: sponsor.contactLastName,
            contactEmail: sponsor.contactEmail,
            contactPhone: sponsor.contactPhone,
            contactJobTitle: sponsor.contactJobTitle,
            contactLinkedinUrl: sponsor.contactLinkedinUrl,
          }),
        })
        // Clear primary contact fields from this sponsor
        await fetch(`/api/sponsors/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactFirstName: null, contactLastName: null,
            contactEmail: null, contactPhone: null,
            contactJobTitle: null, contactLinkedinUrl: null,
          }),
        })
      } else {
        // Just update the companyId on the linked contact row
        await fetch(`/api/sponsors/${movingContact.contact.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: targetId, companyName: targetName }),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['sponsors'] })
      await refetch()
      setMovingContact(null)
    } finally {
      setMoveLoading(false)
    }
  }

  const { data: sponsor, isLoading, error, refetch } = useQuery<Sponsor & { activities: any[]; contacts: SponsorContact[] }>({
    queryKey: ['sponsor', id],
    queryFn: () => fetchSponsor(id),
  })

  // Build the prev/next nav query from the filters the user had applied in the
  // list view (saved to sessionStorage when they opened this profile), so
  // next/prev walks the filtered list — not the full unfiltered one.
  const navParams = (() => {
    const PARTNER_TIERS = ['Media Partner', 'Association Partner']
    const params = new URLSearchParams()
    params.set('pageSize', '1000')
    let sortBy = 'createdAt', sortDir = 'desc'
    try {
      const saved = typeof window !== 'undefined' ? sessionStorage.getItem('sponsors-list-state') : null
      if (saved) {
        const s = JSON.parse(saved)
        if (s.sortBy) sortBy = s.sortBy
        if (s.sortDir) sortDir = s.sortDir
        const f = s.filters ?? {}
        if (f.query) params.set('query', f.query)
        f.statuses?.forEach((v: string) => params.append('statuses', v))
        f.events?.forEach((v: string) => params.append('events', v))
        f.tiers?.forEach((v: string) => params.append('tiers', v))
        f.countries?.forEach((v: string) => params.append('countries', v))
      }
    } catch {}
    params.set('sortBy', sortBy)
    params.set('sortDir', sortDir)
    PARTNER_TIERS.forEach((t) => params.append('excludeTiers', t))
    return params.toString()
  })()

  // Fetch sponsor IDs for prev/next navigation, scoped to the active filters
  const { data: navData } = useQuery<{ data: { id: string; companyName: string }[] }>({
    queryKey: ['sponsors-nav', navParams],
    queryFn: () => fetch(`/api/sponsors?${navParams}`).then(r => r.json()),
    staleTime: 60_000,
  })
  const navList = navData?.data ?? []
  const currentIdx = navList.findIndex(s => s.id === id)
  const prevItem = currentIdx > 0 ? navList[currentIdx - 1] : null
  const nextItem = currentIdx < navList.length - 1 ? navList[currentIdx + 1] : null

  // Keyboard arrow navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' && prevItem) router.push(`/sponsors/${prevItem.id}`)
      if (e.key === 'ArrowRight' && nextItem) router.push(`/sponsors/${nextItem.id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevItem, nextItem, router])

  const handleDelete = async () => {
    if (!confirm('Delete this sponsor? This cannot be undone.')) return
    setDeleting(true)
    try {
      await fetch(`/api/sponsors/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['sponsors'] })
      router.push('/sponsors')
    } finally { setDeleting(false) }
  }

  const handleStageChange = async (newStatus: string) => {
    if (!sponsor || newStatus === sponsor.status) return
    setStageSaving(true)
    try {
      await fetch(`/api/sponsors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      queryClient.invalidateQueries({ queryKey: ['sponsors'] })
      await refetch()
      // Landing on Confirmed reveals the deal fields — open the form so the
      // sponsorship value and package can be recorded right away.
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

  if (error || !sponsor) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="text-red-400 mb-4">Sponsor not found.</div>
        <Link href="/sponsors" className="text-amber-400 text-sm hover:underline">← Back to Sponsors</Link>
      </div>
    )
  }


  return (
    <>
      <CompanyProfile
        kind="sponsor"
        company={sponsor}
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
            await fetch(`/api/sponsors/${c.id}`, { method: 'DELETE' })
            refetch()
          },
        }}
        refetch={refetch}
      />
      {addContactOpen && (
        <SponsorContactModal
          companyId={id}
          companyName={sponsor.companyName}
          onClose={() => setAddContactOpen(false)}
          onSaved={() => { setAddContactOpen(false); refetch() }}
        />
      )}
      {editingContact && (
        <SponsorContactModal
          companyId={id}
          companyName={sponsor.companyName}
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onSaved={() => { setEditingContact(null); refetch() }}
          onSetPrimary={() => { setEditingContact(null); refetch() }}
        />
      )}
      {editOpen && <SponsorFormModal sponsor={sponsor} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); refetch() }} />}
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
    queryKey: ['sponsors-all'],
    queryFn: () => fetch('/api/sponsors?pageSize=500').then((r) => r.json()),
    staleTime: 30_000,
  })

  const sponsors = (data?.data ?? [])
    .filter((s) => s.id !== currentSponsorId)
    .filter((s) => !query.trim() || s.companyName.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl mt-16" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--fg)] flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-400" /> Move Contact
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
              className="w-full pl-8 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-sm text-[var(--fg)] placeholder-slate-500 outline-none focus:border-amber-500/60 transition-colors"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {sponsors.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">{query ? 'No companies match your search.' : 'No other companies found.'}</p>
          )}
          {sponsors.map((s) => (
            <button
              key={s.id}
              onClick={() => onMove(s.id, s.companyName)}
              disabled={loading}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-amber-500/10 transition-colors disabled:opacity-50 group"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
                {s.companyName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--fg)] truncate">{s.companyName}</div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {s.event && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-slate-400 border border-[var(--line)] truncate max-w-[120px]">{s.event}</span>}
                  {s.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{s.status}</span>}
                  {typeof s.contactCount === 'number' && <span className="text-[10px] text-slate-500">{s.contactCount} contact{s.contactCount !== 1 ? 's' : ''}</span>}
                  {(s.city || s.country) && <span className="text-[10px] text-slate-500 truncate">{[s.city, s.country].filter(Boolean).join(', ')}</span>}
                </div>
              </div>
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
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

