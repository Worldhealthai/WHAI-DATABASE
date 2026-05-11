'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Speaker } from '@/types'
import {
  SPEAKER_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  EVENT_OPTIONS,
  SUBTYPE_OPTIONS,
} from '@/types'

interface Props {
  speaker?: Partial<Speaker>
  onClose: () => void
  onSaved: (s: Speaker) => void
}

export function SpeakerFormModal({ speaker, onClose, onSaved }: Props) {
  const isEdit = !!speaker?.id
  const currentYear = new Date().getFullYear()
  const [form, setForm] = useState({
    firstName: speaker?.firstName ?? '',
    lastName: speaker?.lastName ?? '',
    email: speaker?.email ?? '',
    phone: speaker?.phone ?? '',
    organization: speaker?.organization ?? '',
    jobTitle: speaker?.jobTitle ?? '',
    country: speaker?.country ?? '',
    event: speaker?.event ?? '',
    subType: speaker?.subType ?? '',
    status: speaker?.status ?? 'Not Contacted',
    year: speaker?.year ? String(speaker.year) : String(currentYear),
    notes: speaker?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First name and last name are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body: any = {
        ...form,
        year: form.year ? parseInt(form.year) : null,
      }
      Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null })

      const res = await fetch(isEdit ? `/api/speakers/${speaker!.id}` : '/api/speakers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to save')
      }
      const saved = await res.json()
      onSaved(saved)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0d2040] border border-[#1a3a5c] rounded-xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a3a5c]">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Speaker Lead' : 'Add Speaker Lead'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name *">
              <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Jane" className={inputCls} required />
            </Field>
            <Field label="Last Name *">
              <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Smith" className={inputCls} required />
            </Field>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@example.com" className={inputCls} />
            </Field>
            <Field label="Contact Number">
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7700 000000" className={inputCls} />
            </Field>
          </div>

          {/* Organisation */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Organisation">
              <input value={form.organization} onChange={(e) => set('organization', e.target.value)} placeholder="Company name" className={inputCls} />
            </Field>
            <Field label="Job Title">
              <input value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Chief AI Officer" className={inputCls} />
            </Field>
          </div>

          {/* Location + Event */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Country">
              <select value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls}>
                <option value="">Select country</option>
                {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Event">
              <select value={form.event} onChange={(e) => set('event', e.target.value)} className={inputCls}>
                <option value="">Unassigned</option>
                {EVENT_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
          </div>

          {/* Type + Status + Year */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Speaker Type">
              <select value={form.subType} onChange={(e) => set('subType', e.target.value)} className={inputCls}>
                <option value="">Select type</option>
                {SUBTYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
                {SPEAKER_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Year">
              <input
                type="number"
                min="2020"
                max="2030"
                value={form.year}
                onChange={(e) => set('year', e.target.value)}
                placeholder={String(currentYear)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Comments */}
          <Field label="Comments">
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Notes, previous interactions, context..." className={`${inputCls} resize-none`} />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1a3a5c]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-500/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 bg-[#0A1628] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500/60 transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}
