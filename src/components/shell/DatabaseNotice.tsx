'use client'

// A strip across the top of the app when the CRM cannot read its database,
// saying what to do about it (for example: add crm to the Nexus project's
// exposed schemas). Without it a database that is not set up would simply
// look like a CRM with no records. Shows nothing when all is well, and
// nothing on a failed or refused check (the login page, a network blip).

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'

interface DbStatus {
  ok: boolean
  problem: string | null
}

export function DatabaseNotice() {
  const { data } = useQuery<DbStatus | null>({
    queryKey: ['db-status'],
    queryFn: async () => {
      const r = await fetch('/api/db-status', { cache: 'no-store' })
      if (!r.ok) return null
      return (await r.json()) as DbStatus
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  if (!data || data.ok || !data.problem) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 px-4 lg:px-6 py-3 text-[13px]"
      style={{ background: 'var(--bad-soft)', color: 'var(--fg-2)', borderBottom: '1px solid var(--bad)' }}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--bad)' }} />
      <p>
        <span className="font-semibold" style={{ color: 'var(--bad)' }}>The CRM cannot read its database. </span>
        {data.problem}
      </p>
    </div>
  )
}
