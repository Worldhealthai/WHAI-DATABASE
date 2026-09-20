'use client'

// The digital agenda for one edition. Production edits it: upload the
// team's Word agenda, then manage every session and seat in place (who is
// confirmed, who is TBC, which seats are still empty), and export it back
// to Word in the classic layout or a designed one. Sales sees the same
// agenda read-only. Breaks are listed but never counted.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown, ArrowUp, Check, ChevronDown, Download, FileUp, Loader2, Plus, Trash2, UserPlus, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import {
  type Agenda, type Session, type SessionType, type SlotStatus, type SpeakerSlot,
  SESSION_TYPES, agendaStats, emptyAgenda, emptySession, emptySlot, inferType, needsLabel, normaliseAgenda, seatsFor, sessionNeeds, sessionSeats,
} from '@/lib/agenda/model'
import { EmptyState, Stat } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { Notice, useEdition, useMarketing, type SpeakerRow } from '@/components/marketing/shared'

type Mode = 'edit' | 'view'

const TYPE_TONE: Record<SessionType, string> = {
  keynote: 'var(--ev-london)', panel: 'var(--fg-3)', fireside: 'var(--ev-boston)', spotlight: 'var(--warn)', break: 'var(--line-3)', other: 'var(--fg-4)',
}

function useAgenda(edition: string | null) {
  return useQuery<{ agenda: Agenda | null; error?: string; migration?: boolean }>({
    queryKey: ['agenda', edition ?? ''],
    queryFn: async () => {
      const r = await fetch(`/api/agenda?edition=${encodeURIComponent(edition!)}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return { agenda: null, error: j?.error || 'Could not load the agenda', migration: Boolean(j?.migration) }
      return { ...j, agenda: j.agenda ? normaliseAgenda(j.agenda) : null }
    },
    enabled: Boolean(edition),
  })
}

// ── Small pieces ────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: SlotStatus }) {
  const ok = status === 'confirmed'
  return (
    <span className="inline-flex items-center h-5 px-1.5 rounded text-[11px] font-semibold shrink-0" style={ok ? { background: 'var(--ok-soft)', color: 'var(--ok)' } : { background: 'var(--warn-soft)', color: 'var(--warn)' }}>
      {ok ? 'Confirmed' : 'TBC'}
    </span>
  )
}

// Confirmed ⇄ TBC, one click.
function StatusToggle({ status, onChange }: { status: SlotStatus; onChange: (s: SlotStatus) => void }) {
  const ok = status === 'confirmed'
  return (
    <button
      type="button"
      onClick={() => onChange(ok ? 'tbc' : 'confirmed')}
      title={ok ? 'Confirmed — click to mark TBC' : 'TBC — click to confirm'}
      aria-label="Speaker status"
      data-status={status}
      className="inline-flex items-center justify-center h-8 w-[96px] rounded-md text-[12px] font-semibold transition-colors"
      style={ok ? { background: 'var(--ok-soft)', color: 'var(--ok)', border: '1px solid transparent' } : { background: 'var(--warn-soft)', color: 'var(--warn)', border: '1px solid transparent' }}
    >
      {ok ? 'Confirmed' : 'TBC'}
    </button>
  )
}

function NeedsBadge({ session }: { session: Session }) {
  if (session.type === 'break') return null
  const n = sessionNeeds(session)
  const due = needsLabel(n)
  const seats = sessionSeats(session)
  const total = seats.moderators + seats.speakers
  if (!total) return null
  if (due) return <span className="text-[12px] font-medium" style={{ color: 'var(--warn)' }}>Needs {due}</span>
  if (n.toConfirm) return <span className="text-[12px] font-medium" style={{ color: 'var(--warn)' }}>{n.toConfirm} to confirm</span>
  return <span className="text-[12px] font-medium inline-flex items-center gap-1" style={{ color: 'var(--ok)' }}><Check className="w-3.5 h-3.5" /> Full and confirmed</span>
}

// ── Speaker row ─────────────────────────────────────────────────────────────

function SlotRow({ slot, lineup, onChange, onRemove }: { slot: SpeakerSlot; lineup: SpeakerRow[]; onChange: (s: SpeakerSlot) => void; onRemove: () => void }) {
  const onLineup = Boolean(slot.lineupRef) || lineup.some((l) => l.name.trim().toLowerCase() === slot.name.trim().toLowerCase())
  // Picking a name from the admin line-up fills the rest in and confirms them.
  const pickFromLineup = (name: string) => {
    const hit = lineup.find((l) => l.name.trim().toLowerCase() === name.trim().toLowerCase())
    if (hit) onChange({ ...slot, name: hit.name, role: slot.role || hit.role || '', org: slot.org || hit.org || '', lineupRef: hit.id, status: 'confirmed' })
    else onChange({ ...slot, name, lineupRef: null })
  }
  return (
    <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1.25fr)_minmax(0,1.35fr)_88px_96px_32px] gap-2 items-center">
      <span className="relative">
        <input list="agenda-lineup" className="ws-input h-8 text-[13px] w-full pr-6" value={slot.name} placeholder="Name" onChange={(e) => onChange({ ...slot, name: e.target.value })} onBlur={(e) => pickFromLineup(e.target.value)} />
        {onLineup && <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--ok)' }} aria-label="On the admin panel line-up" />}
      </span>
      <input className="ws-input h-8 text-[13px] w-full" value={slot.role} placeholder="Role" onChange={(e) => onChange({ ...slot, role: e.target.value })} />
      <input className="ws-input h-8 text-[13px] w-full" value={slot.org} placeholder="Organisation" onChange={(e) => onChange({ ...slot, org: e.target.value })} />
      <button
        type="button"
        onClick={() => onChange({ ...slot, moderator: !slot.moderator })}
        className="h-8 rounded-md text-[12px] font-medium transition-colors"
        style={slot.moderator ? { background: 'var(--accent-soft)', color: 'var(--accent-ink)', border: '1px solid var(--accent-line)' } : { background: 'var(--surface-2)', color: 'var(--fg-4)', border: '1px solid var(--line)' }}
        title="Moderator / chair"
      >
        {slot.moderator ? 'Moderator' : 'Speaker'}
      </button>
      <StatusToggle status={slot.status} onChange={(status) => onChange({ ...slot, status })} />
      <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm px-0 justify-center" onClick={onRemove} title="Remove"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// ── Session card ────────────────────────────────────────────────────────────

function SessionView({ session: s }: { session: Session }) {
  const isBreak = s.type === 'break'
  const typeLabel = SESSION_TYPES.find((t) => t.value === s.type)?.label ?? s.type
  return (
    <div className={cn('ws-card flex gap-5 px-5 py-4', isBreak && 'py-3')} style={isBreak ? { background: 'var(--surface-2)' } : undefined}>
      <div className="w-[64px] shrink-0 pt-0.5">
        <p className="text-[15px] font-semibold tabular leading-tight" style={{ color: isBreak ? 'var(--fg-3)' : 'var(--fg)' }}>{s.start}</p>
        <p className="text-[12px] tabular" style={{ color: 'var(--fg-4)' }}>{s.end}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className={cn('text-[15px]', isBreak ? 'font-medium' : 'font-semibold')} style={{ color: isBreak ? 'var(--fg-3)' : 'var(--fg)' }}>{s.title}</p>
          {!isBreak && <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-3)' }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_TONE[s.type] }} />{typeLabel}</span>}
          <span className="ml-auto"><NeedsBadge session={s} /></span>
        </div>
        {s.talkTitle && <p className="text-[13.5px] italic mt-1" style={{ color: 'var(--fg-2)' }}>“{s.talkTitle}”</p>}
        {s.points.length > 0 && (
          <ul className="mt-2 space-y-1 list-disc pl-5">
            {s.points.map((q, i) => <li key={i} className="text-[13px]" style={{ color: 'var(--fg-3)' }}>{q}</li>)}
          </ul>
        )}
        {!isBreak && s.speakers.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {s.speakers.map((sp) => (
              <li key={sp.id} className="flex items-start gap-2.5">
                <StatusPill status={sp.status} />
                <span className="text-[13.5px] min-w-0" style={{ color: 'var(--fg)' }}>
                  <span className="font-medium">{sp.name || 'Name TBC'}</span>
                  {(sp.role || sp.org) && <span style={{ color: 'var(--fg-3)' }}> · {[sp.role, sp.org].filter(Boolean).join(', ')}</span>}
                  {sp.moderator && <span className="ml-1.5 text-[11px] font-semibold" style={{ color: 'var(--accent-ink)' }}>MODERATOR</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {isBreak && s.notes && <p className="text-[13px] mt-1" style={{ color: 'var(--fg-3)' }}>{s.notes}</p>}
      </div>
    </div>
  )
}

function SessionEdit({
  session: s, index, count, lineup, onChange, onRemove, onMove,
}: { session: Session; index: number; count: number; lineup: SpeakerRow[]; onChange: (s: Session) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void }) {
  const isBreak = s.type === 'break'
  const seats = sessionSeats(s)
  const set = (patch: Partial<Session>) => onChange({ ...s, ...patch })
  const setSlot = (i: number, slot: SpeakerSlot) => set({ speakers: s.speakers.map((x, k) => (k === i ? slot : x)) })
  const setPoint = (i: number, v: string) => set({ points: s.points.map((x, k) => (k === i ? v : x)) })
  const hasTalk = s.type === 'keynote' || s.type === 'spotlight' || Boolean(s.talkTitle)

  return (
    <div className="ws-card" style={isBreak ? { background: 'var(--surface-2)' } : undefined}>
      {/* Header: time, title, type, order */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ borderBottom: isBreak ? 'none' : '1px solid var(--line)' }}>
        <input className="ws-input h-8 w-[68px] text-[13px] tabular text-center px-1" value={s.start} placeholder="09:40" onChange={(e) => set({ start: e.target.value })} aria-label="Start" />
        <span style={{ color: 'var(--fg-4)' }}>–</span>
        <input className="ws-input h-8 w-[68px] text-[13px] tabular text-center px-1" value={s.end} placeholder="10:05" onChange={(e) => set({ end: e.target.value })} aria-label="End" />
        <input className="ws-input h-8 flex-1 min-w-[200px] text-[14px] font-semibold" value={s.title} placeholder="Session title" onChange={(e) => set({ title: e.target.value, type: s.title ? s.type : inferType(e.target.value) })} aria-label="Session title" />
        <select className="ws-input h-8 w-[168px] text-[12.5px] py-0 pr-7" value={s.type} onChange={(e) => { const type = e.target.value as SessionType; set({ type, seats: s.seats ? s.seats : undefined }) }} aria-label="Session type">
          {SESSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <span className="inline-flex items-center gap-0.5 ml-auto">
          <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" disabled={index === 0} onClick={() => onMove(-1)} title="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
          <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" disabled={index === count - 1} onClick={() => onMove(1)} title="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
          <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" onClick={onRemove} title="Remove session"><Trash2 className="w-3.5 h-3.5" /></button>
        </span>
      </div>

      {isBreak ? (
        <div className="px-5 pb-3">
          <input className="ws-input h-8 text-[13px]" value={s.notes ?? ''} placeholder="Note (optional)" onChange={(e) => set({ notes: e.target.value })} />
        </div>
      ) : (
        <div className="px-5 py-4 grid gap-4">
          {hasTalk && (
            <input className="ws-input h-8 text-[13px] italic" value={s.talkTitle ?? ''} placeholder="Talk title (optional)" onChange={(e) => set({ talkTitle: e.target.value })} />
          )}

          {/* Questions as a bullet list */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="ws-label mb-0">Questions</p>
              <button type="button" className="text-[12px] font-medium hover:underline underline-offset-4" style={{ color: 'var(--accent-ink)' }} onClick={() => set({ points: [...s.points, ''] })}>+ Add question</button>
            </div>
            {s.points.length === 0 ? (
              <p className="text-[12.5px]" style={{ color: 'var(--fg-4)' }}>No questions yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {s.points.map((q, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--fg-4)' }} />
                    <input
                      className="ws-input h-8 text-[13px] flex-1"
                      value={q}
                      placeholder="What are the …?"
                      onChange={(e) => setPoint(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); set({ points: [...s.points.slice(0, i + 1), '', ...s.points.slice(i + 1)] }) } }}
                    />
                    <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm px-0 w-8 justify-center" onClick={() => set({ points: s.points.filter((_, k) => k !== i) })} title="Remove question"><X className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Seats */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-3">
                <p className="ws-label mb-0">Speakers</p>
                <NeedsBadge session={s} />
              </div>
              <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--fg-4)' }}>
                <span>Seats:</span>
                <label className="inline-flex items-center gap-1">
                  <input type="number" min={0} max={9} className="ws-input h-7 w-[46px] text-[12.5px] tabular text-center px-1" value={seats.moderators} onChange={(e) => set({ seats: { moderators: Math.max(0, Number(e.target.value) || 0), speakers: seats.speakers } })} aria-label="Moderator seats" /> mod
                </label>
                <label className="inline-flex items-center gap-1">
                  <input type="number" min={0} max={12} className="ws-input h-7 w-[46px] text-[12.5px] tabular text-center px-1" value={seats.speakers} onChange={(e) => set({ seats: { moderators: seats.moderators, speakers: Math.max(0, Number(e.target.value) || 0) } })} aria-label="Speaker seats" /> speakers
                </label>
                {s.seats && (s.seats.moderators !== seatsFor(s.type).moderators || s.seats.speakers !== seatsFor(s.type).speakers) && (
                  <button type="button" className="hover:underline underline-offset-4" onClick={() => set({ seats: undefined })}>reset</button>
                )}
              </div>
            </div>
            <div className="grid gap-1.5">
              {s.speakers.length > 0 && (
                <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1.25fr)_minmax(0,1.35fr)_88px_96px_32px] gap-2 text-[11px] uppercase tracking-wide font-semibold px-0.5" style={{ color: 'var(--fg-4)' }}>
                  <span>Name</span><span>Role</span><span>Organisation</span><span>Seat</span><span>Status</span><span />
                </div>
              )}
              {s.speakers.map((sp, i) => (
                <SlotRow key={sp.id} slot={sp} lineup={lineup} onChange={(v) => setSlot(i, v)} onRemove={() => set({ speakers: s.speakers.filter((_, k) => k !== i) })} />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button type="button" className="ws-btn ws-btn-sm" onClick={() => set({ speakers: [...s.speakers, { ...emptySlot(), moderator: sessionNeeds(s).moderators > 0 }] })}><UserPlus className="w-3.5 h-3.5" /> Add {sessionNeeds(s).moderators > 0 ? 'moderator' : 'speaker'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── The page ────────────────────────────────────────────────────────────────

export function AgendaEditor({ mode }: { mode: Mode }) {
  const { year } = useWorkspace()
  const ed = useEdition()
  const edition = ed?.label ?? null
  const qc = useQueryClient()
  const { data, isLoading } = useAgenda(edition)
  const lineupQ = useMarketing<SpeakerRow>('speaker')
  const lineup = lineupQ.data?.data ?? []

  const [draft, setDraft] = useState<Agenda | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!data || dirty) return
    setDraft(data.agenda ?? null)
  }, [data, dirty])

  const agenda = draft
  const st = useMemo(() => (agenda ? agendaStats(agenda) : null), [agenda])
  const due = st ? needsLabel({ moderators: st.needModerators, speakers: st.needSpeakers }) : ''
  const update = (next: Agenda) => { setDraft(next); setDirty(true) }
  const setSession = (i: number, s: Session) => agenda && update({ ...agenda, sessions: agenda.sessions.map((x, k) => (k === i ? s : x)) })
  const moveSession = (i: number, dir: -1 | 1) => {
    if (!agenda) return
    const j = i + dir
    if (j < 0 || j >= agenda.sessions.length) return
    const arr = agenda.sessions.slice()
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    update({ ...agenda, sessions: arr })
  }
  const addSession = () => {
    const base = agenda ?? emptyAgenda(edition ?? '', '', '')
    const last = base.sessions[base.sessions.length - 1]
    update({ ...base, sessions: [...base.sessions, emptySession(last?.end ?? '', '')] })
  }

  const save = async () => {
    if (!agenda || !edition) return
    setSaving(true)
    setNote('')
    const r = await fetch('/api/agenda', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edition, agenda }) })
    const j = await r.json().catch(() => ({}))
    setSaving(false)
    if (r.ok) { setDirty(false); qc.invalidateQueries({ queryKey: ['agenda', edition] }); setNote('Saved.') }
    else setNote(j?.error || 'Could not save.')
  }

  const upload = async (file: File) => {
    if (!edition) return
    if (agenda && agenda.sessions.length && !confirm(`Replace the current ${year} agenda with "${file.name}"? Statuses set here will be reset to what the document says.`)) return
    setBusy('Reading the document…')
    setNote('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('edition', edition)
    const r = await fetch('/api/agenda/import', { method: 'POST', body: fd })
    const j = await r.json().catch(() => ({}))
    setBusy('')
    if (!r.ok) { setNote(j?.error || 'Could not read that document.'); return }
    setDirty(false)
    setDraft(normaliseAgenda(j.agenda))
    qc.invalidateQueries({ queryKey: ['agenda', edition] })
    setNote(`Imported ${j.stats.sessions} sessions from ${file.name}.`)
  }

  const exportHref = (style: 'classic' | 'designed') => `/api/agenda/export?edition=${encodeURIComponent(edition ?? '')}&style=${style}`
  const saveButton = mode === 'edit' && (
    <button className="ws-btn ws-btn-primary" onClick={save} disabled={!dirty || saving || !agenda}>
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
    </button>
  )

  const actions = (
    <>
      {mode === 'edit' && (
        <>
          <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          <button className="ws-btn" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)} title="Read the team's Word agenda into the CRM">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} {busy || 'Upload Word agenda'}
          </button>
        </>
      )}
      {agenda && agenda.sessions.length > 0 && (
        <span className="relative">
          <button className="ws-btn" onClick={() => setExportOpen((o) => !o)} onBlur={() => setTimeout(() => setExportOpen(false), 150)}>
            <Download className="w-4 h-4" /> Export <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {exportOpen && (
            <span className="absolute right-0 top-full mt-1 z-20 w-[240px] rounded-lg overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-md)' }}>
              <a href={exportHref('classic')} className="block px-3 py-2.5 text-[13px] hover:bg-[var(--surface-2)]" style={{ color: 'var(--fg)' }} onMouseDown={(e) => e.preventDefault()}>
                <span className="block font-medium">Word — classic layout</span>
                <span className="block text-[11.5px]" style={{ color: 'var(--fg-4)' }}>The same format as the agenda you upload</span>
              </a>
              <a href={exportHref('designed')} className="block px-3 py-2.5 text-[13px] hover:bg-[var(--surface-2)]" style={{ color: 'var(--fg)', borderTop: '1px solid var(--line)' }} onMouseDown={(e) => e.preventDefault()}>
                <span className="block font-medium">Word — designed layout</span>
                <span className="block text-[11.5px]" style={{ color: 'var(--fg-4)' }}>Time column, session tags, TBC marked</span>
              </a>
            </span>
          )}
        </span>
      )}
      {saveButton}
    </>
  )

  return (
    <WorkspacePage
      title="Agenda"
      description={mode === 'edit' ? `The ${year} running order: every session, its questions, and who is in each seat — confirmed or TBC.` : `The ${year} running order as Production has it.`}
      actions={actions}
    >
      {note && <p className="text-[13px] mb-3" style={{ color: note.startsWith('Could') || note.includes('missing') ? 'var(--bad)' : 'var(--fg-2)' }}>{note}</p>}
      {data?.error ? (
        <Notice message={data.error} tone={data.migration ? 'warn' : 'bad'} />
      ) : isLoading ? (
        <div className="ws-card px-5 py-10 text-center text-[13px]" style={{ color: 'var(--fg-3)' }}>Loading…</div>
      ) : !agenda || agenda.sessions.length === 0 ? (
        <div className="ws-card">
          <EmptyState
            icon={FileUp}
            title={`No ${year} agenda yet`}
            body={mode === 'edit' ? 'Upload the team’s Word agenda and it becomes a running order you can manage here, or start one from scratch.' : 'Production has not uploaded an agenda for this edition yet.'}
            action={mode === 'edit' ? (
              <span className="flex gap-2">
                <button className="ws-btn ws-btn-primary" onClick={() => fileRef.current?.click()}><FileUp className="w-4 h-4" /> Upload Word agenda</button>
                <button className="ws-btn" onClick={addSession}><Plus className="w-4 h-4" /> Start from scratch</button>
              </span>
            ) : undefined}
          />
        </div>
      ) : (
        <>
          <datalist id="agenda-lineup">{lineup.map((l) => <option key={l.id} value={l.name} />)}</datalist>

          {/* Everything here excludes the breaks */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Sessions" value={st!.sessions} hint="Not counting breaks" />
            <Stat label="Seats filled" value={<>{st!.filled}<span className="text-[16px] font-medium" style={{ color: 'var(--fg-4)' }}> / {st!.seats}</span></>} hint={st!.sessionsShort ? `${st!.sessionsShort} session${st!.sessionsShort === 1 ? '' : 's'} with empty seats` : 'Every seat has a name'} />
            <Stat label="Confirmed" value={st!.confirmed} hint={st!.tbc ? `${st!.tbc} still TBC` : 'Everyone is confirmed'} />
            <Stat label="Still needed" value={st!.needModerators + st!.needSpeakers} hint={due || 'No empty seats'} />
          </div>

          <div className="ws-card px-5 py-4 mb-4">
            {mode === 'edit' ? (
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="block"><span className="ws-label">Title</span><input className="ws-input" value={agenda.title} onChange={(e) => update({ ...agenda, title: e.target.value })} /></label>
                <label className="block"><span className="ws-label">Date</span><input className="ws-input" value={agenda.dateLabel} onChange={(e) => update({ ...agenda, dateLabel: e.target.value })} /></label>
                <label className="block"><span className="ws-label">Venue</span><input className="ws-input" value={agenda.venue} onChange={(e) => update({ ...agenda, venue: e.target.value })} /></label>
              </div>
            ) : (
              <div>
                <p className="text-[17px] font-semibold" style={{ color: 'var(--fg)' }}>{agenda.title}</p>
                <p className="text-[13px]" style={{ color: 'var(--fg-3)' }}>{[agenda.dateLabel, agenda.venue].filter(Boolean).join(' · ')}</p>
              </div>
            )}
            {agenda.sourceFile && <p className="text-[11.5px] mt-2" style={{ color: 'var(--fg-4)' }}>From {agenda.sourceFile}{agenda.updatedAt ? ` · saved ${new Date(agenda.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</p>}
          </div>

          <div className="flex flex-col gap-3">
            {agenda.sessions.map((s, i) =>
              mode === 'view' ? (
                <SessionView key={s.id} session={s} />
              ) : (
                <SessionEdit
                  key={s.id}
                  session={s}
                  index={i}
                  count={agenda.sessions.length}
                  lineup={lineup}
                  onChange={(v) => setSession(i, v)}
                  onRemove={() => { if (confirm(`Remove “${s.title || 'this session'}”?`)) update({ ...agenda, sessions: agenda.sessions.filter((_, k) => k !== i) }) }}
                  onMove={(dir) => moveSession(i, dir)}
                />
              )
            )}
          </div>

          {mode === 'edit' && (
            <div className="flex items-center justify-between mt-4">
              <button className="ws-btn" onClick={addSession}><Plus className="w-4 h-4" /> Add session</button>
              {saveButton}
            </div>
          )}
        </>
      )}
    </WorkspacePage>
  )
}
