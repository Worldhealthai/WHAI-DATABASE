'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { DelegateFormModal } from '@/components/crm/DelegateFormModal'
import { PersonProfile } from '@/components/crm/PersonProfile'
import { changeStage } from '@/lib/recordKinds'
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
  const [stageSaving, setStageSaving] = useState(false)

  const { data: delegate, isLoading, error, refetch } = useQuery<Delegate & { activities: any[] }>({
    queryKey: ['delegate', id],
    queryFn: () => fetchDelegate(id),
  })

  // Previous/next walk the delegates of the same event, newest first.
  const event = delegate?.event ?? ''
  const { data: navData } = useQuery<{ data: { id: string; firstName: string; lastName: string }[] }>({
    queryKey: ['delegates-nav', event],
    queryFn: () => fetch(`/api/delegates?${new URLSearchParams({ pageSize: '1000', sortBy: 'createdAt', sortDir: 'desc', ...(event ? { events: event } : {}) })}`).then((r) => r.json()),
    enabled: !!delegate,
    staleTime: 60_000,
  })
  const navList = navData?.data ?? []
  const currentIdx = navList.findIndex((d) => d.id === id)
  const prevItem = currentIdx > 0 ? navList[currentIdx - 1] : null
  const nextItem = currentIdx >= 0 && currentIdx < navList.length - 1 ? navList[currentIdx + 1] : null
  const navName = (d: { id: string; firstName: string; lastName: string } | null) => d && { id: d.id, name: `${d.firstName} ${d.lastName}` }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' && prevItem) router.push(`/delegates/${prevItem.id}`)
      if (e.key === 'ArrowRight' && nextItem) router.push(`/delegates/${nextItem.id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevItem, nextItem, router])

  const handleDelete = async () => {
    if (!confirm(`Delete this delegate${delegate?.event ? ` from ${delegate.event}` : ''}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/delegates/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['delegates'] })
      router.push('/delegates')
    } finally {
      setDeleting(false)
    }
  }

  const handleStageChange = async (newStatus: string) => {
    if (!delegate || newStatus === delegate.status) return
    setStageSaving(true)
    try {
      await changeStage('delegate', id, delegate.status, newStatus)
      for (const key of ['delegates', 'company-events', 'ws-list', 'ws-board', 'ws-stats']) queryClient.invalidateQueries({ queryKey: [key] })
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

  if (error || !delegate) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="mb-4" style={{ color: 'var(--bad)' }}>Delegate not found.</p>
        <Link href="/delegates" className="ws-btn ws-btn-sm">Back to delegates</Link>
      </div>
    )
  }

  return (
    <>
      <PersonProfile
        kind="delegate"
        person={delegate}
        nav={{ prev: navName(prevItem), next: navName(nextItem), index: currentIdx, total: navList.length }}
        onEdit={() => setEditOpen(true)}
        onDelete={handleDelete}
        deleting={deleting}
        onStageChange={handleStageChange}
        stageSaving={stageSaving}
        refetch={refetch}
      />
      {editOpen && <DelegateFormModal delegate={delegate} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); refetch() }} />}
    </>
  )
}
