'use client'

// The company form's key (primary) contact. Set: shown as a card, with
// Change (pick another of the company's contacts) and Edit. Not set: pick
// one of the company's contacts, or, when it has none, "Add key contact"
// opens a small form. Picking a contact is saved by the caller through
// set-primary, which keeps the old key contact as an ordinary contact.

import { useState } from 'react'
import { Check, Pencil, Plus, UserRound, X } from 'lucide-react'
import type { SponsorContact } from '@/types'

export interface KeyContact {
  contactFirstName: string
  contactLastName: string
  contactEmail: string
  contactPhone: string
  contactJobTitle: string
  contactLinkedinUrl: string
}

const EMPTY: KeyContact = { contactFirstName: '', contactLastName: '', contactEmail: '', contactPhone: '', contactJobTitle: '', contactLinkedinUrl: '' }
const nameOf = (c: Partial<KeyContact>) => [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ').trim()
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
const inputCls = 'w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-sm text-[var(--fg)] placeholder-slate-500 outline-none focus:border-[var(--teal)] transition-colors'

function Card({ c, note, actions }: { c: Partial<KeyContact>; note?: string; actions?: React.ReactNode }) {
  const name = nameOf(c) || c.contactEmail || 'Unnamed'
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
      <span className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0" style={{ background: 'var(--surface-3)', color: 'var(--fg-2)' }}>{initials(name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{name}</span>
        <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[c.contactJobTitle, c.contactEmail].filter(Boolean).join(' · ') || 'No title or email yet'}</span>
        {note && <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--teal)' }}>{note}</span>}
      </span>
      {actions && <span className="flex items-center gap-1 shrink-0">{actions}</span>}
    </div>
  )
}

export function KeyContactField({ value, onChange, contacts, picked, onPick }: {
  value: KeyContact
  onChange: (v: KeyContact) => void
  contacts: SponsorContact[]
  picked: string | null
  onPick: (id: string | null) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const has = !!(value.contactFirstName || value.contactLastName || value.contactEmail)
  const pickedContact = picked ? contacts.find((c) => c.id === picked) ?? null : null
  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-[var(--fg)] transition-colors'

  const list = (
    <div className="space-y-1.5">
      {contacts.map((c) => {
        const name = nameOf(c as Partial<KeyContact>) || c.contactEmail || 'Unnamed'
        const on = picked === c.id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => { onPick(c.id); setChoosing(false) }}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors"
            style={{ border: `1px solid ${on ? 'var(--teal)' : 'var(--line)'}`, background: on ? 'var(--surface-2)' : 'var(--bg)' }}
          >
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: 'var(--surface-3)', color: 'var(--fg-2)' }}>{initials(name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--fg)' }}>{name}</span>
              <span className="block text-[11.5px] truncate" style={{ color: 'var(--fg-3)' }}>{[c.contactJobTitle, c.contactEmail].filter(Boolean).join(' · ') || '—'}</span>
            </span>
            <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: on ? 'var(--teal)' : 'transparent', border: on ? 'none' : '1.5px solid var(--line-3)' }}>
              {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-2">
      {pickedContact ? (
        <Card
          c={pickedContact as Partial<KeyContact>}
          note="Becomes the key contact when you save"
          actions={<button type="button" onClick={() => { onPick(null); setChoosing(true) }} className={btn}>Change</button>}
        />
      ) : has && !choosing ? (
        <Card
          c={value}
          actions={
            <>
              {contacts.length > 0 && <button type="button" onClick={() => setChoosing(true)} className={btn}>Change</button>}
              <button type="button" onClick={() => setModal('edit')} className={btn}><Pencil className="w-3 h-3" /> Edit</button>
            </>
          }
        />
      ) : contacts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[12px]" style={{ color: 'var(--fg-3)' }}>{has ? 'Choose another of this company’s contacts:' : 'No key contact yet. Choose one of this company’s contacts:'}</p>
          {list}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setModal('add')} className={btn}><Plus className="w-3.5 h-3.5" /> Someone new</button>
            {has && <button type="button" onClick={() => setChoosing(false)} className={btn}>Keep {nameOf(value) || 'the current one'}</button>}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setModal('add')}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-lg text-sm transition-colors hover:bg-[var(--surface-2)]"
          style={{ border: '1px dashed var(--line-3)', color: 'var(--fg-2)' }}
        >
          <UserRound className="w-4 h-4" /> Add key contact
        </button>
      )}

      {modal && (
        <KeyContactModal
          initial={modal === 'edit' ? value : EMPTY}
          title={modal === 'edit' ? 'Edit key contact' : 'Add key contact'}
          onCancel={() => setModal(null)}
          onSave={(v) => { onChange(v); onPick(null); setChoosing(false); setModal(null) }}
        />
      )}
    </div>
  )
}

function KeyContactModal({ initial, title, onCancel, onSave }: { initial: KeyContact; title: string; onCancel: () => void; onSave: (v: KeyContact) => void }) {
  const [v, setV] = useState<KeyContact>(initial)
  const set = (k: keyof KeyContact) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }))
  const ok = !!(v.contactFirstName.trim() || v.contactLastName.trim() || v.contactEmail.trim())
  const field = (label: string, k: keyof KeyContact, placeholder: string, type = 'text') => (
    <label className="space-y-1.5 block">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <input type={type} value={v[k]} onChange={set(k)} placeholder={placeholder} className={inputCls} />
    </label>
  )
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-md rounded-xl shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        onClick={(e) => e.stopPropagation()}
        // It sits inside the company form: Enter saves this, not that.
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (ok) onSave(v) } if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }}
      >
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--line)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{title}</h3>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-[var(--fg)]" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">{field('First name', 'contactFirstName', 'Jane')}{field('Last name', 'contactLastName', 'Doe')}</div>
          {field('Job title', 'contactJobTitle', 'Head of Partnerships')}
          <div className="grid grid-cols-2 gap-3">{field('Email', 'contactEmail', 'jane@company.com', 'email')}{field('Phone', 'contactPhone', '+44 7700 000000', 'tel')}</div>
          {field('LinkedIn', 'contactLinkedinUrl', 'https://linkedin.com/in/…', 'url')}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-[var(--fg)]">Cancel</button>
          <button type="button" disabled={!ok} onClick={() => onSave(v)} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--teal)', color: '#fff' }}>
            {title === 'Edit key contact' ? 'Done' : 'Add key contact'}
          </button>
        </div>
      </div>
    </div>
  )
}
