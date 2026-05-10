'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Trash2, Mail, Phone, Linkedin, MapPin, Globe,
  Briefcase, Tag, Building2, ChevronRight, DollarSign, UserPlus,
} from 'lucide-react'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { SponsorFormModal } from '@/components/crm/SponsorFormModal'
import { SponsorContactModal } from '@/components/crm/SponsorContactModal'
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
  const [addContactOpen, setAddContactOpen] = useState(false)

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

  const tagList = sponsor.tags?.split(',').map((t) => t.trim()).filter(Boolean) ?? []

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/sponsors" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Sponsors
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-300">{sponsor.companyName}</span>
      </nav>

      <div className="whai-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold shrink-0">
          {sponsor.companyName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start flex-wrap gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">{sponsor.companyName}</h1>
            {sponsor.tier && <StatusBadge value={sponsor.tier} variant="sponsor_tier" />}
            <StatusBadge value={sponsor.status} variant="sponsor_status" />
          </div>
          {sponsor.website && (
            <a href={sponsor.website} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> {sponsor.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          {(sponsor.city || sponsor.country) && (
            <div className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" /> {[sponsor.city, sponsor.country].filter(Boolean).join(', ')}
            </div>
          )}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Sponsorship details */}
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Sponsorship Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Tier" value={sponsor.tier ? <StatusBadge value={sponsor.tier} variant="sponsor_tier" /> : '—'} />
              <DetailField label="Status" value={<StatusBadge value={sponsor.status} variant="sponsor_status" />} />
              <DetailField label="Contract Status" value={<StatusBadge value={sponsor.contractStatus ?? 'Not Started'} variant="contract_status" />} />
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

          {/* Tags */}
          {tagList.length > 0 && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-slate-400" /> Tags</h2>
              <div className="flex flex-wrap gap-2">
                {tagList.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-[#112850] text-slate-300 text-xs border border-[#1a3a5c]">{t}</span>
                ))}
              </div>
            </div>
          )}

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
      {editOpen && <SponsorFormModal sponsor={sponsor} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); refetch() }} />}
    </div>
  )
}

function ContactCard({ name, jobTitle, email, phone, linkedinUrl, isPrimary, onDelete }: {
  name: string; jobTitle?: string | null; email?: string | null
  phone?: string | null; linkedinUrl?: string | null; isPrimary?: boolean; onDelete?: () => void
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0A1628] border border-[#1a3a5c]">
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
          {email && <a href={`mailto:${email}`} className="text-xs text-amber-400 hover:underline">{email}</a>}
          {phone && <span className="text-xs text-slate-400">{phone}</span>}
          {linkedinUrl && <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300">LinkedIn ↗</a>}
        </div>
      </div>
      {onDelete && (
        <button onClick={onDelete} className="text-slate-600 hover:text-red-400 transition-colors p-1 shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
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
