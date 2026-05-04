'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Trash2, Mail, Phone, Linkedin, MapPin, Building2,
  Briefcase, Tag, Globe, ChevronRight,
} from 'lucide-react'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { DelegateFormModal } from '@/components/crm/DelegateFormModal'
import type { Delegate } from '@/types'

async function fetchDelegate(id: string) {
  const res = await fetch(`/api/delegates/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export default function DelegateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: delegate, isLoading, error, refetch } = useQuery<Delegate & { activities: any[] }>({
    queryKey: ['delegate', id],
    queryFn: () => fetchDelegate(id),
  })

  const handleDelete = async () => {
    if (!confirm('Delete this delegate? This cannot be undone.')) return
    setDeleting(true)
    try {
      await fetch(`/api/delegates/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['delegates'] })
      router.push('/delegates')
    } finally {
      setDeleting(false)
    }
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

  if (error || !delegate) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="text-red-400 mb-4">Delegate not found.</div>
        <Link href="/delegates" className="text-[#00B4D8] text-sm hover:underline">← Back to Delegates</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/delegates" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Delegates
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-300">{delegate.firstName} {delegate.lastName}</span>
      </nav>

      {/* Hero */}
      <div className="whai-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#00B4D8]/20 text-[#00B4D8] flex items-center justify-center text-xl font-bold shrink-0">
          {delegate.firstName?.[0]}{delegate.lastName?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start flex-wrap gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">{delegate.firstName} {delegate.lastName}</h1>
            <StatusBadge value={delegate.status} variant="delegate_status" />
            {delegate.ticketType && <StatusBadge value={delegate.ticketType} variant="ticket_type" />}
          </div>
          {delegate.jobTitle && <div className="text-sm text-slate-300">{delegate.jobTitle}</div>}
          {delegate.organization && <div className="text-sm text-slate-500">{delegate.organization}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1a3a5c] text-slate-300 hover:text-white hover:border-slate-500 text-sm transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact info */}
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Contact Information</h2>
            <div className="space-y-3">
              {delegate.email && (
                <InfoRow icon={Mail} label="Email">
                  <a href={`mailto:${delegate.email}`} className="text-[#00B4D8] hover:underline">{delegate.email}</a>
                </InfoRow>
              )}
              {delegate.phone && <InfoRow icon={Phone} label="Phone"><span>{delegate.phone}</span></InfoRow>}
              {(delegate.city || delegate.country) && (
                <InfoRow icon={MapPin} label="Location">
                  <span>{[delegate.city, delegate.country].filter(Boolean).join(', ')}</span>
                </InfoRow>
              )}
              {delegate.organization && <InfoRow icon={Building2} label="Organisation"><span>{delegate.organization}</span></InfoRow>}
              {delegate.jobTitle && <InfoRow icon={Briefcase} label="Job Title"><span>{delegate.jobTitle}</span></InfoRow>}
              {delegate.linkedinUrl && (
                <InfoRow icon={Linkedin} label="LinkedIn">
                  <a href={delegate.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[#00B4D8] hover:underline truncate">View Profile</a>
                </InfoRow>
              )}
            </div>
          </div>

          {/* Event details */}
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Event Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Status" value={<StatusBadge value={delegate.status} variant="delegate_status" />} />
              <DetailField label="Ticket Type" value={delegate.ticketType ? <StatusBadge value={delegate.ticketType} variant="ticket_type" /> : '—'} />
              <DetailField label="Event" value={delegate.event ?? '—'} />
              <DetailField label="Delegate Type" value={delegate.subType ?? '—'} />
              <DetailField label="Source" value={delegate.source ?? '—'} />
              <DetailField label="Dietary Requirements" value={delegate.dietaryRequirements ?? '—'} />
              <DetailField label="Accessibility Needs" value={delegate.accessibilityNeeds ?? '—'} />
              <DetailField label="Added" value={new Date(delegate.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
            </div>
          </div>

          {/* Bio */}
          {delegate.bio && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Bio</h2>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{delegate.bio}</p>
            </div>
          )}

          {/* Notes */}
          {delegate.notes && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Notes</h2>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{delegate.notes}</p>
            </div>
          )}

          {/* Tags */}
          {delegate.tags && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" /> Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {delegate.tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-[#112850] text-slate-300 text-xs border border-[#1a3a5c]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Activity feed */}
        <div className="space-y-4">
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Activity</h2>
            <ActivityFeed
              activities={delegate.activities ?? []}
              entityType="delegate"
              entityId={id}
              onActivityAdded={refetch}
            />
          </div>
        </div>
      </div>

      {editOpen && (
        <DelegateFormModal
          delegate={delegate}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); refetch() }}
        />
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
