'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Speaker } from '@/types'
import {
  SPEAKER_STATUS_OPTIONS,
  SESSION_TYPE_OPTIONS,
  SPEAKER_FEE_STATUS_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  EXPERTISE_OPTIONS,
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
} from '@/types'

interface Props {
  speaker?: Partial<Speaker>
  onClose: () => void
  onSaved: (s: Speaker) => void
}

export function SpeakerFormModal({ speaker, onClose, onSaved }: Props) {
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
    city: speaker?.city ?? '',
    headshotUrl: speaker?.headshotUrl ?? '',
    bio: speaker?.bio ?? '',
    expertiseAreas: speaker?.expertiseAreas ?? '',
    status: speaker?.status ?? 'Prospecting',
    sessionTitle: speaker?.sessionTitle ?? '',
    sessionDescription: speaker?.sessionDescription ?? '',
    sessionType: speaker?.sessionType ?? '',
    fee: speaker?.fee ? String(speaker.fee) : '',
    feeCurrency: speaker?.feeCurrency ?? 'GBP',
    feeStatus: speaker?.feeStatus ?? 'Not Set',
    contractStatus: speaker?.contractStatus ?? 'Not Started',
    travelRequired: speaker?.travelRequired ?? false,
    hotelRequired: speaker?.hotelRequired ?? false,
    tags: speaker?.tags ?? '',
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
        fee: form.fee ? parseFloat(form.fee) : null,
      }
      Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null })

      const res = await fetch(isEdit ? `/api/speakers/${speaker!.id}` : '/api/speakers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
      const saved = await res.json()
      onSaved(saved)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0d2040] border border-[#1a3a5c] rounded-xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a3a5c]">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Speaker' : 'Add Speaker'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name *">
              <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Jane" className={inputCls} required />
            </Field>
            <Field label="Last Name *">
              <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Smith" className={inputCls} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@example.com" className={inputCls} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7700 000000" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Organisation">
              <input value={form.organization} onChange={(e) => set('organization', e.target.value)} placeholder="Company name" className={inputCls} />
            </Field>
            <Field label="Job Title">
              <input value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Chief AI Officer" className={inputCls} />
            </Field>
          </div>

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

          {/* Status */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
                {SPEAKER_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Session Type">
              <select value={form.sessionType} onChange={(e) => set('sessionType', e.target.value)} className={inputCls}>
                <option value="">Select type</option>
                {SESSION_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Session Title">
            <input value={form.sessionTitle} onChange={(e) => set('sessionTitle', e.target.value)} placeholder="AI in Diagnostics: The Next Frontier" className={inputCls} />
          </Field>

          <Field label="Session Description">
            <textarea value={form.sessionDescription} onChange={(e) => set('sessionDescription', e.target.value)} rows={3} placeholder="Brief description of the session..." className={`${inputCls} resize-none`} />
          </Field>

          {/* Fee */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Speaking Fee">
              <input type="number" step="0.01" min="0" value={form.fee} onChange={(e) => set('fee', e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="Currency">
              <select value={form.feeCurrency} onChange={(e) => set('feeCurrency', e.target.value)} className={inputCls}>
                {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Fee Status">
              <select value={form.feeStatus} onChange={(e) => set('feeStatus', e.target.value)} className={inputCls}>
                {SPEAKER_FEE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Contract Status">
            <select value={form.contractStatus} onChange={(e) => set('contractStatus', e.target.value)} className={inputCls}>
              {CONTRACT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          {/* Logistics */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.travelRequired} onChange={(e) => set('travelRequired', e.target.checked)} className="w-4 h-4 rounded border-[#1a3a5c] bg-[#0A1628] accent-[#00B4D8]" />
              <span className="text-sm text-slate-300">Travel Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.hotelRequired} onChange={(e) => set('hotelRequired', e.target.checked)} className="w-4 h-4 rounded border-[#1a3a5c] bg-[#0A1628] accent-[#00B4D8]" />
              <span className="text-sm text-slate-300">Hotel Required</span>
            </label>
          </div>

          <Field label="LinkedIn URL">
            <input value={form.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." className={inputCls} />
          </Field>

          <Field label="Headshot URL">
            <input value={form.headshotUrl} onChange={(e) => set('headshotUrl', e.target.value)} placeholder="https://..." className={inputCls} />
          </Field>

          <Field label="Expertise Areas (comma-separated)">
            <input value={form.expertiseAreas} onChange={(e) => set('expertiseAreas', e.target.value)} placeholder="AI & Machine Learning, Digital Health, Oncology" className={inputCls} />
          </Field>

          <Field label="Bio">
            <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={3} placeholder="Speaker bio..." className={`${inputCls} resize-none`} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tags (comma-separated)">
              <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="keynote, AI, digital-health" className={inputCls} />
            </Field>
            <Field label="Notes">
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Internal notes..." className={`${inputCls} resize-none`} />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1a3a5c]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-500/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Speaker'}
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
