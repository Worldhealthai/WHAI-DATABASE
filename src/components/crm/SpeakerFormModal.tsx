'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Speaker } from '@/types'
import { PersonEventsField, confirmRemoval, usePersonEvents, yearOfEvent } from '@/components/crm/PersonEvents'
import {
  SPEAKER_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  SUBTYPE_OPTIONS,
} from '@/types'

interface Props {
  speaker?: Partial<Speaker>
  // Heading override, e.g. when the form is pre-filled from another edition's record.
  title?: string
  onClose: () => void
  onSaved: (s: Speaker) => void
}

export function SpeakerFormModal({ speaker, title, onClose, onSaved }: Props) {
  const isEdit = !!speaker?.id
  const [form, setForm] = useState({
    firstName: speaker?.firstName ?? '',
    lastName: speaker?.lastName ?? '',
    email: speaker?.email ?? '',
    phone: speaker?.phone ?? '',
    linkedinUrl: speaker?.linkedinUrl ?? '',
    organization: speaker?.organization ?? '',
    jobTitle: speaker?.jobTitle ?? '',
    country: speaker?.country ?? '',
    event: speaker?.event ?? '',
    subType: speaker?.subType ?? '',
    status: speaker?.status ?? 'Not Contacted',
    notes: speaker?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // The events and years they are in: one record each.
  const events = usePersonEvents('speaker', speaker)

  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }))
  const name = `${form.firstName} ${form.lastName}`.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First name and last name are required.')
      return
    }
    const plan = events.plan(form.event)
    const check = confirmRemoval(name, plan)
    if (check.blocked) { setError(check.blocked); return }
    if (!check.ok) return
    setSaving(true)
    setError('')
    try {
      const body: any = { ...form, event: plan.main, year: yearOfEvent(plan.main) ?? speaker?.year ?? null }
      Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null })

      // A record about to be taken out of its event isn't saved first.
      let saved: any = speaker
      if (!plan.removingThis) {
        const res = await fetch(isEdit ? `/api/speakers/${speaker!.id}` : '/api/speakers', {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error || 'Failed to save')
        }
        saved = await res.json()
      }
      if (!(await events.apply(saved?.id, plan, form.status))) { onClose(); return }
      onSaved(saved)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)]">
          <h2 className="text-base font-semibold text-[var(--fg)]">{title ?? (isEdit ? 'Edit speaker' : 'Add speaker')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-[var(--fg)] transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

          {/* Person */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Person</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name *">
                <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Jane" className={inputCls} required />
              </Field>
              <Field label="Last name *">
                <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Smith" className={inputCls} required />
              </Field>
              <Field label="Job title">
                <input value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Chief AI Officer" className={inputCls} />
              </Field>
              <Field label="Organisation">
                <input value={form.organization} onChange={(e) => set('organization', e.target.value)} placeholder="Company name" className={inputCls} />
              </Field>
              <Field label="Email">
                <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@example.com" className={inputCls} />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7700 000000" className={inputCls} />
              </Field>
              <Field label="LinkedIn">
                <input value={form.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." className={inputCls} />
              </Field>
              <Field label="Country">
                <select value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls}>
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Speaking: the events, and the stage */}
          <div className="pt-2 border-t border-[var(--line)]">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pt-1">Speaking</p>
            <PersonEventsField kind="speaker" events={events} current={form.event} onMove={(ev) => set('event', ev)} inputCls={inputCls} />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label={isEdit ? 'Stage' : 'Stage in each event'}>
                <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
                  {SPEAKER_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Speaker type">
                <select value={form.subType} onChange={(e) => set('subType', e.target.value)} className={inputCls}>
                  <option value="">Select type</option>
                  {SUBTYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Notes */}
          <div className="pt-2 border-t border-[var(--line)]">
            <Field label="Notes">
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Notes, previous interactions, context..." className={`${inputCls} resize-none`} />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--line)]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-[var(--fg)] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-500/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : events.picked.length > 1 ? `Add to ${events.picked.length} events` : 'Add speaker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-sm text-[var(--fg)] placeholder-slate-500 outline-none focus:border-purple-500/60 transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}
