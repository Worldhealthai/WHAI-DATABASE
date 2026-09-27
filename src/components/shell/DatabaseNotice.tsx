'use client'

// A strip across the top of the app when the CRM cannot read its database,
// saying what to do about it (for example: add crm to the Nexus project's
// exposed schemas). Without it a database that is not set up would simply
// look like a CRM with no records. Shows nothing when all is well, nothing
// when the database merely did not answer just then (a network blip), and
// nothing on a failed or refused check (the login page).

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'

interface DbStatus {
  ok: boolean
  problem: string | null
}

// While the last check found something wrong, or could not finish, look again
// every 30 seconds and whenever the window regains focus, so the strip goes
// as soon as the database answers properly and shows once a real problem can
// be seen.
const notOk = (data: DbStatus | null | undefined) => Boolean(data && !data.ok)

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
    refetchInterval: (query) => (notOk(query.state.data) ? 30 * 1000 : false),
    refetchOnWindowFocus: (query) => (notOk(query.state.data) ? 'always' : true),
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
