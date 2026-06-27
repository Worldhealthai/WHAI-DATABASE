'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Sponsor } from '@/types'
import {
  SPONSOR_TIER_OPTIONS,
  SPONSOR_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  EVENT_OPTIONS,
} from '@/types'

interface Props {
  sponsor?: Partial<Sponsor>
  defaultTier?: string
  entityLabel?: string
  keepTier?: boolean
  partnerMode?: boolean
  onClose: () => void
  onSaved: (s: Sponsor) => void
}

// Partner records are distinguished from sponsors purely by these tiers.
// A partner must always carry one of them, otherwise it leaks into sponsors.
const PARTNER_TIER_OPTIONS = ['Media Partner', 'Association Partner']

export function SponsorFormModal({ sponsor, defaultTier, entityLabel = 'Sponsor', keepTier = false, partnerMode = false, onClose, onSaved }: Props) {
  const isEdit = !!sponsor?.id
  const [form, setForm] = useState({
    companyName: sponsor?.companyName ?? '',
    website: sponsor?.website ?? '',
    contactFirstName: sponsor?.contactFirstName ?? '',
    contactLastName: sponsor?.contactLastName ?? '',
    contactEmail: sponsor?.contactEmail ?? '',
    contactPhone: sponsor?.contactPhone ?? '',
    contactLinkedinUrl: sponsor?.contactLinkedinUrl ?? '',
    contactJobTitle: sponsor?.contactJobTitle ?? '',
    country: sponsor?.country ?? '',
    city: sponsor?.city ?? '',
    tier: sponsor?.tier ?? defaultTier ?? (partnerMode ? 'Media Partner' : ''),
    status: sponsor?.status ?? 'Not Contacted',
    event: sponsor?.event ?? '',
    valueAmount: sponsor?.valueAmount ? String(sponsor.valueAmount) : '',
    valueCurrency: sponsor?.valueCurrency ?? 'GBP',
    packageDetails: sponsor?.packageDetails ?? '',

    notes: sponsor?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }))

  const isConfirmed = form.status === 'Confirmed'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.companyName.trim()) { setError('Company name is required.'); return }
    setSaving(true); setError('')
    try {
      const body: any = {
        ...form,
        valueAmount: form.valueAmount ? parseFloat(form.valueAmount) : null,
        // Partners must always carry a partner tier so they never leak into
        // the sponsors list. Sponsors only get a tier once Confirmed.
        tier: partnerMode
          ? (PARTNER_TIER_OPTIONS.includes(form.tier) ? form.tier : 'Media Partner')
          : keepTier ? (form.tier || null) : (isConfirmed ? form.tier || null : null),
      }
      Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null })

      const base = partnerMode ? '/api/partners' : '/api/sponsors'
      const res = await fetch(isEdit ? `${base}/${sponsor!.id}` : base, {
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a3a5c]">
          <h2 className="text-base font-semibold text-white">{isEdit ? `Edit ${entityLabel}` : `Add ${entityLabel}`}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

          {/* Company */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Company</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company Name *">
                <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Acme Health" className={inputCls} required />
              </Field>
              <Field label="Website">
                <input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
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
          </div>

          {/* Sponsorship */}
          <div className="pt-2 border-t border-[#1a3a5c]">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pt-1">Sponsorship</p>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Event">
                <select value={form.event} onChange={(e) => set('event', e.target.value)} className={inputCls}>
                  <option value="">Select event</option>
                  {EVENT_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
                  {SPONSOR_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            {/* Partner mode: always pick a partner type (keeps it out of sponsors).
                Sponsor mode: tier only shown once Confirmed. */}
            {partnerMode ? (
              <div className="mt-4">
                <Field label="Partner Type">
                  <select value={form.tier || 'Media Partner'} onChange={(e) => set('tier', e.target.value)} className={inputCls}>
                    {PARTNER_TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
            ) : isConfirmed ? (
              <div className="mt-4">
                <Field label="Tier">
                  <select value={form.tier} onChange={(e) => set('tier', e.target.value)} className={inputCls}>
                    <option value="">Select tier</option>
                    {SPONSOR_TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="col-span-2">
                <Field label="Sponsorship Value">
                  <input type="number" step="0.01" min="0" value={form.valueAmount} onChange={(e) => set('valueAmount', e.target.value)} placeholder="0.00" className={inputCls} />
                </Field>
              </div>
              <Field label="Currency">
                <select value={form.valueCurrency} onChange={(e) => set('valueCurrency', e.target.value)} className={inputCls}>
                  {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Package Details">
                <textarea value={form.packageDetails} onChange={(e) => set('packageDetails', e.target.value)} rows={3} placeholder="Describe the sponsorship package, deliverables, inclusions..." className={`${inputCls} resize-none`} />
              </Field>
            </div>
          </div>

          {/* Primary Contact */}
          <div className="pt-2 border-t border-[#1a3a5c]">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pt-1">Primary Contact</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name">
                <input value={form.contactFirstName} onChange={(e) => set('contactFirstName', e.target.value)} placeholder="John" className={inputCls} />
              </Field>
              <Field label="Last Name">
                <input value={form.contactLastName} onChange={(e) => set('contactLastName', e.target.value)} placeholder="Doe" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label="Email">
                <input value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="john@company.com" className={inputCls} />
              </Field>
              <Field label="Phone">
                <input value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="+44 7700 000000" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label="Job Title">
                <input value={form.contactJobTitle} onChange={(e) => set('contactJobTitle', e.target.value)} placeholder="Head of Partnerships" className={inputCls} />
              </Field>
              <Field label="LinkedIn URL">
                <input value={form.contactLinkedinUrl} onChange={(e) => set('contactLinkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Notes */}
          <div className="pt-2 border-t border-[#1a3a5c]">
            <Field label="Notes">
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Internal notes..." className={`${inputCls} resize-none`} />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1a3a5c]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-amber-500 text-[#0A1628] text-sm font-semibold hover:bg-amber-500/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : `Add ${entityLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 bg-[#0A1628] border border-[#1a3a5c] rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500/60 transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}
