'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Trash2, Mail, Phone, Linkedin, MapPin, Building2,
  Briefcase, Tag, Mic, ChevronRight, Plane, Hotel, DollarSign,
} from 'lucide-react'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { SpeakerFormModal } from '@/components/crm/SpeakerFormModal'
import type { Speaker } from '@/types'

async function fetchSpeaker(id: string) {
  const res = await fetch(`/api/speakers/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export default function SpeakerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: speaker, isLoading, error, refetch } = useQuery<Speaker & { activities: any[] }>({
    queryKey: ['speaker', id],
    queryFn: () => fetchSpeaker(id),
  })

  const handleDelete = async () => {
    if (!confirm('Delete this speaker? This cannot be undone.')) return
    setDeleting(true)
    try {
      await fetch(`/api/speakers/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['speakers'] })
      router.push('/speakers')
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

  if (error || !speaker) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="text-red-400 mb-4">Speaker not found.</div>
        <Link href="/speakers" className="text-purple-400 text-sm hover:underline">← Back to Speakers</Link>
      </div>
    )
  }

  const expertiseList = speaker.expertiseAreas?.split(',').map((e) => e.trim()).filter(Boolean) ?? []
  const tagList = speaker.tags?.split(',').map((t) => t.trim()).filter(Boolean) ?? []

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/speakers" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Speakers
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-300">{speaker.firstName} {speaker.lastName}</span>
      </nav>

      <div className="whai-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden">
          {speaker.headshotUrl
            ? <img src={speaker.headshotUrl} alt="" className="w-full h-full object-cover rounded-full" />
            : `${speaker.firstName?.[0]}${speaker.lastName?.[0]}`
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start flex-wrap gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">{speaker.firstName} {speaker.lastName}</h1>
            <StatusBadge value={speaker.status} variant="speaker_status" />
            {speaker.sessionType && <StatusBadge value={speaker.sessionType} variant="contract_status" />}
          </div>
          {speaker.jobTitle && <div className="text-sm text-slate-300">{speaker.jobTitle}</div>}
          {speaker.organization && <div className="text-sm text-slate-500">{speaker.organization}</div>}
          {speaker.sessionTitle && (
            <div className="flex items-center gap-1.5 mt-1.5 text-sm text-purple-400">
              <Mic className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium">{speaker.sessionTitle}</span>
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
          {/* Contact */}
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Contact Information</h2>
            <div className="space-y-3">
              {speaker.email && <InfoRow icon={Mail} label="Email"><a href={`mailto:${speaker.email}`} className="text-purple-400 hover:underline">{speaker.email}</a></InfoRow>}
              {speaker.phone && <InfoRow icon={Phone} label="Phone"><span>{speaker.phone}</span></InfoRow>}
              {(speaker.city || speaker.country) && <InfoRow icon={MapPin} label="Location"><span>{[speaker.city, speaker.country].filter(Boolean).join(', ')}</span></InfoRow>}
              {speaker.organization && <InfoRow icon={Building2} label="Organisation"><span>{speaker.organization}</span></InfoRow>}
              {speaker.jobTitle && <InfoRow icon={Briefcase} label="Job Title"><span>{speaker.jobTitle}</span></InfoRow>}
              {speaker.linkedinUrl && <InfoRow icon={Linkedin} label="LinkedIn"><a href={speaker.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">View Profile</a></InfoRow>}
            </div>
          </div>

          {/* Session */}
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Session & Contract</h2>
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Status" value={<StatusBadge value={speaker.status} variant="speaker_status" />} />
              <DetailField label="Session Type" value={speaker.sessionType ?? '—'} />
              <DetailField label="Event" value={speaker.event ?? '—'} />
              <DetailField label="Speaker Type" value={speaker.subType ?? '—'} />
              <DetailField label="Contract Status" value={<StatusBadge value={speaker.contractStatus ?? 'Not Started'} variant="contract_status" />} />
              <DetailField label="Fee Status" value={<StatusBadge value={speaker.feeStatus ?? 'Not Set'} variant="fee_status" />} />
              <DetailField label="Speaking Fee" value={speaker.fee ? `${speaker.feeCurrency ?? 'GBP'} ${Number(speaker.fee).toLocaleString()}` : 'Not set'} />
              <DetailField label="Added" value={new Date(speaker.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
            </div>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#1a3a5c]">
              <div className={`flex items-center gap-1.5 text-xs ${speaker.travelRequired ? 'text-amber-400' : 'text-slate-600'}`}>
                <Plane className="w-3.5 h-3.5" />
                {speaker.travelRequired ? 'Travel required' : 'No travel'}
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${speaker.hotelRequired ? 'text-blue-400' : 'text-slate-600'}`}>
                <Hotel className="w-3.5 h-3.5" />
                {speaker.hotelRequired ? 'Hotel required' : 'No hotel'}
              </div>
            </div>
          </div>

          {/* Session description */}
          {speaker.sessionDescription && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Session Description</h2>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{speaker.sessionDescription}</p>
            </div>
          )}

          {/* Bio */}
          {speaker.bio && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Bio</h2>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{speaker.bio}</p>
            </div>
          )}

          {/* Expertise */}
          {expertiseList.length > 0 && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Expertise Areas</h2>
              <div className="flex flex-wrap gap-2">
                {expertiseList.map((e) => (
                  <span key={e} className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-xs border border-purple-500/20">{e}</span>
                ))}
              </div>
            </div>
          )}

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
          {speaker.notes && (
            <div className="whai-card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Notes</h2>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{speaker.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="whai-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Activity</h2>
            <ActivityFeed activities={speaker.activities ?? []} entityType="speaker" entityId={id} onActivityAdded={refetch} />
          </div>
        </div>
      </div>

      {editOpen && <SpeakerFormModal speaker={speaker} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); refetch() }} />}
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
