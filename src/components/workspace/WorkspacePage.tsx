'use client'

// The header every workspace screen sits under: what this is and the
// screen's own actions. The event and edition are in the top bar.

import Link from 'next/link'
import { CalendarX2 } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { EmptyState } from './ui'

export function WorkspacePage({
  title, description, actions, children, wide = false,
}: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  const { portal, category } = useWorkspace()

  if (!portal || !category) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <EmptyState
          icon={CalendarX2}
          title="That event isn’t in the CRM"
          body="Choose one of the events to open its workspace."
          action={<Link href="/" className="ws-btn ws-btn-primary">Choose an event</Link>}
        />
      </div>
    )
  }

  return (
    <div className={wide ? 'px-4 lg:px-8 py-6' : 'max-w-[1320px] mx-auto px-4 lg:px-8 py-6'}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 mb-6">
        <div className="min-w-0">
          <h1 className="crm-title">{title}</h1>
          {description && <p className="crm-sub">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
