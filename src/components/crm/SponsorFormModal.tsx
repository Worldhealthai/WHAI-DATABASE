'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTierOptions } from '@/lib/useTierOptions'
import { X, AlertTriangle } from 'lucide-react'
import type { Sponsor, SponsorContact } from '@/types'
import { useEventOptions, useUpcomingEventOptions } from '@/lib/useEventOptions'
import { EventPicker } from '@/components/crm/EventPicker'
import { KeyContactField } from '@/components/crm/KeyContactField'
import {
  SPONSOR_TIER_OPTIONS,
  SPONSOR_STATUS_OPTIONS,
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
  const tierOptions = useTierOptions()
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
    tier: sponsor?.tier ?? defaultTier ?? (partnerMode ? 'Media Partner' : ''),
    status: sponsor?.status ?? 'Not Contacted',
    event: sponsor?.event ?? '',
    valueAmount: sponsor?.valueAmount ? String(sponsor.valueAmount) : '',
    valueCurrency: sponsor?.valueCurrency ?? 'GBP',
    packageDetails: sponsor?.packageDetails ?? '',

    notes: sponsor?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const eventOptions = useEventOptions()
  // The events the company is to be in. Adding: the first is this record's,
  // each other gets a record of its own. Editing: it starts as the events
  // the company is in now; ticking one adds it, unticking one takes the
  // company out of it (lib/companyEditions).
  const [pickedEvents, setPickedEvents] = useState<string[]>(!isEdit && sponsor?.event ? [sponsor.event] : [])
  const [pickedReady, setPickedReady] = useState(!isEdit)
  const router = useRouter()
  const togglePicked = (ev: string) => setPickedEvents((p) => (p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev]))
  const [moving, setMoving] = useState(false)
  // The company's other contacts, to choose the key contact from; the one
  // picked is made key on save (set-primary).
  const [pickedKeyId, setPickedKeyId] = useState<string | null>(null)
  const { data: withContacts } = useQuery<{ contacts?: SponsorContact[] }>({
    queryKey: ['company-contacts', partnerMode ? 'partner' : 'sponsor', sponsor?.id],
    queryFn: async () => {
      const r = await fetch(`${partnerMode ? '/api/partners' : '/api/sponsors'}/${sponsor!.id}`)
      if (!r.ok) throw new Error('contacts')
      return r.json()
    },
    enabled: isEdit,
  })
  const companyContacts = withContacts?.contacts ?? []
  const queryClient = useQueryClient()
  // Editing: the events the company is already in aren't offered again.
  const { data: inEvents } = useQuery<{ editions: { id: string; event: string | null }[] }>({
    queryKey: ['company-events', partnerMode ? 'partner' : 'sponsor', sponsor?.id],
    queryFn: async () => {
      const r = await fetch(`${partnerMode ? '/api/partners' : '/api/sponsors'}/${sponsor!.id}/editions`)
      if (!r.ok) throw new Error('editions')
      return r.json()
    },
    enabled: isEdit,
  })
  const existingEvents = Array.from(new Set((inEvents?.editions ?? []).map((e) => String(e.event ?? '')).filter(Boolean)))
  // Editing starts from the events the company is in now.
  useEffect(() => {
    if (!isEdit || pickedReady || !inEvents) return
    setPickedEvents(existingEvents)
    setPickedReady(true)
  }, [isEdit, pickedReady, inEvents, existingEvents])
  // Only events still to come are offered (and, adding from a past
  // edition's page, that edition too).
  const upcoming = useUpcomingEventOptions()
  const pickable = !isEdit && sponsor?.event && !upcoming.includes(sponsor.event) ? [sponsor.event, ...upcoming] : upcoming
  const [error, setError] = useState('')
  const [dupMatch, setDupMatch] = useState<{
    id: string; existingName: string; status: string; table: string
  } | null>(null)

  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }))

  // Live duplicate check: as the company name is typed, look for an existing
  // company with the same or a similar name (fuzzy — catches "Accurx Ltd"
  // vs "AccuRx") across both Sponsors and Partners.
  useEffect(() => {
    const name = form.companyName.trim()
    if (name.length < 3 || (isEdit && name === (sponsor?.companyName ?? '').trim())) {
      setDupMatch(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: [], names: [], companyNames: [name] }),
        })
        if (!res.ok) return
        const { duplicates } = await res.json()
        const best = (duplicates ?? [])
          .filter((d: any) => d.match === 'company' && d.id && d.id !== sponsor?.id)
          .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))[0]
        setDupMatch(best ?? null)
      } catch { /* non-blocking */ }
    }, 400)
    return () => clearTimeout(t)
  }, [form.companyName, isEdit, sponsor?.companyName, sponsor?.id])

  const isConfirmed = form.status === 'Confirmed'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.companyName.trim()) { setError('Company name is required.'); return }
    setSaving(true); setError('')
    try {
      const lc = (x: string) => x.toLowerCase()
      const mainEvent = isEdit ? form.event : pickedEvents[0] || ''
      const extraEvents = isEdit
        ? pickedEvents.filter((ev) => !existingEvents.some((x) => lc(x) === lc(ev)))
        : pickedEvents.slice(1).filter((ev) => ev !== mainEvent)
      const removeEvents = isEdit && pickedReady ? existingEvents.filter((ev) => !pickedEvents.some((x) => lc(x) === lc(ev))) : []
      const removingThis = !!form.event && removeEvents.some((ev) => lc(ev) === lc(form.event))
      if (isEdit && existingEvents.length > 0 && pickedEvents.length === 0) {
        setError(`Keep ${form.companyName.trim() || 'the company'} in at least one event, or use Delete to remove it from the CRM.`)
        setSaving(false)
        return
      }
      if (removeEvents.length && !window.confirm(
        `Take ${form.companyName.trim() || 'this company'} out of ${removeEvents.join(', ')}?\n\nIts stage, value, notes, contacts and activity for ${removeEvents.length === 1 ? 'that event' : 'those events'} will be deleted. This can't be undone.`
      )) { setSaving(false); return }
      const body: any = {
        ...form,
        event: mainEvent,
        valueAmount: form.valueAmount ? parseFloat(form.valueAmount) : null,
        // Partners must always carry a partner tier so they never leak into
        // the sponsors list. Sponsors only get a tier once Confirmed.
        tier: partnerMode
          ? (PARTNER_TIER_OPTIONS.includes(form.tier) ? form.tier : 'Media Partner')
          : keepTier ? (form.tier || null) : (isConfirmed ? form.tier || null : null),
      }
      Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null })
      // A contact picked from the list becomes key through set-primary,
      // which also keeps the old key contact as an ordinary contact.
      if (pickedKeyId) for (const k of ['contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone', 'contactJobTitle', 'contactLinkedinUrl']) delete body[k]

      const base = partnerMode ? '/api/partners' : '/api/sponsors'
      // A record about to be taken out of its event isn't saved first.
      let saved: any = sponsor
      if (!removingThis) {
        const res = await fetch(isEdit ? `${base}/${sponsor!.id}` : base, {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || 'Failed to save')
        }
        saved = await res.json()
        if (pickedKeyId && saved?.id) {
          const key = await fetch(`${base}/${saved.id}/set-primary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contactId: pickedKeyId }),
          })
          if (!key.ok) throw new Error('Saved, but the key contact was not changed. Please try again.')
        }
      }
      if (saved?.id && extraEvents.length) {
        const more = await fetch(`${base}/${saved.id}/editions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: extraEvents }),
        })
        if (!more.ok) {
          const data = await more.json().catch(() => null)
          throw new Error(`Saved, but not added to the other events: ${data?.error || 'please try again from the company page'}.`)
        }
      }
      let goTo: string | null = null
      if (removeEvents.length) {
        const out = await fetch(`${base}/${sponsor!.id}/editions`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: removeEvents }),
        })
        const data = await out.json().catch(() => null)
        if (!out.ok) throw new Error(`Not taken out of ${removeEvents.join(', ')}: ${data?.error || 'please try again'}.`)
        // This record was one of them: open the company in an event it is still in.
        if (removingThis) {
          const next = (data?.remaining ?? [])[0]
          goTo = next ? `${partnerMode ? '/partners' : '/sponsors'}/${next.id}` : partnerMode ? '/partners' : '/sponsors'
        }
      }
      if (extraEvents.length || removeEvents.length) {
        for (const key of ['company-events', 'ws-list', 'ws-board', 'ws-stats']) queryClient.invalidateQueries({ queryKey: [key] })
      }
      if (goTo) { onClose(); router.push(goTo); return }
      onSaved(saved)
    } catch (err: any) {
      setError(err?.message && err.message !== 'Failed to save' ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)]">
          <h2 className="text-base font-semibold text-[var(--fg)]">{isEdit ? `Edit ${entityLabel}` : `Add ${entityLabel}`}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-[var(--fg)] transition-colors"><X className="w-5 h-5" /></button>
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
            {dupMatch && (
              <div className="mt-3 flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2.5 text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Similar company already in your CRM:{' '}
                  <a
                    href={`${dupMatch.table === 'partners' ? '/partners' : '/sponsors'}/${dupMatch.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline hover:text-amber-200"
                  >
                    {dupMatch.existingName}
                  </a>{' '}
                  ({dupMatch.table === 'partners' ? 'Partners' : 'Sponsors'} · {dupMatch.status}).
                  {' '}Open it instead of creating a duplicate — or save anyway if this is genuinely a different company.
                </span>
              </div>
            )}
          </div>

          {/* Sponsorship */}
          <div className="pt-2 border-t border-[var(--line)]">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pt-1">Sponsorship</p>

            {/* Events: one or more. Each keeps its own stage and value. */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <label className="text-xs font-medium text-slate-400">Events</label>
                {pickedEvents.length > 0 && (
                  <span className="text-[11.5px]" style={{ color: 'var(--fg-3)' }}>
                    {pickedEvents.length} {pickedEvents.length === 1 ? 'event' : 'events'}
                  </span>
                )}
              </div>
              <p className="text-[11.5px]" style={{ color: 'var(--fg-4)' }}>
                {isEdit
                  ? 'Tick to add the company to an event (its contacts are copied); untick to take it out. Each event keeps its own stage and value.'
                  : 'Pick one or more. Each event keeps its own stage and value.'}
              </p>
              <EventPicker
                options={pickable}
                selected={pickedEvents}
                onToggle={togglePicked}
                existing={isEdit ? existingEvents : []}
                current={isEdit ? form.event || null : null}
              />
              {isEdit && (
                moving ? (
                  <div className="flex items-center gap-2 pt-1">
                    <select value={form.event} onChange={(e) => set('event', e.target.value)} className={inputCls}>
                      <option value="">No event</option>
                      {(form.event && !eventOptions.includes(form.event) ? [form.event, ...eventOptions] : eventOptions).map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <button type="button" onClick={() => setMoving(false)} className="text-xs whitespace-nowrap" style={{ color: 'var(--fg-3)' }}>Done</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setMoving(true)} className="text-[11.5px] hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
                    Move this record to a different event
                  </button>
                )
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
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
                    {tierOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
            ) : null}

            {/* Deal fields only matter once the deal is closed — they appear
                when the status reaches Confirmed. */}
            {isConfirmed ? (
              <>
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
              </>
            ) : (
              <p className="mt-4 text-xs text-slate-500">
                Value &amp; package fields appear once the status is <span className="text-slate-300">Confirmed</span>.
              </p>
            )}
          </div>

          {/* Key contact: pick one of the company's contacts, or add one */}
          <div className="pt-2 border-t border-[var(--line)]">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pt-1">Key contact</p>
            <KeyContactField
              value={{
                contactFirstName: form.contactFirstName, contactLastName: form.contactLastName, contactEmail: form.contactEmail,
                contactPhone: form.contactPhone, contactJobTitle: form.contactJobTitle, contactLinkedinUrl: form.contactLinkedinUrl,
              }}
              onChange={(v) => setForm((p) => ({ ...p, ...v }))}
              contacts={companyContacts}
              picked={pickedKeyId}
              onPick={setPickedKeyId}
            />
          </div>

          {/* Notes */}
          <div className="pt-2 border-t border-[var(--line)]">
            <Field label="Notes">
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Internal notes..." className={`${inputCls} resize-none`} />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--line)]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-[var(--fg)] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-amber-500 text-[var(--on-accent)] text-sm font-semibold hover:bg-amber-500/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : `Add ${entityLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-sm text-[var(--fg)] placeholder-slate-500 outline-none focus:border-amber-500/60 transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}
