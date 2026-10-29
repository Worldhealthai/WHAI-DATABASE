'use client'

// "Move to…" on a profile: a record filed in the wrong section (a sponsor
// that is really a speaker or a delegate, and so on) re-made in another,
// at the stage chosen, under the same event, its activity with it
// (lib/moveRecord, POST /api/records/move).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, Loader2 } from 'lucide-react'
import { KINDS, type RecordKind } from '@/lib/recordKinds'
import { Modal } from '@/components/workspace/ui'

const KINDS_ORDER: RecordKind[] = ['sponsor', 'partner', 'speaker', 'delegate']
// The stages a moved record can start at (lib/stagedAssign's ASSIGN_STAGES).
const START: Record<RecordKind, string[]> = {
  sponsor: ['Not Contacted', 'Emailed', 'In Discussion', 'Confirmed'],
  partner: ['Not Contacted', 'Emailed', 'In Discussion', 'Confirmed'],
  speaker: ['Not Contacted', 'Invited', 'Discussing', 'Speaking Confirmed'],
  delegate: ['Registered', 'Confirmed'],
}
const stageLabel = (kind: RecordKind, s: string) => KINDS[kind].stages.find((x) => x.status === s)?.label ?? s

export function MoveRecordButton({ kind, id, name, contacts = 1 }: { kind: RecordKind; id: string; name: string; contacts?: number }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const options = KINDS_ORDER.filter((k) => k !== kind)
  const [to, setTo] = useState<RecordKind>(options[0])
  const [stage, setStage] = useState(START[options[0]][0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const company = kind === 'sponsor' || kind === 'partner'
  const toPeople = to === 'speaker' || to === 'delegate'

  const what = company && toPeople
    ? contacts > 1
      ? `Each of ${name}'s ${contacts} contacts becomes a ${KINDS[to].label.toLowerCase()}, the main contact taking its activity.`
      : `${name}'s contact becomes a ${KINDS[to].label.toLowerCase()}.`
    : !company && !toPeople
      ? `${name} becomes a ${KINDS[to].label.toLowerCase()} lead: their organisation, with them as its contact (or added to it, if it is already in the event).`
      : `${name} moves to ${KINDS[to].plural.toLowerCase()}.`

  const move = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/records/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: kind, id, to, status: stage }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || 'It could not be moved.')
      for (const key of ['ws-list', 'ws-board', 'ws-stats', 'ws-recent']) queryClient.invalidateQueries({ queryKey: [key] })
      const first = j?.moved?.[0]
      router.push(first ? `${KINDS[to].detailPath}/${first.id}` : '/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'It could not be moved.')
      setBusy(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="ws-btn ws-btn-sm" title={`Filed in the wrong place? Move it to another section`}>
        <ArrowRightLeft className="w-3.5 h-3.5" /> Move to…
      </button>
      {open && (
        <Modal
          title={`Move ${name}`}
          subtitle="To another section of this event"
          onClose={() => !busy && setOpen(false)}
          footer={
            <>
              <button onClick={() => setOpen(false)} disabled={busy} className="ws-btn ws-btn-ghost">Cancel</button>
              <button onClick={move} disabled={busy} className="ws-btn ws-btn-primary">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Move to {KINDS[to].plural.toLowerCase()}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <span className="ws-label">Section</span>
              <div className="grid grid-cols-3 gap-2">
                {options.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { setTo(k); setStage(START[k][0]) }}
                    className="ws-btn"
                    style={to === k ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--fg)' } : undefined}
                    aria-pressed={to === k}
                  >
                    {KINDS[k].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="ws-label">Stage</span>
              <div className="flex flex-wrap gap-2">
                {START[to].map((s) => (
                  <button key={s} type="button" onClick={() => setStage(s)} className="ws-chip" data-active={stage === s} aria-pressed={stage === s}>
                    {stageLabel(to, s)}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[13px]" style={{ color: 'var(--fg-3)' }}>
              {what} Its notes and logged activity go with it; the {KINDS[kind].label.toLowerCase()} record is removed.
            </p>
            {error && <p className="text-[13px]" style={{ color: 'var(--bad)' }}>{error}</p>}
          </div>
        </Modal>
      )}
    </>
  )
}
