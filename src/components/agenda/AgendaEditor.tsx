'use client'

// The digital agenda for one edition. Production edits it: upload the
// team's Word agenda, then manage every session and speaker slot in
// place (who is confirmed, who is TBC), and export it back to Word in the
// classic layout or a designed one. Sales sees the same agenda read-only.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown, ArrowUp, Check, ChevronDown, Download, FileUp, Loader2, Plus, Trash2, UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import {
  type Agenda, type Session, type SessionType, type SlotStatus, type SpeakerSlot,
  SESSION_TYPES, SLOT_STATUSES, agendaStats, emptyAgenda, emptySession, emptySlot, inferType,
} from '@/lib/agenda/model'
import { EmptyState, Stat } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { Notice, useEdition, useMarketing, type SpeakerRow } from '@/components/marketing/shared'

type Mode = 'edit' | 'view'

const STATUS_STYLE: Record<SlotStatus, React.CSSProperties> = {
  confirmed: { background: 'var(--ok-soft)', color: 'var(--ok)' },
  tbc: { background: 'var(--warn-soft)', color: 'var(--warn)' },
  invited: { background: 'var(--accent-soft)', color: 'var(--accent-ink)' },
  declined: { background: 'var(--bad-soft)', color: 'var(--bad)' },
}

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
      return j
    },
    enabled: Boolean(edition),
  })
}

// ── Speaker slot ────────────────────────────────────────────────────────────

function SlotRow({
  slot, mode, lineup, onChange, onRemove,
}: { slot: SpeakerSlot; mode: Mode; lineup: SpeakerRow[]; onChange: (s: SpeakerSlot) => void; onRemove: () => void }) {
  const status = SLOT_STATUSES.find((s) => s.value === slot.status)?.label ?? slot.status
  const onLineup = Boolean(slot.lineupRef) || lineup.some((l) => l.name.trim().toLowerCase() === slot.name.trim().toLowerCase())

  if (mode === 'view') {
    return (
      <li className="flex items-start gap-2.5 py-1.5">
        <span className="inline-flex items-center h-5 px-1.5 rounded text-[11px] font-semibold mt-0.5 shrink-0" style={STATUS_STYLE[slot.status]}>{status}</span>
        <span className="text-[13.5px] min-w-0" style={{ color: 'var(--fg)' }}>
          <span className="font-medium">{slot.name || 'Speaker TBC'}</span>
          {(slot.role || slot.org) && <span style={{ color: 'var(--fg-3)' }}> · {[slot.role, slot.org].filter(Boolean).join(', ')}</span>}
          {slot.moderator && <span className="ml-1.5 text-[11px] font-semibold" style={{ color: 'var(--accent-ink)' }}>MODERATOR</span>}
        </span>
      </li>
    )
  }

  // Picking a name from the admin line-up fills the rest in and confirms them.
  const pickFromLineup = (name: string) => {
    const hit = lineup.find((l) => l.name.trim().toLowerCase() === name.trim().toLowerCase())
    if (hit) onChange({ ...slot, name: hit.name, role: slot.role || hit.role || '', org: slot.org || hit.org || '', lineupRef: hit.id, status: 'confirmed' })
    else onChange({ ...slot, name, lineupRef: null })
  }

  return (
    <li className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_auto_auto_auto] gap-2 items-center py-1">
      <span className="relative">
        <input
          list="agenda-lineup"
          className="ws-input h-8 text-[13px] w-full pr-6"
          value={slot.name}
          placeholder="Name"
          onChange={(e) => onChange({ ...slot, name: e.target.value })}
          onBlur={(e) => pickFromLineup(e.target.value)}
        />
        {onLineup && <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--ok)' }} aria-label="On the admin panel line-up" />}
      </span>
      <input className="ws-input h-8 text-[13px] w-full" value={slot.role} placeholder="Role" onChange={(e) => onChange({ ...slot, role: e.target.value })} />
      <input className="ws-input h-8 text-[13px] w-full" value={slot.org} placeholder="Organisation" onChange={(e) => onChange({ ...slot, org: e.target.value })} />
      <label className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap" style={{ color: 'var(--fg-3)' }} title="Moderator / chair">
        <input type="checkbox" checked={slot.moderator} onChange={(e) => onChange({ ...slot, moderator: e.target.checked })} /> Mod
      </label>
      <select
        className="ws-input h-8 text-[12.5px] py-0 pr-7 font-semibold"
        value={slot.status}
        onChange={(e) => onChange({ ...slot, status: e.target.value as SlotStatus })}
        style={{ color: STATUS_STYLE[slot.status].color, minWidth: 112 }}
        aria-label="Speaker status"
      >
        {SLOT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" onClick={onRemove} title="Remove speaker"><Trash2 className="w-3.5 h-3.5" /></button>
    </li>
  )
}

// ── Session ─────────────────────────────────────────────────────────────────

function SessionCard({
  session, index, count, mode, lineup, onChange, onRemove, onMove,
}: {
  session: Session; index: number; count: number; mode: Mode; lineup: SpeakerRow[]
  onChange: (s: Session) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void
}) {
  const s = session
  const isBreak = s.type === 'break'
  const typeLabel = SESSION_TYPES.find((t) => t.value === s.type)?.label ?? s.type
  const confirmed = s.speakers.filter((x) => x.status === 'confirmed').length
  const open = s.speakers.length - confirmed
  const set = (patch: Partial<Session>) => onChange({ ...s, ...patch })
  const setSlot = (i: number, slot: SpeakerSlot) => set({ speakers: s.speakers.map((x, k) => (k === i ? slot : x)) })

  if (mode === 'view') {
    return (
      <div className={cn('ws-card flex gap-4 px-5 py-4', isBreak && 'opacity-80')} style={isBreak ? { background: 'var(--surface-2)' } : undefined}>
        <div className="w-[76px] shrink-0">
          <p className="text-[15px] font-semibold tabular" style={{ color: isBreak ? 'var(--fg-3)' : 'var(--fg)' }}>{s.start}</p>
          <p className="text-[12px] tabular" style={{ color: 'var(--fg-4)' }}>to {s.end}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('text-[15px]', isBreak ? 'font-medium' : 'font-semibold')} style={{ color: isBreak ? 'var(--fg-3)' : 'var(--fg)' }}>{s.title}</p>
            {!isBreak && <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-3)' }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_TONE[s.type] }} />{typeLabel}</span>}
            {!isBreak && s.speakers.length > 0 && (
              <span className="ml-auto text-[12px] tabular" style={{ color: open ? 'var(--warn)' : 'var(--ok)' }}>{confirmed}/{s.speakers.length} confirmed</span>
            )}
          </div>
          {s.talkTitle && <p className="text-[13.5px] italic mt-1" style={{ color: 'var(--fg-2)' }}>{s.talkTitle}</p>}
          {s.points.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {s.points.map((q, i) => <li key={i} className="text-[13px] pl-3 relative" style={{ color: 'var(--fg-3)' }}><span className="absolute left-0">–</span>{q}</li>)}
            </ul>
          )}
          {!isBreak && (
            <ul className="mt-2">
              {s.speakers.map((sp) => <SlotRow key={sp.id} slot={sp} mode="view" lineup={lineup} onChange={() => {}} onRemove={() => {}} />)}
              {s.speakers.length === 0 && <li className="text-[13px] font-medium" style={{ color: 'var(--warn)' }}>Speakers to be confirmed</li>}
            </ul>
          )}
          {isBreak && s.notes && <p className="text-[13px] mt-1" style={{ color: 'var(--fg-3)' }}>{s.notes}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="ws-card px-5 py-4" style={isBreak ? { background: 'var(--surface-2)' } : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <input className="ws-input h-8 w-[74px] text-[13px] tabular text-center" value={s.start} placeholder="09:40" onChange={(e) => set({ start: e.target.value })} aria-label="Start" />
        <span style={{ color: 'var(--fg-4)' }}>–</span>
        <input className="ws-input h-8 w-[74px] text-[13px] tabular text-center" value={s.end} placeholder="10:05" onChange={(e) => set({ end: e.target.value })} aria-label="End" />
        <input
          className="ws-input h-8 flex-1 min-w-[220px] text-[14px] font-semibold"
          value={s.title}
          placeholder="Session title"
          onChange={(e) => set({ title: e.target.value, type: s.title ? s.type : inferType(e.target.value) })}
          aria-label="Session title"
        />
        <select className="ws-input h-8 w-[172px] text-[12.5px] py-0 pr-7" value={s.type} onChange={(e) => set({ type: e.target.value as SessionType })} aria-label="Session type">
          {SESSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <span className="inline-flex items-center gap-0.5 ml-auto">
          {!isBreak && s.speakers.length > 0 && <span className="text-[12px] tabular mr-2" style={{ color: open ? 'var(--warn)' : 'var(--ok)' }}>{confirmed}/{s.speakers.length} confirmed</span>}
          <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" disabled={index === 0} onClick={() => onMove(-1)} title="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
          <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" disabled={index === count - 1} onClick={() => onMove(1)} title="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
          <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" onClick={onRemove} title="Remove session"><Trash2 className="w-3.5 h-3.5" /></button>
        </span>
      </div>

      {isBreak ? (
        <input className="ws-input h-8 mt-2 text-[13px]" value={s.notes ?? ''} placeholder="Note (optional)" onChange={(e) => set({ notes: e.target.value })} />
      ) : (
        <>
          {(s.type === 'keynote' || s.type === 'spotlight' || s.type === 'fireside' || s.talkTitle) && (
            <input className="ws-input h-8 mt-2 text-[13px] italic" value={s.talkTitle ?? ''} placeholder="Talk title (optional)" onChange={(e) => set({ talkTitle: e.target.value })} />
          )}
          <textarea
            className="ws-input mt-2 text-[13px] py-2"
            rows={Math.max(2, Math.min(6, s.points.length + 1))}
            value={s.points.join('\n')}
            placeholder="Questions or description — one per line"
            onChange={(e) => set({ points: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })}
          />
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="ws-label mb-1">Speakers</p>
              <button type="button" className="ws-btn ws-btn-sm" onClick={() => set({ speakers: [...s.speakers, emptySlot()] })}><UserPlus className="w-3.5 h-3.5" /> Add speaker</button>
            </div>
            <ul className="mt-1">
              {s.speakers.map((sp, i) => (
                <SlotRow key={sp.id} slot={sp} mode="edit" lineup={lineup} onChange={(v) => setSlot(i, v)} onRemove={() => set({ speakers: s.speakers.filter((_, k) => k !== i) })} />
              ))}
              {s.speakers.length === 0 && <li className="text-[12.5px] py-1" style={{ color: 'var(--warn)' }}>No speakers yet — add one, or leave it and it exports as “Speakers TBC”.</li>}
            </ul>
          </div>
        </>
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

  // Take the saved agenda as the draft whenever it (re)loads and nothing is pending.
  useEffect(() => {
    if (!data || dirty) return
    setDraft(data.agenda ?? null)
  }, [data, dirty])

  const agenda = draft
  const stats = useMemo(() => (agenda ? agendaStats(agenda) : null), [agenda])
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
    if (agenda && agenda.sessions.length && !confirm(`Replace the current ${year} agenda with "${file.name}"? Speaker statuses set here will be reset to what the document says.`)) return
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
    setDraft(j.agenda)
    qc.invalidateQueries({ queryKey: ['agenda', edition] })
    setNote(`Imported ${j.stats.sessions} sessions and ${j.stats.slots} speaker slots from ${file.name}.`)
  }

  const exportHref = (style: 'classic' | 'designed') => `/api/agenda/export?edition=${encodeURIComponent(edition ?? '')}&style=${style}`

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
      {mode === 'edit' && (
        <button className="ws-btn ws-btn-primary" onClick={save} disabled={!dirty || saving || !agenda}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>
      )}
    </>
  )

  return (
    <WorkspacePage
      title="Agenda"
      description={mode === 'edit' ? `The ${year} running order: sessions, questions and who is on each panel, with every speaker confirmed or TBC.` : `The ${year} running order as Production has it. Edited in the Production portal.`}
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Sessions" value={stats!.talks} hint={`${stats!.sessions - stats!.talks} breaks`} />
            <Stat label="Speaker slots" value={stats!.slots} hint={stats!.empty ? `${stats!.empty} session${stats!.empty === 1 ? '' : 's'} with nobody yet` : 'Every session has speakers'} />
            <Stat label="Confirmed" value={stats!.confirmed} hint={stats!.slots ? `${Math.round((stats!.confirmed / stats!.slots) * 100)}% of slots` : ''} />
            <Stat label="Still to confirm" value={stats!.tbc} hint={stats!.declined ? `${stats!.declined} declined` : 'TBC or invited'} />
          </div>

          <div className="ws-card px-5 py-4 mb-4">
            {mode === 'edit' ? (
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="block sm:col-span-1"><span className="ws-label">Title</span><input className="ws-input" value={agenda.title} onChange={(e) => update({ ...agenda, title: e.target.value })} /></label>
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
            {agenda.sessions.map((s, i) => (
              <SessionCard
                key={s.id}
                session={s}
                index={i}
                count={agenda.sessions.length}
                mode={mode}
                lineup={lineup}
                onChange={(v) => setSession(i, v)}
                onRemove={() => { if (confirm(`Remove “${s.title || 'this session'}”?`)) update({ ...agenda, sessions: agenda.sessions.filter((_, k) => k !== i) }) }}
                onMove={(dir) => moveSession(i, dir)}
              />
            ))}
          </div>

          {mode === 'edit' && (
            <div className="flex items-center justify-between mt-4">
              <button className="ws-btn" onClick={addSession}><Plus className="w-4 h-4" /> Add session</button>
              <button className="ws-btn ws-btn-primary" onClick={save} disabled={!dirty || saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          )}
        </>
      )}
    </WorkspacePage>
  )
}
