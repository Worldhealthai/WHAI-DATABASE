'use client'

// "Type & role" on a person's profile. People are filed by what they are
// and how they take part, not by section: a Solution Provider (sells to the
// audience) comes as a delegate or a speaker; an End User (buys) as an
// attendee or a speaker. Sponsoring belongs to their company (Sales).
// Changing the type updates the record; changing delegate ↔ speaker re-files
// it under the same event (lib/moveRecord), its activity with it.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, UserCog } from 'lucide-react'
import { KINDS } from '@/lib/recordKinds'
import { Modal } from '@/components/workspace/ui'

type PersonKind = 'speaker' | 'delegate'
type SubType = 'Solution Provider' | 'End User'

// The stages a re-filed record can start at.
const START: Record<PersonKind, string[]> = {
  speaker: ['Not Contacted', 'Invited', 'Discussing', 'Speaking Confirmed'],
  delegate: ['Registered', 'Confirmed'],
}
const stageLabel = (kind: PersonKind, s: string) => KINDS[kind].stages.find((x) => x.status === s)?.label ?? s

// A delegate who is an End User is an attendee.
export const roleLabel = (kind: PersonKind, subType: string | null | undefined) =>
  kind === 'speaker' ? 'Speaker' : subType === 'End User' ? 'Attendee' : 'Delegate'

export function TypeRoleButton({ kind, id, name, subType }: { kind: PersonKind; id: string; name: string; subType: string | null | undefined }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const current: SubType | null = subType === 'Solution Provider' || subType === 'End User' ? subType : null
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<SubType | null>(current)
  const [role, setRole] = useState<PersonKind>(kind)
  const [stage, setStage] = useState(START[kind][0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const moving = role !== kind
  const changed = moving || type !== current

  const save = async () => {
    setBusy(true); setError('')
    try {
      if (type !== current) {
        const res = await fetch(`/api/${kind}s/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subType: type }) })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'The type could not be saved.')
      }
      if (moving) {
        const res = await fetch('/api/records/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: kind, id, to: role, status: stage }) })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j?.error || 'It could not be re-filed.')
        for (const key of ['ws-list', 'ws-board', 'ws-stats', 'ws-recent', 'ws-segments']) queryClient.invalidateQueries({ queryKey: [key] })
        const first = j?.moved?.[0]
        router.push(first ? `${KINDS[role].detailPath}/${first.id}` : '/')
        return
      }
      await queryClient.invalidateQueries()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'It could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const choice = (active: boolean, onClick: () => void, label: string) => (
    <button type="button" onClick={onClick} className="ws-btn" aria-pressed={active}
      style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--fg)' } : undefined}>
      {label}
    </button>
  )

  return (
    <>
      <button onClick={() => { setType(current); setRole(kind); setStage(START[kind][0]); setError(''); setOpen(true) }} className="ws-btn ws-btn-sm" title="Solution provider or end user, and how they take part">
        <UserCog className="w-3.5 h-3.5" /> {current ? `${current} · ${roleLabel(kind, current)}` : 'Type & role'}
      </button>
      {open && (
        <Modal
          title={name}
          subtitle="What they are, and how they take part in this event"
          onClose={() => !busy && setOpen(false)}
          footer={
            <>
              <button onClick={() => setOpen(false)} disabled={busy} className="ws-btn ws-btn-ghost">Cancel</button>
              <button onClick={save} disabled={busy || !changed} className="ws-btn ws-btn-primary">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <span className="ws-label">Type</span>
              <div className="grid grid-cols-2 gap-2">
                {choice(type === 'Solution Provider', () => setType('Solution Provider'), 'Solution provider')}
                {choice(type === 'End User', () => setType('End User'), 'End user')}
              </div>
            </div>
            <div>
              <span className="ws-label">Taking part as</span>
              <div className="grid grid-cols-2 gap-2">
                {choice(role === 'delegate', () => { setRole('delegate'); setStage(START.delegate[0]) }, type === 'End User' ? 'Attendee' : 'Delegate')}
                {choice(role === 'speaker', () => { setRole('speaker'); setStage(START.speaker[0]) }, 'Speaker')}
              </div>
            </div>
            {moving && (
              <div>
                <span className="ws-label">Stage</span>
                <div className="flex flex-wrap gap-2">
                  {START[role].map((s) => (
                    <button key={s} type="button" onClick={() => setStage(s)} className="ws-chip" data-active={stage === s} aria-pressed={stage === s}>
                      {stageLabel(role, s)}
                    </button>
                  ))}
                </div>
                <p className="text-[12.5px] mt-2" style={{ color: 'var(--fg-3)' }}>
                  They move to {role === 'speaker' ? 'the speakers' : 'the delegates'} for this event, with their notes and logged activity.
                </p>
              </div>
            )}
            <p className="text-[12.5px]" style={{ color: 'var(--fg-4)' }}>Sponsoring is their company&rsquo;s: add the company to the sales pipeline from Companies.</p>
            {error && <p className="text-[13px]" style={{ color: 'var(--bad)' }}>{error}</p>}
          </div>
        </Modal>
      )}
    </>
  )
}
