'use client'

import { useState } from 'react'
import { MessageSquare, Phone, Mail, Users, ArrowUpDown, CheckSquare, Plus, Clock } from 'lucide-react'
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

const ACTIVITY_TYPE_OPTIONS = ['note', 'call', 'email', 'meeting', 'task']

export function ActivityFeed({ activities, entityType, entityId, onActivityAdded }: ActivityFeedProps) {
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState('note')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

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
      setShowForm(false)
      onActivityAdded?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Add activity button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#1a3a5c] text-slate-400 hover:text-white hover:border-[#00B4D8]/50 text-sm transition-colors w-full"
        >
          <Plus className="w-4 h-4" />
          Log activity
        </button>
      )}

      {/* Activity form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="whai-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            {ACTIVITY_TYPE_OPTIONS.map((t) => {
              const Icon = ACTIVITY_ICONS[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    type === t
                      ? 'bg-[#00B4D8]/20 text-[#00B4D8] border-[#00B4D8]/50'
                      : 'border-[#1a3a5c] text-slate-400 hover:text-white'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {ACTIVITY_TYPE_LABELS[t]}
                </button>
              )
            })}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Add a ${ACTIVITY_TYPE_LABELS[type]?.toLowerCase()}...`}
            rows={3}
            className="w-full px-3 py-2 bg-[#0A1628] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/50 resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setContent('') }}
              className="px-3 py-1.5 rounded-md text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || saving}
              className="px-4 py-1.5 rounded-md bg-[#00B4D8] text-[#0A1628] text-sm font-semibold hover:bg-[#00B4D8]/90 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No activity yet. Log a note, call, or email above.
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-6 bottom-0 w-px bg-[#1a3a5c]" />
          {activities.map((activity, idx) => {
            const Icon = ACTIVITY_ICONS[activity.type] ?? MessageSquare
            const colorClass = ACTIVITY_COLORS[activity.type] ?? ACTIVITY_COLORS.note
            return (
              <div key={activity.id} className="relative flex gap-3 pb-4">
                <div className={cn('relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0', colorClass)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 pt-1.5">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-white">
                      {ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}
                    </span>
                    {activity.createdBy && (
                      <span className="text-xs text-slate-500">by {activity.createdBy}</span>
                    )}
                    <span className="ml-auto text-xs text-slate-600 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {timeAgo(activity.createdAt)}
                    </span>
                  </div>
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
