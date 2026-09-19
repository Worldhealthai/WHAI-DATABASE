'use client'

// The header every workspace screen sits under: what this is, which edition
// it is, a way to change edition, and the screen's own actions.

import Link from 'next/link'
import { CalendarX2 } from 'lucide-react'
import { eventLook } from '@/lib/portals'
import { useWorkspace } from '@/lib/workspace'
import { EmptyState, Segmented } from './ui'

export function WorkspacePage({
  title, description, actions, children, wide = false,
}: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  const ws = useWorkspace()
  const { portal, category, year, years, go } = ws
  const now = new Date().getFullYear()

  if (!portal || !category) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <EmptyState
          icon={CalendarX2}
          title="That event isn’t in the CRM"
          body="Choose one of the events to open its workspace."
          action={<Link href={portal ? `/?portal=${portal.key}` : '/'} className="ws-btn ws-btn-primary">Choose an event</Link>}
        />
      </div>
    )
  }

  const look = eventLook(category.name)

  return (
    <div className={wide ? 'px-4 lg:px-6 py-5' : 'max-w-[1400px] mx-auto px-4 lg:px-6 py-5'}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="text-[12px] font-medium" style={{ color: 'var(--fg-3)' }}>
            {look.series} {look.city} · {year}{Number(year) === now + 1 ? ' · next edition' : ''}
          </p>
          <h1 className="display text-[26px] leading-tight mt-1" style={{ color: 'var(--fg)', fontWeight: 600 }}>{title}</h1>
          {description && <p className="text-[13.5px] mt-1" style={{ color: 'var(--fg-3)' }}>{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            options={years.map((y) => ({ value: y, label: y, hint: Number(y) > now ? 'Upcoming edition' : undefined }))}
            value={year ?? years[0]}
            onChange={(y) => go({ year: y })}
            size="sm"
          />
          {actions}
        </div>
      </div>
      {children}
    </div>
  )
}
