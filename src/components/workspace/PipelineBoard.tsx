'use client'

// The pipeline: every lead for one edition, laid out by stage, dragged from
// one to the next as the conversation moves. Made for the next edition —
// the leads to chase for 2027 go in here before a single one has replied.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, Network, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import { KINDS, changeStage, listParams, type RecordKind, type Stage } from '@/lib/recordKinds'
import { editionLabel } from '@/lib/portals'
import { useTierOptions } from '@/lib/useTierOptions'
import { CURRENCY_OPTIONS, PARTNER_TYPE_OPTIONS } from '@/types'
import { StatusBadge } from '@/components/crm/StatusBadge'
import { EmptyState, Field, Initials, Modal, Segmented, StageDot, formatMoney, timeAgo } from './ui'
import { WorkspacePage } from './WorkspacePage'

type Lead = Record<string, any>
type BoardKind = 'sponsor' | 'partner'

function useBoard(kind: BoardKind, labels: string[]) {
  return useQuery<{ data: Lead[] }>({
    queryKey: ['ws-board', kind, labels],
    queryFn: async () => {
      const p = listParams(kind, labels, { page: '1', pageSize: '1000', sortBy: 'updatedAt', sortDir: 'desc' })
      const r = await fetch(`${KINDS[kind].api}?${p}`)
      if (!r.ok) throw new Error('board')
      return r.json()
    },
    enabled: labels.length > 0,
    staleTime: 15_000,
  })
}

// ── Quick add ────────────────────────────────────────────────────────────────

function QuickAddLead({
  kind, eventLabel, stage, onClose, onSaved,
}: { kind: BoardKind; eventLabel: string; stage: string; onClose: () => void; onSaved: () => void }) {
  const tiers = useTierOptions()
  const def = KINDS[kind]
  const [f, setF] = useState({
    companyName: '', website: '', contactFirstName: '', contactLastName: '', contactEmail: '', contactJobTitle: '',
    tier: kind === 'partner' ? PARTNER_TYPE_OPTIONS[0] : '', valueAmount: '', valueCurrency: 'GBP', status: stage, notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const save = async () => {
    if (!f.companyName.trim()) { setError('Company name is required.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(def.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: f.companyName.trim(),
          website: f.website.trim() || null,
          contactFirstName: f.contactFirstName.trim() || null,
          contactLastName: f.contactLastName.trim() || null,
          contactEmail: f.contactEmail.trim() || null,
          contactJobTitle: f.contactJobTitle.trim() || null,
          tier: f.tier || null,
          status: f.status,
          event: eventLabel,
          valueAmount: f.valueAmount ? Number(f.valueAmount) : null,
          valueCurrency: f.valueCurrency,
          notes: f.notes.trim() || null,
        }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setError(j?.error || 'Could not save this lead.'); return }
      onSaved()
    } catch {
      setError('Could not save this lead.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Add ${kind === 'partner' ? 'partner' : 'lead'}`}
      subtitle={`Goes into the ${eventLabel} pipeline at “${def.statusLabel(f.status)}”.`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="ws-btn ws-btn-ghost" disabled={saving}>Cancel</button>
          <button onClick={save} className="ws-btn ws-btn-primary" disabled={saving}>{saving ? 'Saving…' : `Add ${kind === 'partner' ? 'partner' : 'lead'}`}</button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Company" span><input autoFocus className="ws-input" value={f.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Acme Health" /></Field>
        <Field label="Contact first name"><input className="ws-input" value={f.contactFirstName} onChange={(e) => set('contactFirstName', e.target.value)} /></Field>
        <Field label="Contact last name"><input className="ws-input" value={f.contactLastName} onChange={(e) => set('contactLastName', e.target.value)} /></Field>
        <Field label="Email"><input type="email" className="ws-input" value={f.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} /></Field>
        <Field label="Job title"><input className="ws-input" value={f.contactJobTitle} onChange={(e) => set('contactJobTitle', e.target.value)} /></Field>
        <Field label={kind === 'partner' ? 'Partner type' : 'Package'}>
          <select className="ws-input" value={f.tier} onChange={(e) => set('tier', e.target.value)}>
            {kind === 'sponsor' && <option value="">Not decided yet</option>}
            {(kind === 'partner' ? PARTNER_TYPE_OPTIONS : tiers).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Stage">
          <select className="ws-input" value={f.status} onChange={(e) => set('status', e.target.value)}>
            {def.stages.map((s) => <option key={s.status} value={s.status}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Value" hint="What the package is worth if it lands.">
          <div className="flex gap-2">
            <select className="ws-input w-24" value={f.valueCurrency} onChange={(e) => set('valueCurrency', e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" min={0} className="ws-input" value={f.valueAmount} onChange={(e) => set('valueAmount', e.target.value)} placeholder="15000" />
          </div>
        </Field>
        <Field label="Website"><input className="ws-input" value={f.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" /></Field>
        <Field label="Notes" span><textarea rows={2} className="ws-input" style={{ resize: 'vertical' }} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Where the lead came from, who knows them…" /></Field>
      </div>
      {error && <p className="text-[13px] mt-3" style={{ color: 'var(--bad)' }}>{error}</p>}
    </Modal>
  )
}

// ── Cards and columns ────────────────────────────────────────────────────────

function LeadCard({ lead, kind, dragging, onDragStart, onDragEnd }: {
  lead: Lead; kind: BoardKind; dragging: boolean
  onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void
}) {
  const contact = `${lead.contactFirstName ?? ''} ${lead.contactLastName ?? ''}`.trim()
  return (
    <Link
      href={`${KINDS[kind].detailPath}/${lead.id}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn('block rounded-xl p-3.5 transition-all cursor-grab active:cursor-grabbing select-none', dragging && 'opacity-40 scale-[0.98]')}
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-line)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
    >
      <div className="flex items-start gap-2.5">
        <Initials name={lead.companyName || '?'} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--fg)' }}>{lead.companyName}</p>
          <p className="text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{contact || lead.contactEmail || 'No contact yet'}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-3">
        {lead.tier ? <StatusBadge value={lead.tier} variant="sponsor_tier" /> : <span className="text-[11.5px]" style={{ color: 'var(--fg-4)' }}>No package yet</span>}
        <span className="text-[12.5px] font-semibold tabular" style={{ color: lead.valueAmount ? 'var(--fg)' : 'var(--fg-4)' }}>{formatMoney(lead.valueAmount, lead.valueCurrency || 'GBP')}</span>
      </div>
      <p className="text-[11px] mt-2.5" style={{ color: 'var(--fg-4)' }}>Updated {timeAgo(lead.updatedAt)}</p>
    </Link>
  )
}

function Column({
  stage, leads, currency, kind, dragId, overStage, setDragId, setOverStage, onDrop, onAdd,
}: {
  stage: Stage; leads: Lead[]; currency: string; kind: BoardKind
  dragId: string | null; overStage: string | null
  setDragId: (id: string | null) => void; setOverStage: (s: string | null) => void
  onDrop: (id: string, to: string) => void; onAdd: (stage: string) => void
}) {
  const over = overStage === stage.status && dragId !== null
  const value = leads.reduce((s, l) => s + (Number(l.valueAmount) || 0), 0)
  return (
    <div
      className="flex flex-col rounded-2xl min-h-[420px] transition-colors"
      style={{
        flex: stage.negative ? '0 0 200px' : '1 1 240px',
        minWidth: stage.negative ? 200 : 232,
        background: over ? 'var(--accent-soft)' : 'var(--surface-2)',
        border: `1px solid ${over ? 'var(--accent-line)' : 'var(--line)'}`,
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overStage !== stage.status) setOverStage(stage.status) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null) }}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragId; if (id) onDrop(id, stage.status); setDragId(null); setOverStage(null) }}
    >
      <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <StageDot hex={stage.hex} />
          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--fg)' }}>{stage.label}</p>
          <span className="text-[11.5px] font-medium tabular px-1.5 py-0.5 rounded-md" style={{ background: 'var(--surface)', color: 'var(--fg-3)', border: '1px solid var(--line)' }}>{leads.length}</span>
        </div>
        {value > 0 && <span className="text-[12px] font-semibold tabular" style={{ color: 'var(--fg-2)' }}>{formatMoney(value, currency)}</span>}
      </div>
      <div className="flex-1 flex flex-col gap-2 px-2.5 pb-2.5">
        {leads.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            kind={kind}
            dragging={dragId === l.id}
            onDragStart={(e) => { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; setDragId(l.id) }}
            onDragEnd={() => { setDragId(null); setOverStage(null) }}
          />
        ))}
        {leads.length === 0 && (
          <div className="flex-1 rounded-xl flex items-center justify-center text-[12.5px] min-h-[80px]" style={{ border: '1px dashed var(--line-2)', color: 'var(--fg-4)' }}>
            {over ? 'Drop here' : 'Nothing here'}
          </div>
        )}
        {!stage.negative && (
          <button onClick={() => onAdd(stage.status)} className="ws-btn ws-btn-ghost ws-btn-sm justify-start mt-1" style={{ color: 'var(--fg-3)' }}>
            <Plus className="w-3.5 h-3.5" /> Add here
          </button>
        )}
      </div>
    </div>
  )
}

// ── Board ────────────────────────────────────────────────────────────────────

export function PipelineBoard() {
  const ws = useWorkspace()
  const queryClient = useQueryClient()
  const { labels, category, year } = ws
  const [kind, setKind] = useState<BoardKind>('sponsor')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null) // stage to add into

  const def = KINDS[kind]
  const { data, isLoading, refetch } = useBoard(kind, labels)
  const leads = data?.data ?? []

  const byStage = useMemo(() => {
    const m: Record<string, Lead[]> = {}
    for (const s of def.stages) m[s.status] = []
    for (const l of leads) (m[l.status] ??= []).push(l)
    return m
  }, [leads, def.stages])

  const currency = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of leads) if (l.valueAmount) c[l.valueCurrency || 'GBP'] = (c[l.valueCurrency || 'GBP'] ?? 0) + 1
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'GBP'
  }, [leads])

  const sum = (statuses: string[]) => leads.filter((l) => statuses.includes(l.status)).reduce((s, l) => s + (Number(l.valueAmount) || 0), 0)
  const openValue = sum(['Emailed', 'In Discussion'])
  const wonValue = sum(['Confirmed'])
  const eventLabel = category && year ? editionLabel(category.name, year) : ''

  const move = async (id: string, to: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead || lead.status === to) return
    // Move the card immediately; the save follows.
    queryClient.setQueryData<{ data: Lead[] }>(['ws-board', kind, labels], (old) =>
      old ? { data: old.data.map((l) => (l.id === id ? { ...l, status: to, updatedAt: new Date().toISOString() } : l)) } : old)
    const ok = await changeStage(kind, id, lead.status, to)
    if (!ok) await refetch()
    queryClient.invalidateQueries({ queryKey: ['ws-stats'] })
    queryClient.invalidateQueries({ queryKey: ['ws-list', kind] })
  }

  const empty = !isLoading && leads.length === 0

  return (
    <WorkspacePage
      title="Pipeline"
      description={`Drag a card to the stage the conversation has reached. Every move is logged on the ${kind}'s profile.`}
      wide
      actions={
        <>
          <Segmented
            size="sm"
            value={kind}
            onChange={(k) => setKind(k)}
            options={[
              { value: 'sponsor', label: <span className="inline-flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> Sponsors</span> },
              { value: 'partner', label: <span className="inline-flex items-center gap-1.5"><Network className="w-3.5 h-3.5" /> Partners</span> },
            ]}
          />
          <button onClick={() => setAdding(def.stages[0].status)} className="ws-btn ws-btn-primary"><Plus className="w-4 h-4" /> Add {kind === 'partner' ? 'partner' : 'lead'}</button>
        </>
      }
    >
      {/* Totals strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-[13px]">
        <span style={{ color: 'var(--fg-3)' }}><strong className="tabular" style={{ color: 'var(--fg)' }}>{leads.length}</strong> {kind === 'partner' ? 'partners' : 'leads'} in the {year} pipeline</span>
        <span style={{ color: 'var(--fg-3)' }}>Open <strong className="tabular" style={{ color: 'var(--fg)' }}>{formatMoney(openValue, currency)}</strong></span>
        <span style={{ color: 'var(--fg-3)' }}>Confirmed <strong className="tabular" style={{ color: 'var(--ok)' }}>{formatMoney(wonValue, currency)}</strong></span>
        {isLoading && <span style={{ color: 'var(--fg-4)' }}>Loading…</span>}
      </div>

      {empty ? (
        <div className="ws-card">
          <EmptyState
            icon={Sparkles}
            title={`Start the ${year} ${kind === 'partner' ? 'partner list' : 'pipeline'}`}
            body={`Nothing for ${eventLabel} yet. Add the ${kind === 'partner' ? 'partners' : 'leads'} you will be chasing — they start at “Not contacted” and move across as you work them.`}
            action={<button onClick={() => setAdding(def.stages[0].status)} className="ws-btn ws-btn-primary"><Plus className="w-4 h-4" /> Add the first {kind === 'partner' ? 'partner' : 'lead'}</button>}
          />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 lg:-mx-6 lg:px-6">
          {def.stages.map((s) => (
            <Column
              key={s.status}
              stage={s}
              leads={byStage[s.status] ?? []}
              currency={currency}
              kind={kind}
              dragId={dragId}
              overStage={overStage}
              setDragId={setDragId}
              setOverStage={setOverStage}
              onDrop={move}
              onAdd={(stage) => setAdding(stage)}
            />
          ))}
        </div>
      )}

      {adding && eventLabel && (
        <QuickAddLead
          kind={kind}
          eventLabel={eventLabel}
          stage={adding}
          onClose={() => setAdding(null)}
          onSaved={() => { setAdding(null); refetch(); queryClient.invalidateQueries({ queryKey: ['ws-stats'] }); queryClient.invalidateQueries({ queryKey: ['ws-list', kind] }) }}
        />
      )}
    </WorkspacePage>
  )
}

export type { RecordKind }
