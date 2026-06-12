'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Delegate } from '@/types'
import {
  DELEGATE_STATUS_OPTIONS,
  DELEGATE_TICKET_OPTIONS,
  DELEGATE_SOURCE_OPTIONS,
  EVENT_OPTIONS,
  SUBTYPE_OPTIONS,
  COUNTRY_OPTIONS,
} from '@/types'

interface Props {
  delegate?: Partial<Delegate>
  onClose: () => void
  onSaved: (d: Delegate) => void
}

export function DelegateFormModal({ delegate, onClose, onSaved }: Props) {
  const isEdit = !!delegate?.id
  const [form, setForm] = useState({
    firstName: delegate?.firstName ?? '',
    lastName: delegate?.lastName ?? '',
    email: delegate?.email ?? '',
    phone: delegate?.phone ?? '',
    linkedinUrl: delegate?.linkedinUrl ?? '',
    organization: delegate?.organization ?? '',
    jobTitle: delegate?.jobTitle ?? '',
    country: delegate?.country ?? '',
    city: delegate?.city ?? '',
    status: delegate?.status ?? 'Registered',
    event: delegate?.event ?? '',
    subType: delegate?.subType ?? '',
    ticketType: delegate?.ticketType ?? '',
    source: delegate?.source ?? '',
    dietaryRequirements: delegate?.dietaryRequirements ?? '',
    accessibilityNeeds: delegate?.accessibilityNeeds ?? '',
    bio: delegate?.bio ?? '',

    notes: delegate?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First name and last name are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body: any = { ...form }
      // Remove empty optional strings
      Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null })

      const res = await fetch(isEdit ? `/api/delegates/${delegate!.id}` : '/api/delegates', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to save')
      }
      const saved = await res.json()
      onSaved(saved)
    } catch (err: any) {
      setError(err?.message && err.message !== 'Failed to save' ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0d2040] border border-[#1a3a5c] rounded-xl shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a3a5c]">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Delegate' : 'Add Delegate'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

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
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@example.com" className={inputCls} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7700 000000" className={inputCls} />
            </Field>
          </div>

          {/* Organisation */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Organisation">
              <input value={form.organization} onChange={(e) => set('organization', e.target.value)} placeholder="Company name" className={inputCls} />
            </Field>
            <Field label="Job Title">
              <input value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Chief Medical Officer" className={inputCls} />
            </Field>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Country">
              <select value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls}>
                <option value="">Select country</option>
                {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="City">
              <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="London" className={inputCls} />
            </Field>
          </div>

          {/* Event + Sub-type */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Event">
              <select value={form.event} onChange={(e) => set('event', e.target.value)} className={inputCls}>
                <option value="">Select event</option>
                {EVENT_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="Delegate Type">
              <select value={form.subType} onChange={(e) => set('subType', e.target.value)} className={inputCls}>
                <option value="">Select type</option>
                {SUBTYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          {/* CRM */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
                {DELEGATE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Ticket Type">
              <select value={form.ticketType} onChange={(e) => set('ticketType', e.target.value)} className={inputCls}>
                <option value="">Select type</option>
                {DELEGATE_TICKET_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Source">
              <select value={form.source} onChange={(e) => set('source', e.target.value)} className={inputCls}>
                <option value="">Select source</option>
                {DELEGATE_SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* LinkedIn */}
          <Field label="LinkedIn URL">
            <input value={form.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." className={inputCls} />
          </Field>

          {/* Dietary / Accessibility */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dietary Requirements">
              <input value={form.dietaryRequirements} onChange={(e) => set('dietaryRequirements', e.target.value)} placeholder="e.g. Vegetarian" className={inputCls} />
            </Field>
            <Field label="Accessibility Needs">
              <input value={form.accessibilityNeeds} onChange={(e) => set('accessibilityNeeds', e.target.value)} placeholder="e.g. Wheelchair access" className={inputCls} />
            </Field>
          </div>

          {/* Bio */}
          <Field label="Bio">
            <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={3} placeholder="Short bio..." className={`${inputCls} resize-none`} />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Internal notes..." className={`${inputCls} resize-none`} />
          </Field>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1a3a5c]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#00B4D8] text-[#0A1628] text-sm font-semibold hover:bg-[#00B4D8]/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Delegate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 bg-[#0A1628] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8]/60 transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}
