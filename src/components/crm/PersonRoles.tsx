'use client'

// Everything else one person is in the CRM (GET /api/people/roles): their
// speaker, delegate, sponsor and partner records in every event, each a
// link. On a person's profile it is the "Connections" card; beside a
// company's contact, a single line. The same person, found from anywhere.

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CardHead, StageDot, stageLabel, stageTone } from './profileParts'
import type { PersonRole } from '@/app/api/people/roles/route'

// How they take part in each record: speaking, attending, or a contact of a
// sponsoring (or partner) company.
const LABEL: Record<PersonRole['kind'], string> = { speaker: 'Speaking', delegate: 'Attending', sponsor: 'Company contact', partner: 'Partner contact' }
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
    <section className="ws-card ws-card-quiet overflow-hidden">
      <CardHead side title="Connections" count={others.length || ''} note="Their other records: other sections and other events" />
      {isLoading ? (
        <div className="h-9 mx-4 mb-4 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
      ) : others.length === 0 ? (
        <p className="px-4 pb-4 text-[12.5px]" style={{ color: 'var(--fg-4)' }}>Not in any other section or event.</p>
      ) : (
        <ul className="flex flex-col pb-1.5">
          {others.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <Link href={`${PATH[r.kind]}/${r.id}`} className="crm-row flex items-center gap-2.5 px-4 py-2 min-h-[40px]">
                <StageDot tone={stageTone(r.kind, r.status)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--fg)' }}>{shortEvent(r.event)}</span>
                  <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{LABEL[r.kind]}{r.company && (r.kind === 'sponsor' || r.kind === 'partner') ? ` · ${r.company}` : ''}</span>
                </span>
                <span className="text-[12px] shrink-0 max-w-[120px] truncate" style={{ color: 'var(--fg-2)' }}>{r.ticketType ? `${r.ticketType} · ` : ''}{r.status ? stageLabel(r.kind, r.status) : ''}</span>
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
