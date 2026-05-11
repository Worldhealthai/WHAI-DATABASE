'use client'

import { useState } from 'react'
import { MessageSquare, Phone, Mail, Users, ArrowUpDown, CheckSquare, Clock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Activity } from '@/types'

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  note:          MessageSquare,
  call:          Phone,
  email:         Mail,
  meeting:       Users,
  status_change: ArrowUpDown,
  task:          CheckSquare,
}

const ACTIVITY_COLORS: Record<string, string> = {
  note:          'bg-slate-500/20 text-slate-400',
  call:          'bg-green-500/20 text-green-400',
  email:         'bg-blue-500/20 text-blue-400',
  meeting:       'bg-purple-500/20 text-purple-400',
  status_change: 'bg-amber-500/20 text-amber-400',
  task:          'bg-cyan-500/20 text-cyan-400',
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: 'Note', call: 'Call', email: 'Email',
  meeting: 'Meeting', status_change: 'Status Change', task: 'Task',
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
  entityType: 'delegate' | 'speaker' | 'sponsor'
  entityId: string
  onActivityAdded?: () => void
}

export function ActivityFeed({ activities, entityType, entityId, onActivityAdded }: ActivityFeedProps) {
  const [type, setType] = useState('note')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    try {
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, type, content }),
      })
      setContent('')
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
    <div className="space-y-4">
      {/* Log form — always visible, integrated */}
      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Type tabs */}
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_TYPE_OPTIONS.map((t) => {
            const Icon = ACTIVITY_ICONS[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                  type === t
                    ? 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/40'
                    : 'border-[#1a3a5c] text-slate-500 hover:text-slate-300 hover:border-slate-600'
                )}
              >
                <Icon className="w-3 h-3" />
                {ACTIVITY_TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Log a ${ACTIVITY_TYPE_LABELS[type]?.toLowerCase()}…`}
          rows={3}
          className="w-full px-3 py-2.5 bg-[#071428] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-600 outline-none focus:border-[#00B4D8]/40 resize-none transition-colors"
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!content.trim() || saving}
            className="px-4 py-1.5 rounded-lg bg-[#00B4D8] text-[#0A1628] text-xs font-semibold hover:bg-[#00B4D8]/90 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="border-t border-[#1a3a5c]" />

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="text-center py-6 text-slate-600 text-sm">
          No activity yet.
        </div>
      ) : (
        <div className="relative space-y-0">
          <div className="absolute left-[15px] top-5 bottom-1 w-px bg-[#1a3a5c]" />
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
