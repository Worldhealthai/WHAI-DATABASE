'use client'

// A person from a leads list (crm.leads): who they are, where they came
// from, and the two ways on: into the speaker pipeline (Production) or into
// Sales as their company's contact, both at Not contacted in their edition.
// Once moved they leave the list and this page opens their new record.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Award, Building2, Globe, Linkedin, Loader2, Mail, MapPin, Mic, Phone, Trash2 } from 'lucide-react'
import { CopyPopover } from '@/components/crm/CopyPopover'
import { Fact, eventParts, fmtDate, initials } from '@/components/crm/profileParts'
import { stepsBack } from '@/components/layout/NavMemory'
import { useWorkspaceFromUrl } from '@/lib/workspace'

type Lead = Record<string, string | null>

export default function LeadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const ws = useWorkspaceFromUrl()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const { data: lead, isLoading, error } = useQuery<Lead>({
    queryKey: ['lead', id],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${id}`)
      if (!r.ok) throw new Error(r.status === 404 ? 'This lead is no longer on the list. They may have been moved into a pipeline.' : 'Could not load the lead')
      return r.json()
    },
  })
  const back = ws.portal && ws.slug ? ws.href('companies') : '/'
  const goBack = (e: React.MouseEvent) => { const n = stepsBack(); if (n > 0) { e.preventDefault(); if (n === 1) router.back(); else window.history.go(-n) } }

  const move = async (to: 'speaker' | 'sponsor') => {
    if (!lead?.event) return
    setBusy(to); setErr('')
    try {
      const r = await fetch(`/api/leads/${id}/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, event: lead.event }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error || 'Could not move them')
      qc.invalidateQueries({ queryKey: ['ws-segments'] })
      qc.invalidateQueries({ queryKey: ['ws-board'] })
      router.replace(`/${j.kind === 'speaker' ? 'speakers' : 'sponsors'}/${j.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not move them')
      setBusy(null)
    }
  }
  const remove = async () => {
    if (!confirm('Remove this person from the leads list?')) return
    setBusy('remove')
    const r = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (r.ok) { qc.invalidateQueries({ queryKey: ['ws-segments'] }); router.replace(back) } else { setErr('Could not remove them'); setBusy(null) }
  }

  if (isLoading) return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6"><div className="ws-card h-40 animate-pulse" /></div>
  if (error || !lead) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <Link href={back} onClick={goBack} className="ws-btn ws-btn-ghost ws-btn-sm -ml-2"><ArrowLeft className="w-3.5 h-3.5" /> Back</Link>
      <div className="ws-card p-6 text-[13.5px]" style={{ color: 'var(--fg-3)' }}>{(error as Error)?.message || 'Not found'}</div>
    </div>
  )

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || 'Unnamed'
  const where = [lead.city, lead.country].filter(Boolean).join(', ')
  const edition = lead.event ? eventParts(lead.event) : null

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <nav><Link href={back} onClick={goBack} className="ws-btn ws-btn-ghost ws-btn-sm -ml-2"><ArrowLeft className="w-3.5 h-3.5" /> Back</Link></nav>

      <header className="ws-card overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)', border: '1px solid var(--line)' }}>{initials(name)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>Lead · {lead.segment}</p>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight truncate" style={{ color: 'var(--fg)' }}>{name}</h1>
            {(lead.jobTitle || lead.companyName) && (
              <p className="text-[13.5px] mt-0.5" style={{ color: 'var(--fg-2)' }}>
                {lead.jobTitle}{lead.jobTitle && lead.companyName && <span style={{ color: 'var(--fg-4)' }}> · </span>}{lead.companyName}
              </p>
            )}
            <div className="flex items-center gap-1 mt-2 flex-wrap -ml-2">
              {lead.email && <CopyPopover label={`${name}'s email`} value={lead.email} title={`Email: ${lead.email}`}><Mail className="w-3.5 h-3.5" /> <span className="max-w-[240px] truncate">{lead.email}</span></CopyPopover>}
              {lead.email2 && <CopyPopover label={`${name}'s other email`} value={lead.email2} title={`Email: ${lead.email2}`}><Mail className="w-3.5 h-3.5" /> <span className="max-w-[240px] truncate">{lead.email2}</span></CopyPopover>}
              {lead.phone && <CopyPopover label={`${name}'s phone`} value={lead.phone} title={`Phone: ${lead.phone}`}><Phone className="w-3.5 h-3.5" /> {lead.phone}</CopyPopover>}
              {lead.linkedinUrl && <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="ws-btn ws-btn-ghost ws-btn-sm"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</a>}
            </div>
          </div>
          <button onClick={remove} disabled={!!busy} className="ws-btn ws-btn-sm ws-btn-ghost shrink-0" title="Remove from the leads list" aria-label="Remove from the leads list" style={{ color: 'var(--bad)' }}>
            {busy === 'remove' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
        {/* The ways on */}
        <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <span className="text-[12px] font-medium mr-1" style={{ color: 'var(--fg-4)' }}>Add to {edition ? edition.title : 'the event'}</span>
          <button onClick={() => move('speaker')} disabled={!!busy} className="ws-btn ws-btn-sm">
            {busy === 'speaker' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />} Speaker pipeline
          </button>
          <button onClick={() => move('sponsor')} disabled={!!busy || !lead.companyName} className="ws-btn ws-btn-sm" title={lead.companyName ? `${lead.companyName} into Sales, with ${name} as its contact` : 'No company to add'}>
            {busy === 'sponsor' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />} Sales pipeline
          </button>
          {err && <span className="text-[12px]" style={{ color: 'var(--bad)' }}>{err}</span>}
        </div>
      </header>

      <section className="ws-card p-4 sm:p-5">
        <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--fg)' }}>Where they came from</h2>
        {lead.notes && <p className="text-[13.5px] leading-relaxed mb-4" style={{ color: 'var(--fg-2)' }}>{lead.notes}</p>}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
          <Fact label="List" value={lead.source || '—'} />
          <Fact label="Tab" value={lead.sourceTab || '—'} />
          <Fact label="Type" value={lead.segment || '—'} />
          <Fact label="Added" value={fmtDate(lead.createdAt)} />
          <Fact label="Industry" value={[lead.industry, lead.subIndustry].filter(Boolean).join(' · ') || '—'} />
          <Fact label="Location" value={where ? <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {where}</span> : '—'} />
          <Fact label="Company" value={lead.companyName ? <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {lead.companyName}</span> : '—'} />
          <Fact label="Website" value={lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline underline-offset-4"><Globe className="w-3.5 h-3.5" /> {lead.website.replace(/^https?:\/\/(www\.)?/, '')}</a> : '—'} />
        </dl>
      </section>
    </div>
  )
}
