'use client'

// Everything else one person is in the CRM (GET /api/people/roles): their
// speaker, delegate, sponsor and partner records in every event, each a
// link. On a person's profile it is the "Connections" card; beside a
// company's contact, a single line. The same person, found from anywhere.

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Link2 } from 'lucide-react'
import type { PersonRole } from '@/app/api/people/roles/route'

const LABEL: Record<PersonRole['kind'], string> = { speaker: 'Speaker', delegate: 'Delegate', sponsor: 'Sponsor contact', partner: 'Partner contact' }
const PATH: Record<PersonRole['kind'], string> = { speaker: '/speakers', delegate: '/delegates', sponsor: '/sponsors', partner: '/partners' }

// "World Pharma AI London 2027" → "WPAI London 2027"
const shortEvent = (e: string | null) => (e || 'No event').replace(/^World Health AI/i, 'WHAI').replace(/^World Pharma AI/i, 'WPAI')

export function usePersonRoles(p: { email?: string | null; firstName?: string | null; lastName?: string | null; organization?: string | null }) {
  const params = new URLSearchParams()
  if (p.email) params.set('email', p.email)
  else {
    if (p.firstName) params.set('first', p.firstName)
    if (p.lastName) params.set('last', p.lastName)
    if (p.organization) params.set('org', p.organization)
  }
  const key = params.toString()
  return useQuery<{ roles: PersonRole[] }>({
    queryKey: ['person-roles', key],
    queryFn: async () => {
      const r = await fetch(`/api/people/roles?${key}`)
      if (!r.ok) throw new Error('roles')
      return r.json()
    },
    enabled: Boolean(p.email || (p.firstName && p.lastName)),
    staleTime: 30_000,
  })
}

// The card on a person's profile: their other records.
export function PersonRolesCard({ self, person }: { self: { kind: PersonRole['kind']; id: string }; person: Parameters<typeof usePersonRoles>[0] }) {
  const { data, isLoading } = usePersonRoles(person)
  const others = (data?.roles ?? []).filter((r) => !(r.kind === self.kind && r.id === self.id))
  return (
    <section className="ws-card p-5">
      <h2 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: 'var(--fg)' }}>
        <Link2 className="w-4 h-4" style={{ color: 'var(--fg-4)' }} /> Connections
      </h2>
      {isLoading ? (
        <div className="h-9 mt-3 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
      ) : others.length === 0 ? (
        <p className="text-[13px] mt-2" style={{ color: 'var(--fg-4)' }}>Not in any other section or event.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {others.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <Link href={`${PATH[r.kind]}/${r.id}`} className="flex items-center gap-3 px-3 py-2 -mx-3 rounded-lg transition-colors hover:bg-[var(--surface-2)]">
                <span className="text-[12px] font-medium px-2 h-6 inline-flex items-center rounded-md shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)' }}>{LABEL[r.kind]}</span>
                <span className="text-[13px] truncate flex-1" style={{ color: 'var(--fg)' }}>
                  {shortEvent(r.event)}
                  {r.company && (r.kind === 'sponsor' || r.kind === 'partner') ? <span style={{ color: 'var(--fg-3)' }}> · {r.company}</span> : null}
                </span>
                <span className="text-[12px] shrink-0" style={{ color: 'var(--fg-3)' }}>{r.ticketType ? `${r.ticketType} · ` : ''}{r.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// One line beside a company's contact: where else they are.
export function PersonRolesLine({ self, person }: { self: { kind: PersonRole['kind']; id: string }; person: Parameters<typeof usePersonRoles>[0] }) {
  const { data } = usePersonRoles(person)
  const others = (data?.roles ?? []).filter((r) => !((r.kind === self.kind) && r.id === self.id) && r.kind !== self.kind)
  if (!others.length) return null
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
      {others.slice(0, 3).map((r) => (
        <Link key={`${r.kind}-${r.id}`} href={`${PATH[r.kind]}/${r.id}`} onClick={(e) => e.stopPropagation()} className="text-[11.5px] hover:underline underline-offset-4" style={{ color: 'var(--accent-ink)' }}>
          {LABEL[r.kind]} · {shortEvent(r.event)}
        </Link>
      ))}
    </span>
  )
}
