'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  companyId: string
  companyName: string
  onClose: () => void
  onSaved: () => void
}

export function SponsorContactModal({ companyId, companyName, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    contactFirstName: '',
    contactLastName: '',
    contactEmail: '',
    contactPhone: '',
    contactJobTitle: '',
    contactLinkedinUrl: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.contactFirstName.trim() && !form.contactLastName.trim()) {
      setError('At least a first or last name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body: any = {
        companyId,
        companyName,
        status: 'Active',
        ...form,
      }
      Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null })
      const res = await fetch('/api/sponsors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
      onSaved()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-[#0d2040] border border-[#1a3a5c] rounded-xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a3a5c]">
          <div>
            <h2 className="text-base font-semibold text-white">Add Contact</h2>
            <p className="text-xs text-slate-500 mt-0.5">{companyName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name">
              <input value={form.contactFirstName} onChange={(e) => set('contactFirstName', e.target.value)} placeholder="John" className={inputCls} />
            </Field>
            <Field label="Last Name">
              <input value={form.contactLastName} onChange={(e) => set('contactLastName', e.target.value)} placeholder="Doe" className={inputCls} />
            </Field>
          </div>

          <Field label="Job Title">
            <input value={form.contactJobTitle} onChange={(e) => set('contactJobTitle', e.target.value)} placeholder="Head of Partnerships" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="john@company.com" className={inputCls} />
            </Field>
            <Field label="Phone">
              <input value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="+44 7700 000000" className={inputCls} />
            </Field>
          </div>

          <Field label="LinkedIn URL">
            <input value={form.contactLinkedinUrl} onChange={(e) => set('contactLinkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." className={inputCls} />
          </Field>

          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Any notes about this contact..." className={`${inputCls} resize-none`} />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1a3a5c]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-amber-500 text-[#0A1628] text-sm font-semibold hover:bg-amber-500/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Add Contact'}
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
