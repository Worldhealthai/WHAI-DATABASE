'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Trash2, Mail, Phone, Linkedin, MapPin, Globe,
  Briefcase, Tag, Building2, ChevronRight, UserPlus, Pencil, ArrowRightLeft, Search, X,
} from 'lucide-react'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { SponsorFormModal } from '@/components/crm/SponsorFormModal'
import { SponsorContactModal } from '@/components/crm/SponsorContactModal'
import type { Sponsor, SponsorContact } from '@/types'
import { cn } from '@/lib/utils'

async function fetchPartner(id: string) {
  const res = await fetch(`/api/sponsors/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<SponsorContact | null>(null)
  const [movingContact, setMovingContact] = useState<{ contact: SponsorContact; isPrimary: boolean } | null>(null)
  const [moveLoading, setMoveLoading] = useState(false)

  const { data: partner, isLoading, error, refetch } = useQuery<Sponsor & { activities: any[]; contacts: SponsorContact[] }>({
    queryKey: ['partner', id],
    queryFn: () => fetchPartner(id),
  })

  const handleMoveContact = async (targetId: string, targetName: string) => {
    if (!movingContact || !partner) return
    setMoveLoading(true)
    try {
      if (movingContact.isPrimary) {
        await fetch('/api/sponsors', {
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
        await fetch(`/api/sponsors/${movingContact.contact.id}`, {
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
      await fetch(`/api/sponsors/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      router.push('/partners')
    } finally { setDeleting(false) }
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/partners" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Partners & Media
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-300">{partner.companyName}</span>
      </nav>

      {/* Header card */}
      <div className="whai-card overflow-hidden">
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #10b98180 0%, #10b98120 60%, transparent 100%)' }} />
        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold shrink-0">
            {partner.companyName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start flex-wrap gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{partner.companyName}</h1>
              {partner.tier && <StatusBadge value={partner.tier} variant="sponsor_tier" />}
              <StatusBadge value={partner.status} variant="sponsor_status" />
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {partner.website && (
                <a href={partner.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors">
                  <Globe className="w-3 h-3" /> {partner.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {(partner.city || partner.country) && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-700/40 border border-slate-700 text-slate-400 text-xs">
                  <MapPin className="w-3 h-3" /> {[partner.city, partner.country].filter(Boolean).join(', ')}
                </span>
              )}
              {partner.event && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/15 text-emerald-400/80 text-xs">
                  {partner.event}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1a3a5c] text-slate-300 hover:text-white hover:border-slate-500 text-sm transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Partner details */}
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Partner Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Status" value={<StatusBadge value={partner.status} variant="sponsor_status" />} />
              {partner.tier && <DetailField label="Type" value={<StatusBadge value={partner.tier} variant="sponsor_tier" />} />}
              <DetailField label="Added" value={new Date(partner.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <DetailField label="Last Updated" value={new Date(partner.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
            </div>

            {partner.packageDetails && (
              <div className="mt-4 pt-4 border-t border-[#1a3a5c]">
                <div className="text-xs text-slate-500 mb-2">Package Details</div>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{partner.packageDetails}</p>
              </div>
            )}
          </div>

          {/* Primary contact */}
          {(partner.contactFirstName || partner.contactLastName || partner.contactEmail) && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Primary Contact</h2>
              <div className="space-y-3">
                {(partner.contactFirstName || partner.contactLastName) && (
                  <InfoRow icon={Building2} label="Name">
                    <span>{[partner.contactFirstName, partner.contactLastName].filter(Boolean).join(' ')}</span>
                  </InfoRow>
                )}
                {partner.contactJobTitle && <InfoRow icon={Briefcase} label="Title"><span>{partner.contactJobTitle}</span></InfoRow>}
                {partner.contactEmail && (
                  <InfoRow icon={Mail} label="Email">
                    <a href={`mailto:${partner.contactEmail}`} className="text-emerald-400 hover:underline">{partner.contactEmail}</a>
                  </InfoRow>
                )}
                {partner.contactPhone && <InfoRow icon={Phone} label="Phone"><span>{partner.contactPhone}</span></InfoRow>}
                {partner.contactLinkedinUrl && (
                  <InfoRow icon={Linkedin} label="LinkedIn">
                    <a href={partner.contactLinkedinUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">View Profile</a>
                  </InfoRow>
                )}
              </div>
            </div>
          )}

          {/* Contacts */}
          <div className="whai-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">
                Contacts
                {partner.contacts && partner.contacts.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-500">({partner.contacts.length + (partner.contactFirstName || partner.contactLastName ? 1 : 0)})</span>
                )}
              </h2>
              <button
                onClick={() => setAddContactOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1a3a5c] text-slate-400 hover:text-white hover:border-slate-500 text-xs transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add Contact
              </button>
            </div>
            <div className="space-y-3">
              {/* Embedded primary contact */}
              {(partner.contactFirstName || partner.contactLastName || partner.contactEmail) && (
                <ContactCard
                  name={[partner.contactFirstName, partner.contactLastName].filter(Boolean).join(' ')}
                  jobTitle={partner.contactJobTitle}
                  email={partner.contactEmail}
                  phone={partner.contactPhone}
                  linkedinUrl={partner.contactLinkedinUrl}
                  isPrimary
                  onClick={() => setEditingContact({
                    id: partner.id, companyId: partner.id,
                    contactFirstName: partner.contactFirstName, contactLastName: partner.contactLastName,
                    contactEmail: partner.contactEmail, contactPhone: partner.contactPhone,
                    contactJobTitle: partner.contactJobTitle, contactLinkedinUrl: partner.contactLinkedinUrl,
                    notes: null, createdAt: partner.createdAt,
                  })}
                  onEdit={() => setEditingContact({
                    id: partner.id, companyId: partner.id,
                    contactFirstName: partner.contactFirstName, contactLastName: partner.contactLastName,
                    contactEmail: partner.contactEmail, contactPhone: partner.contactPhone,
                    contactJobTitle: partner.contactJobTitle, contactLinkedinUrl: partner.contactLinkedinUrl,
                    notes: null, createdAt: partner.createdAt,
                  })}
                  onMove={() => setMovingContact({
                    isPrimary: true,
                    contact: {
                      id: partner.id, companyId: partner.id,
                      contactFirstName: partner.contactFirstName, contactLastName: partner.contactLastName,
                      contactEmail: partner.contactEmail, contactPhone: partner.contactPhone,
                      contactJobTitle: partner.contactJobTitle, contactLinkedinUrl: partner.contactLinkedinUrl,
                      notes: null, createdAt: partner.createdAt,
                    },
                  })}
                />
              )}
              {/* Linked contacts */}
              {partner.contacts?.map((c) => (
                <ContactCard
                  key={c.id}
                  name={[c.contactFirstName, c.contactLastName].filter(Boolean).join(' ')}
                  jobTitle={c.contactJobTitle}
                  email={c.contactEmail}
                  phone={c.contactPhone}
                  linkedinUrl={c.contactLinkedinUrl}
                  onClick={() => setEditingContact(c)}
                  onEdit={() => setEditingContact(c)}
                  onMove={() => setMovingContact({ contact: c, isPrimary: false })}
                  onDelete={async () => {
                    if (!confirm('Remove this contact?')) return
                    await fetch(`/api/sponsors/${c.id}`, { method: 'DELETE' })
                    refetch()
                  }}
                />
              ))}
              {!partner.contactFirstName && !partner.contactLastName && !partner.contactEmail && (!partner.contacts || partner.contacts.length === 0) && (
                <p className="text-sm text-slate-500">No contacts yet. Add the first one.</p>
              )}
            </div>
          </div>


          {/* Notes */}
          {partner.notes && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Notes</h2>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{partner.notes}</p>
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="space-y-4">
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Activity</h2>
            <ActivityFeed activities={partner.activities ?? []} entityType="sponsor" entityId={id} onActivityAdded={refetch} />
          </div>
        </div>
      </div>

      {/* Modals */}
      {addContactOpen && (
        <SponsorContactModal
          companyId={id}
          companyName={partner.companyName}
          onClose={() => setAddContactOpen(false)}
          onSaved={() => { setAddContactOpen(false); refetch() }}
        />
      )}
      {editingContact && (
        <SponsorContactModal
          companyId={id}
          companyName={partner.companyName}
          contact={editingContact}
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
    </div>
  )
}

function ContactCard({ name, jobTitle, email, phone, linkedinUrl, isPrimary, onClick, onEdit, onMove, onDelete }: {
  name: string; jobTitle?: string | null; email?: string | null
  phone?: string | null; linkedinUrl?: string | null; isPrimary?: boolean
  onClick?: () => void; onEdit?: () => void; onMove?: () => void; onDelete?: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg bg-[#0A1628] border border-[#1a3a5c] transition-colors group/card',
        onClick && 'cursor-pointer hover:border-emerald-500/30 hover:bg-[#0d1f3a]'
      )}
      onClick={onClick}
    >
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
        {name ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{name || '—'}</span>
          {isPrimary && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">Primary</span>}
        </div>
        {jobTitle && <div className="text-xs text-slate-500 mt-0.5">{jobTitle}</div>}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {email && <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} className="text-xs text-emerald-400 hover:underline">{email}</a>}
          {phone && <span className="text-xs text-slate-400">{phone}</span>}
          {linkedinUrl && <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-slate-500 hover:text-slate-300">LinkedIn ↗</a>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        {onMove && (
          <button onClick={onMove} className="text-slate-600 hover:text-blue-400 transition-colors p-1" title="Move to another company">
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>
        )}
        {onEdit && (
          <button onClick={onEdit} className="text-slate-600 hover:text-emerald-400 transition-colors p-1">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="text-slate-600 hover:text-red-400 transition-colors p-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
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

  const companies = (data?.data ?? [])
    .filter((s) => s.id !== currentSponsorId)
    .filter((s) => !query.trim() || s.companyName.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d2040] border border-[#1a3a5c] rounded-xl shadow-2xl mt-16" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a3a5c]">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" /> Move Contact
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Moving <span className="text-slate-300">{contactName}</span> to a new company</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 border-b border-[#1a3a5c]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies…"
              className="w-full pl-8 pr-3 py-2 bg-[#0A1628] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/60 transition-colors"
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
                <div className="text-sm font-medium text-white truncate">{s.companyName}</div>
                {(s.city || s.country) && <div className="text-xs text-slate-500 truncate">{[s.city, s.country].filter(Boolean).join(', ')}</div>}
              </div>
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0" />
            </button>
          ))}
        </div>

        {loading && (
          <div className="px-5 py-3 border-t border-[#1a3a5c] text-xs text-slate-400 text-center">Moving contact…</div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500 mb-0.5">{label}</div>
        <div className="text-sm text-slate-200">{children}</div>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  )
}
