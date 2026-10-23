'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { SpeakerFormModal } from '@/components/crm/SpeakerFormModal'
import { PersonProfile } from '@/components/crm/PersonProfile'
import { changeStage } from '@/lib/recordKinds'
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
  const [stageSaving, setStageSaving] = useState(false)

  const { data: speaker, isLoading, error, refetch } = useQuery<Speaker & { activities: any[] }>({
    queryKey: ['speaker', id],
    queryFn: () => fetchSpeaker(id),
  })

  // Build prev/next nav query from the filters applied in the list view (saved
  // to sessionStorage when opening this profile) so next/prev walks the
  // filtered list, not the full unfiltered one.
  const navParams = (() => {
    const params = new URLSearchParams()
    params.set('pageSize', '1000')
    let sortBy = 'createdAt', sortDir = 'desc'
    try {
      const saved = typeof window !== 'undefined' ? sessionStorage.getItem('speakers-list-state') : null
      if (saved) {
        const s = JSON.parse(saved)
        if (s.sortBy) sortBy = s.sortBy
        if (s.sortDir) sortDir = s.sortDir
        const f = s.filters ?? {}
        if (f.query) params.set('query', f.query)
        f.statuses?.forEach((v: string) => params.append('statuses', v))
        f.events?.forEach((v: string) => params.append('events', v))
        f.subTypes?.forEach((v: string) => params.append('subTypes', v))
        f.countries?.forEach((v: string) => params.append('countries', v))
        f.years?.forEach((v: number | string) => params.append('years', String(v)))
      }
    } catch {}
    params.set('sortBy', sortBy)
    params.set('sortDir', sortDir)
    return params.toString()
  })()

  const { data: navData } = useQuery<{ data: { id: string; firstName: string; lastName: string }[] }>({
    queryKey: ['speakers-nav', navParams],
    queryFn: () => fetch(`/api/speakers?${navParams}`).then(r => r.json()),
    staleTime: 60_000,
  })
  const navList = navData?.data ?? []
  const currentIdx = navList.findIndex(s => s.id === id)
  const prevItem = currentIdx > 0 ? navList[currentIdx - 1] : null
  const nextItem = currentIdx < navList.length - 1 ? navList[currentIdx + 1] : null
  const navName = (s: { id: string; firstName: string; lastName: string } | null) => s && { id: s.id, name: `${s.firstName} ${s.lastName}` }

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
    if (!confirm(`Delete this speaker${speaker?.event ? ` from ${speaker.event}` : ''}? This cannot be undone.`)) return
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
      await changeStage('speaker', id, speaker.status, newStatus)
      for (const key of ['speakers', 'company-events', 'ws-list', 'ws-board', 'ws-stats']) queryClient.invalidateQueries({ queryKey: [key] })
      await refetch()
    } finally { setStageSaving(false) }
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <div className="h-8 w-32 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
        <div className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
        <div className="h-40 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
      </div>
    )
  }

  if (error || !speaker) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="mb-4" style={{ color: 'var(--bad)' }}>Speaker not found.</p>
        <Link href="/speakers" className="ws-btn ws-btn-sm">Back to speakers</Link>
      </div>
    )
  }

  return (
    <>
      <PersonProfile
        kind="speaker"
        person={speaker}
        nav={{ prev: navName(prevItem), next: navName(nextItem), index: currentIdx, total: navList.length }}
        onEdit={() => setEditOpen(true)}
        onDelete={handleDelete}
        deleting={deleting}
        onStageChange={handleStageChange}
        stageSaving={stageSaving}
        refetch={refetch}
      />
      {editOpen && <SpeakerFormModal speaker={speaker} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); refetch() }} />}
    </>
  )
}
