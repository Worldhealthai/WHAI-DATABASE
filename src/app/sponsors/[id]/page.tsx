'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Trash2, Mail, Phone, Linkedin, MapPin, Globe,
  Briefcase, Tag, Building2, ChevronRight, DollarSign, UserPlus, Pencil, Check, ArrowRightLeft, Search, X,
} from 'lucide-react'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { SponsorFormModal } from '@/components/crm/SponsorFormModal'
import { SponsorContactModal } from '@/components/crm/SponsorContactModal'
import type { Sponsor, SponsorContact } from '@/types'
import { cn } from '@/lib/utils'

const SPONSOR_STAGES = ['Not Contacted', 'Emailed', 'In Discussion', 'Confirmed']

function PipelineProgress({ currentStatus, accentHex, onStageChange, saving }: {
  currentStatus: string; accentHex: string; onStageChange: (s: string) => void; saving: boolean
}) {
  const isRejected = currentStatus === 'Rejected'
  const currentIdx = SPONSOR_STAGES.indexOf(currentStatus)

  return (
    <div className="whai-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pipeline Stage</span>
        {isRejected && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 font-medium">
            Rejected
          </span>
        )}
      </div>
      <div className="flex items-center gap-0">
        {SPONSOR_STAGES.map((stage, i) => {
          const isDone = currentIdx > i
          const isCurrent = currentIdx === i
          return (
            <div key={stage} className="flex items-center flex-1">
              <button
                onClick={() => !saving && onStageChange(stage)}
                disabled={saving}
                className={cn(
                  'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all w-full text-center disabled:cursor-not-allowed',
                  isCurrent ? 'bg-[#112850]' : 'hover:bg-[#0d2040]'
                )}
              >
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                    isDone ? 'border-transparent text-[#0A1628]' : isCurrent ? 'border-current' : 'border-slate-700 text-slate-700'
                  )}
                  style={isDone ? { background: accentHex } : isCurrent ? { borderColor: accentHex, color: accentHex } : {}}
                >
                  {isDone ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={cn(
                  'text-[10px] font-medium leading-tight whitespace-nowrap',
                  isCurrent ? 'text-white' : isDone ? 'text-slate-400' : 'text-slate-600'
                )}>
                  {stage}
                </span>
              </button>
              {i < SPONSOR_STAGES.length - 1 && (
                <div
                  className="h-0.5 flex-1 shrink-0 transition-all duration-500 mx-1"
                  style={{ background: isDone ? accentHex : '#1a3a5c' }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
      refetch()
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/sponsors" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Sponsors
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-300">{sponsor.companyName}</span>
      </nav>

      <div className="whai-card overflow-hidden">
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b80 0%, #f59e0b20 60%, transparent 100%)' }} />
        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold shrink-0">
            {sponsor.companyName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start flex-wrap gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{sponsor.companyName}</h1>
              {sponsor.tier && <StatusBadge value={sponsor.tier} variant="sponsor_tier" />}
              <StatusBadge value={sponsor.status} variant="sponsor_status" />
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {sponsor.website && (
                <a href={sponsor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors">
                  <Globe className="w-3 h-3" /> {sponsor.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {(sponsor.city || sponsor.country) && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-700/40 border border-slate-700 text-slate-400 text-xs">
                  <MapPin className="w-3 h-3" /> {[sponsor.city, sponsor.country].filter(Boolean).join(', ')}
                </span>
              )}
              {sponsor.event && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/8 border border-amber-500/15 text-amber-400/80 text-xs">
                  {sponsor.event}
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

      <PipelineProgress
        currentStatus={sponsor.status}
        accentHex="#f59e0b"
        onStageChange={handleStageChange}
        saving={stageSaving}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Sponsorship details */}
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Sponsorship Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Status" value={<StatusBadge value={sponsor.status} variant="sponsor_status" />} />
              {sponsor.tier && <DetailField label="Tier" value={<StatusBadge value={sponsor.tier} variant="sponsor_tier" />} />}
              <DetailField
                label="Sponsorship Value"
                value={sponsor.valueAmount
                  ? <span className="font-semibold text-amber-400">{sponsor.valueCurrency ?? 'GBP'} {Number(sponsor.valueAmount).toLocaleString()}</span>
                  : '—'
                }
              />
              <DetailField label="Added" value={new Date(sponsor.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <DetailField label="Last Updated" value={new Date(sponsor.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
            </div>

            {sponsor.packageDetails && (
              <div className="mt-4 pt-4 border-t border-[#1a3a5c]">
                <div className="text-xs text-slate-500 mb-2">Package Details</div>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{sponsor.packageDetails}</p>
              </div>
            )}
          </div>

          {/* Primary contact */}
          {(sponsor.contactFirstName || sponsor.contactLastName || sponsor.contactEmail) && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Primary Contact</h2>
              <div className="space-y-3">
                {(sponsor.contactFirstName || sponsor.contactLastName) && (
                  <InfoRow icon={Building2} label="Name">
                    <span>{[sponsor.contactFirstName, sponsor.contactLastName].filter(Boolean).join(' ')}</span>
                  </InfoRow>
                )}
                {sponsor.contactJobTitle && <InfoRow icon={Briefcase} label="Title"><span>{sponsor.contactJobTitle}</span></InfoRow>}
                {sponsor.contactEmail && (
                  <InfoRow icon={Mail} label="Email">
                    <a href={`mailto:${sponsor.contactEmail}`} className="text-amber-400 hover:underline">{sponsor.contactEmail}</a>
                  </InfoRow>
                )}
                {sponsor.contactPhone && <InfoRow icon={Phone} label="Phone"><span>{sponsor.contactPhone}</span></InfoRow>}
                {sponsor.contactLinkedinUrl && (
                  <InfoRow icon={Linkedin} label="LinkedIn">
                    <a href={sponsor.contactLinkedinUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">View Profile</a>
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
                {sponsor.contacts && sponsor.contacts.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-500">({sponsor.contacts.length + (sponsor.contactFirstName || sponsor.contactLastName ? 1 : 0)})</span>
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
              {(sponsor.contactFirstName || sponsor.contactLastName || sponsor.contactEmail) && (
                <ContactCard
                  name={[sponsor.contactFirstName, sponsor.contactLastName].filter(Boolean).join(' ')}
                  jobTitle={sponsor.contactJobTitle}
                  email={sponsor.contactEmail}
                  phone={sponsor.contactPhone}
                  linkedinUrl={sponsor.contactLinkedinUrl}
                  isPrimary
                  onClick={() => setEditingContact({
                    id: sponsor.id, companyId: sponsor.id,
                    contactFirstName: sponsor.contactFirstName, contactLastName: sponsor.contactLastName,
                    contactEmail: sponsor.contactEmail, contactPhone: sponsor.contactPhone,
                    contactJobTitle: sponsor.contactJobTitle, contactLinkedinUrl: sponsor.contactLinkedinUrl,
                    notes: null, createdAt: sponsor.createdAt,
                  })}
                  onEdit={() => setEditingContact({
                    id: sponsor.id, companyId: sponsor.id,
                    contactFirstName: sponsor.contactFirstName, contactLastName: sponsor.contactLastName,
                    contactEmail: sponsor.contactEmail, contactPhone: sponsor.contactPhone,
                    contactJobTitle: sponsor.contactJobTitle, contactLinkedinUrl: sponsor.contactLinkedinUrl,
                    notes: null, createdAt: sponsor.createdAt,
                  })}
                  onMove={() => setMovingContact({
                    isPrimary: true,
                    contact: {
                      id: sponsor.id, companyId: sponsor.id,
                      contactFirstName: sponsor.contactFirstName, contactLastName: sponsor.contactLastName,
                      contactEmail: sponsor.contactEmail, contactPhone: sponsor.contactPhone,
                      contactJobTitle: sponsor.contactJobTitle, contactLinkedinUrl: sponsor.contactLinkedinUrl,
                      notes: null, createdAt: sponsor.createdAt,
                    },
                  })}
                />
              )}
              {/* Linked contacts */}
              {sponsor.contacts?.map((c) => (
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
              {!sponsor.contactFirstName && !sponsor.contactLastName && !sponsor.contactEmail && (!sponsor.contacts || sponsor.contacts.length === 0) && (
                <p className="text-sm text-slate-500">No contacts yet. Add the first one.</p>
              )}
            </div>
          </div>

          {/* Notes */}
          {sponsor.notes && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Notes</h2>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{sponsor.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Activity</h2>
            <ActivityFeed activities={sponsor.activities ?? []} entityType="sponsor" entityId={id} onActivityAdded={refetch} />
          </div>
        </div>
      </div>

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
        onClick && 'cursor-pointer hover:border-amber-500/30 hover:bg-[#0d1f3a]'
      )}
      onClick={onClick}
    >
      <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
        {name ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{name || '—'}</span>
          {isPrimary && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/20">Primary</span>}
        </div>
        {jobTitle && <div className="text-xs text-slate-500 mt-0.5">{jobTitle}</div>}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {email && <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} className="text-xs text-amber-400 hover:underline">{email}</a>}
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
          <button onClick={onEdit} className="text-slate-600 hover:text-amber-400 transition-colors p-1">
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

  const sponsors = (data?.data ?? [])
    .filter((s) => s.id !== currentSponsorId)
    .filter((s) => !query.trim() || s.companyName.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d2040] border border-[#1a3a5c] rounded-xl shadow-2xl mt-16" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a3a5c]">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-400" /> Move Contact
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
              className="w-full pl-8 pr-3 py-2 bg-[#0A1628] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500/60 transition-colors"
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
                <div className="text-sm font-medium text-white truncate">{s.companyName}</div>
                {(s.city || s.country) && <div className="text-xs text-slate-500 truncate">{[s.city, s.country].filter(Boolean).join(', ')}</div>}
              </div>
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
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
