'use client'

import { useState } from 'react'
import { MessageSquare, Phone, Mail, Users, ArrowUpDown, CheckSquare, Clock, Trash2, Megaphone, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Activity } from '@/types'

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  note:          MessageSquare,
  call:          Phone,
  email:         Mail,
  meeting:       Users,
  status_change: ArrowUpDown,
  task:          CheckSquare,
  linkedin_post: Megaphone,
  registration:  Ticket,
}

const ACTIVITY_COLORS: Record<string, string> = {
  note:          'bg-slate-500/20 text-slate-400',
  call:          'bg-green-500/20 text-green-400',
  email:         'bg-blue-500/20 text-blue-400',
  meeting:       'bg-purple-500/20 text-purple-400',
  status_change: 'bg-amber-500/20 text-amber-400',
  task:          'bg-cyan-500/20 text-cyan-400',
  linkedin_post: 'bg-[var(--mkt-soft)] text-[var(--mkt-ink)]',
  registration:  'bg-[var(--accent-soft)] text-[var(--accent-ink)]',
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: 'Note', call: 'Call', email: 'Email',
  meeting: 'Meeting', status_change: 'Status Change', task: 'Task', linkedin_post: 'LinkedIn post', registration: 'Registration',
}

const ACTIVITY_TYPE_OPTIONS = ['note', 'call', 'email', 'meeting', 'task']

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface ActivityFeedProps {
  activities: Activity[]
  entityType: 'delegate' | 'speaker' | 'sponsor' | 'partner'
  entityId: string
  onActivityAdded?: () => void
}

// The composer is one row of kinds until one is picked; the box and Save
// come then, so an empty feed is a short card.
export function ActivityFeed({ activities, entityType, entityId, onActivityAdded }: ActivityFeedProps) {
  const [type, setType] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !type) return
    setSaving(true)
    try {
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, type, content }),
      })
      setContent('')
      setType(null)
      onActivityAdded?.()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (activityId: string) => {
    if (!confirm('Delete this activity?')) return
    setDeletingId(activityId)
    try {
      await fetch(`/api/activities/${activityId}`, { method: 'DELETE' })
      onActivityAdded?.()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* The composer: the kinds as one switch; the box once one is picked. */}
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* All five fit the narrow side column: they share its width, each as wide as its word needs. */}
        <div className="crm-seg !flex w-full" role="group" aria-label="Log an activity">
          {ACTIVITY_TYPE_OPTIONS.map((t) => {
            const Icon = ACTIVITY_ICONS[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(type === t ? null : t)}
                data-active={type === t}
                aria-pressed={type === t}
                className="crm-seg-item inline-flex flex-auto items-center justify-center gap-1 h-7 px-1 text-[12px] font-medium"
                title={`Log a ${ACTIVITY_TYPE_LABELS[t].toLowerCase()}`}
              >
                <Icon className="w-3 h-3" />
                {ACTIVITY_TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>

        {type && (
          <>
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Log a ${ACTIVITY_TYPE_LABELS[type]?.toLowerCase()}…`}
              rows={3}
              className="ws-input w-full !h-auto py-2 text-[13px] resize-none"
            />
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => { setType(null); setContent('') }} className="ws-btn ws-btn-ghost ws-btn-sm">Cancel</button>
              {content.trim() && (
                <button type="submit" disabled={saving} className="ws-btn ws-btn-primary ws-btn-sm">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </>
        )}
      </form>

      {/* Timeline */}
      {activities.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--fg-4)' }}>No activity yet.</p>
      ) : (
        <div className="relative space-y-0">
          <div className="absolute left-[15px] top-5 bottom-1 w-px bg-[var(--surface-3)]" />
          {activities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.type] ?? MessageSquare
            const colorClass = ACTIVITY_COLORS[activity.type] ?? ACTIVITY_COLORS.note
            return (
              <div key={activity.id} className="group relative flex gap-3 pb-4">
                <div className={cn('relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', colorClass)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-300">
                      {ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}
                    </span>
                    <span className="text-xs text-slate-600 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {timeAgo(activity.createdAt)}
                    </span>
                    <button
                      onClick={() => handleDelete(activity.id)}
                      disabled={deletingId === activity.id}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all p-0.5 shrink-0"
                      title="Delete activity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {activity.createdBy && (
                    <div className="text-[11px] text-slate-600 mb-1">by {activity.createdBy}</div>
                  )}
                  <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {activity.content}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
