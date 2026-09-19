'use client'

// The Marketing overview for one edition: how many speakers still need a
// welcome post, how many sponsor posts are still owed, and the next names
// to work through.

import Link from 'next/link'
import { ArrowRight, Megaphone } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import type { Speaker, Sponsor } from '@/types'
import { EmptyState, Stat } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { Avatar, MigrationNotice, Tone, consentLabel, isConfirmedSpeaker, isConfirmedSponsor, speakerPostStatus, sponsorRemaining, useMarketing } from './shared'

export function MarketingOverview() {
  const { labels, year, href } = useWorkspace()
  const sp = useMarketing<Speaker>('speaker', labels)
  const so = useMarketing<Sponsor>('sponsor', labels)
  const loading = sp.isLoading || so.isLoading
  // Confirmed only: the lists also hold people and companies still in play.
  const speakers = (sp.data?.data ?? []).filter(isConfirmedSpeaker)
  const sponsors = (so.data?.data ?? []).filter(isConfirmedSponsor)

  const todo = speakers.filter((s) => speakerPostStatus(s) === 'To do')
  const posted = speakers.filter((s) => speakerPostStatus(s) === 'Posted')
  const consented = speakers.filter((s) => s.linkedinConsent === true)
  const owed = sponsors.filter((s) => sponsorRemaining(s) > 0)
  const owedPosts = owed.reduce((n, s) => n + sponsorRemaining(s), 0)
  const included = sponsors.reduce((n, s) => n + Number(s.linkedinPostsDue ?? 0), 0)

  const error = sp.data?.error || so.data?.error

  return (
    <WorkspacePage title="Overview" description="LinkedIn posts for this edition: confirmed speakers to welcome and confirmed sponsor packages to honour.">
      {error ? (
        <MigrationNotice message={error} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat label="Speakers to welcome" value={todo.length} loading={loading} hint={`${consented.length} of ${speakers.length} confirmed consented`} />
            <Stat label="Welcome posts made" value={posted.length} loading={loading} hint={speakers.length ? `${Math.round((posted.length / speakers.length) * 100)}% of speakers` : 'No speakers yet'} />
            <Stat label="Sponsor posts owed" value={owedPosts} loading={loading} hint={`${owed.length} ${owed.length === 1 ? 'company' : 'companies'} waiting`} />
            <Stat label="Sponsor posts included" value={included} loading={loading} hint={`${sponsors.length} ${sponsors.length === 1 ? 'sponsor' : 'sponsors'} this edition`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="ws-card">
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>Speakers still to welcome</p>
                <Link href={href('speakers')} className="inline-flex items-center gap-1 text-[13px] font-medium hover:underline underline-offset-4" style={{ color: 'var(--accent-ink)' }}>Speaker posts <ArrowRight className="w-3.5 h-3.5" /></Link>
              </div>
              {!loading && todo.length === 0 ? (
                <EmptyState icon={Megaphone} title="Everyone is welcomed" body={speakers.length ? 'Every consenting speaker has had their post.' : `No speakers in the ${year} edition yet.`} className="py-10" />
              ) : (
                <ul>
                  {todo.slice(0, 8).map((s) => {
                    const consent = consentLabel(s.linkedinConsent)
                    const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()
                    return (
                      <li key={s.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
                        <Avatar src={s.headshotUrl} name={name || '?'} size={34} />
                        <span className="min-w-0 flex-1">
                          <Link href={`/speakers/${s.id}`} className="block font-medium truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{name || 'Unnamed'}</Link>
                          <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[s.jobTitle, s.organization].filter(Boolean).join(' · ') || '—'}</span>
                        </span>
                        <Tone tone={consent.tone}>{consent.text}</Tone>
                      </li>
                    )
                  })}
                  {todo.length > 8 && <li className="px-5 py-3 text-[12.5px]" style={{ color: 'var(--fg-4)' }}>and {todo.length - 8} more</li>}
                </ul>
              )}
            </div>

            <div className="ws-card">
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>Sponsors owed posts</p>
                <Link href={href('sponsors')} className="inline-flex items-center gap-1 text-[13px] font-medium hover:underline underline-offset-4" style={{ color: 'var(--accent-ink)' }}>Sponsor posts <ArrowRight className="w-3.5 h-3.5" /></Link>
              </div>
              {!loading && owed.length === 0 ? (
                <EmptyState icon={Megaphone} title="Nothing owed" body={sponsors.length ? 'Every sponsor package has had its posts.' : `No sponsors in the ${year} edition yet.`} className="py-10" />
              ) : (
                <ul>
                  {owed.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
                      <Avatar src={s.logoUrl} name={s.companyName || '?'} size={34} />
                      <span className="min-w-0 flex-1">
                        <Link href={`/sponsors/${s.id}`} className="block font-medium truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{s.companyName}</Link>
                        <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{s.tier || '—'} · {s.linkedinPostsDone ?? 0} of {s.linkedinPostsDue} made</span>
                      </span>
                      <Tone tone="accent">{sponsorRemaining(s)} owed</Tone>
                    </li>
                  ))}
                  {owed.length > 8 && <li className="px-5 py-3 text-[12.5px]" style={{ color: 'var(--fg-4)' }}>and {owed.length - 8} more</li>}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </WorkspacePage>
  )
}
