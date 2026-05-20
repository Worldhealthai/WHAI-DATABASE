'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Trash2, Mail, Phone, Linkedin, MapPin, Building2,
  Briefcase, Tag, Mic, ChevronRight, ChevronLeft, Plane, Hotel, Check,
} from 'lucide-react'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { SpeakerFormModal } from '@/components/crm/SpeakerFormModal'
import type { Speaker } from '@/types'
import { cn } from '@/lib/utils'

const SPEAKER_STAGES = ['Not Contacted', 'Invited', 'Discussing', 'Speaking Confirmed']

function PipelineProgress({ currentStatus, accentHex, onStageChange, saving }: {
  currentStatus: string; accentHex: string; onStageChange: (s: string) => void; saving: boolean
}) {
  const isRejected = ['Rejected', 'Speaking Rejected'].includes(currentStatus)
  const currentIdx = SPEAKER_STAGES.indexOf(currentStatus)

  return (
    <div className="whai-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pipeline Stage</span>
        {isRejected && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 font-medium">
            {currentStatus}
          </span>
        )}
      </div>
      <div className="flex items-center gap-0">
        {SPEAKER_STAGES.map((stage, i) => {
          const isDone = currentIdx > i
          const isCurrent = currentIdx === i
          const isFuture = currentIdx < i
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
                <div className={cn(
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
                  {stage.replace('Speaking ', '')}
                </span>
              </button>
              {i < SPEAKER_STAGES.length - 1 && (
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
  const [stageSaving, setStageSaving] = useState(false)

  const { data: speaker, isLoading, error, refetch } = useQuery<Speaker & { activities: any[] }>({
    queryKey: ['speaker', id],
    queryFn: () => fetchSpeaker(id),
  })

  const { data: navData } = useQuery<{ data: { id: string; firstName: string; lastName: string }[] }>({
    queryKey: ['speakers-nav'],
    queryFn: () => fetch('/api/speakers?pageSize=1000&sortBy=createdAt&sortDir=desc').then(r => r.json()),
    staleTime: 60_000,
  })
  const navList = navData?.data ?? []
  const currentIdx = navList.findIndex(s => s.id === id)
  const prevItem = currentIdx > 0 ? navList[currentIdx - 1] : null
  const nextItem = currentIdx < navList.length - 1 ? navList[currentIdx + 1] : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' && prevItem) router.push(`/speakers/${prevItem.id}`)
      if (e.key === 'ArrowRight' && nextItem) router.push(`/speakers/${nextItem.id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevItem, nextItem, router])

  const handleDelete = async () => {
    if (!confirm('Delete this speaker? This cannot be undone.')) return
    setDeleting(true)
    try {
      await fetch(`/api/speakers/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['speakers'] })
      router.push('/speakers')
    } finally { setDeleting(false) }
  }

  const handleStageChange = async (newStatus: string) => {
    if (!speaker || newStatus === speaker.status) return
    setStageSaving(true)
    try {
      await fetch(`/api/speakers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      queryClient.invalidateQueries({ queryKey: ['speakers'] })
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

  if (error || !speaker) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="text-red-400 mb-4">Speaker not found.</div>
        <Link href="/speakers" className="text-purple-400 text-sm hover:underline">← Back to Speakers</Link>
      </div>
    )
  }

  const expertiseList = speaker.expertiseAreas?.split(',').map((e) => e.trim()).filter(Boolean) ?? []

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <nav className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/speakers" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Speakers
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-300">{speaker.firstName} {speaker.lastName}</span>
          {currentIdx >= 0 && (
            <span className="text-xs text-slate-600 ml-1">{currentIdx + 1} / {navList.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={prevItem ? `/speakers/${prevItem.id}` : '#'}
            aria-disabled={!prevItem}
            title={prevItem ? `← ${prevItem.firstName} ${prevItem.lastName}` : 'No previous'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              prevItem
                ? 'border-[#1a3a5c] text-slate-400 hover:text-white hover:border-slate-500 hover:bg-[#112850]'
                : 'border-[#1a3a5c]/30 text-slate-700 pointer-events-none'
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{prevItem ? `${prevItem.firstName} ${prevItem.lastName}` : 'Previous'}</span>
            <span className="sm:hidden">Prev</span>
          </Link>
          <Link
            href={nextItem ? `/speakers/${nextItem.id}` : '#'}
            aria-disabled={!nextItem}
            title={nextItem ? `${nextItem.firstName} ${nextItem.lastName} →` : 'No next'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              nextItem
                ? 'border-[#1a3a5c] text-slate-400 hover:text-white hover:border-slate-500 hover:bg-[#112850]'
                : 'border-[#1a3a5c]/30 text-slate-700 pointer-events-none'
            )}
          >
            <span className="hidden sm:inline">{nextItem ? `${nextItem.firstName} ${nextItem.lastName}` : 'Next'}</span>
            <span className="sm:hidden">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      <div className="whai-card overflow-hidden">
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #a855f780 0%, #a855f720 60%, transparent 100%)' }} />
        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {speaker.email && (
                <a href={`mailto:${speaker.email}`} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/20 transition-colors">
                  <Mail className="w-3 h-3" /> {speaker.email}
                </a>
              )}
              {speaker.phone && (
                <a href={`tel:${speaker.phone}`} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-700/40 border border-slate-700 text-slate-300 text-xs hover:bg-slate-700/60 transition-colors">
                  <Phone className="w-3 h-3" /> {speaker.phone}
                </a>
              )}
              {speaker.event && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/8 border border-purple-500/15 text-purple-400/80 text-xs">
                  {speaker.event}
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
        currentStatus={speaker.status}
        accentHex="#a855f7"
        onStageChange={handleStageChange}
        saving={stageSaving}
      />

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
