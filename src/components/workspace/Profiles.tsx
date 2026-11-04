'use client'

// The profile pages for anyone who is not yet on a pipeline (November 2026):
// a company with no sponsor record, and a person known only from a leads
// list. They read like any other profile: the company with its whole team
// across every event, the person with their details and their colleagues,
// and the way on (an End User into Production, a Solution Provider into
// Sales).

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Award, Building2, Globe, Linkedin, Loader2, Mail, MapPin, Mic, Phone, Trash2, Users } from 'lucide-react'
import { CopyPopover } from '@/components/crm/CopyPopover'
import { Fact, eventParts, fmtDate, initials } from '@/components/crm/profileParts'
import { stepsBack } from '@/components/layout/NavMemory'
import { useWorkspace } from '@/lib/workspace'
import { companyKey, type Account, type Person } from '@/lib/segments'
import { AddButton, Members, Sides, TypeBadge, companyHref, recHref, usePipelineAdd } from './Segments'

function useCompany(key: string | null, name: string | null) {
  return useQuery<{ account: Account; people: Person[] }>({
    queryKey: ['ws-segments', 'company', key, name],
    queryFn: async () => {
      const r = await fetch(`/api/companies/${encodeURIComponent(key || '')}?name=${encodeURIComponent(name || '')}`)
      if (!r.ok) throw new Error(r.status === 404 ? 'No company by that name' : 'Could not load the company')
      return r.json()
    },
    enabled: !!name,
    staleTime: 30_000,
  })
}

function BackLink({ fallback }: { fallback: string }) {
  const router = useRouter()
  return (
    <Link href={fallback} onClick={(e) => { const n = stepsBack(); if (n > 0) { e.preventDefault(); if (n === 1) router.back(); else window.history.go(-n) } }} className="ws-btn ws-btn-ghost ws-btn-sm -ml-2">
      <ArrowLeft className="w-3.5 h-3.5" /> Back
    </Link>
  )
}

const shortEvent = (e: string) => e.replace(/^World Health AI/i, 'WHAI').replace(/^World Pharma AI/i, 'WPAI')

// ── A company ────────────────────────────────────────────────────────────────

export function CompanyProfile({ companyKeyParam, name }: { companyKeyParam: string; name: string }) {
  const ws = useWorkspace()
  const { data, isLoading, error } = useCompany(companyKeyParam, name)
  const add = usePipelineAdd()
  const a = data?.account
  const back = ws.href('companies')

  if (isLoading) return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6"><div className="ws-card h-40 animate-pulse" /></div>
  if (error || !a) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <BackLink fallback={back} />
      <div className="ws-card p-6 text-[13.5px]" style={{ color: 'var(--fg-3)' }}>{(error as Error)?.message || 'Not found'}</div>
    </div>
  )
  const inSales = (a.members ?? []).flatMap((m) => m.records).find((r) => r.relationship === 'Sponsor' && add.inYear(r))
  const notes = Array.from(new Set((a.members ?? []).map((m) => m.note).filter(Boolean)))

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <nav><BackLink fallback={back} /></nav>
      <header className="ws-card overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-3">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-semibold shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)', border: '1px solid var(--line)' }}>{initials(a.name)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-medium flex items-center gap-2" style={{ color: 'var(--fg-4)' }}><TypeBadge type={a.firmographic} conflict={a.conflict} /> <Sides sides={a.sides ?? []} /></p>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight truncate mt-0.5" style={{ color: 'var(--fg)' }}>{a.name}</h1>
            <p className="text-[13px] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--fg-3)' }}>
              <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {a.people} {a.people === 1 ? 'person' : 'people'}</span>
              {a.country && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {a.country}</span>}
              {a.website && <a href={a.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline underline-offset-4"><Globe className="w-3.5 h-3.5" /> {a.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>}
            </p>
          </div>
          {/* Sales is for Solution Providers; an End User's people go to Production, one by one below. */}
          {add.event && a.firmographic === 'Solution Provider' && (
            <div className="shrink-0">
              {inSales
                ? <Link href={recHref(ws.slug, inSales) ?? '#'} className="ws-btn ws-btn-sm">In Sales: {inSales.status ?? 'open'}</Link>
                : <AddButton label="Sales pipeline" busy={add.busy === `company:${a.key}`} done={add.done.has(`company:${a.key}`)} onClick={() => add.addCompany(a)} />}
            </div>
          )}
        </div>
        {(a.events ?? []).length > 0 && (
          <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--fg-3)' }}>
            <span className="font-medium mr-1" style={{ color: 'var(--fg-4)' }}>Events</span>
            {(a.events ?? []).map((e) => <span key={e} className="px-2 py-0.5 rounded-md" style={{ border: '1px solid var(--line)' }}>{shortEvent(e)}</span>)}
          </div>
        )}
      </header>

      <section className="ws-card overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Team <span className="font-normal" style={{ color: 'var(--fg-4)' }}>{(a.members ?? []).length}</span></h2>
        </div>
        <div className="[&_li]:!pl-5">
          <Members members={a.members ?? []} query="" company={a.name} add={add} where="event" account={a} />
        </div>
      </section>

      {notes.length > 0 && (
        <section className="ws-card p-4 sm:p-5">
          <h2 className="text-[14px] font-semibold mb-2" style={{ color: 'var(--fg)' }}>Notes</h2>
          <ul className="flex flex-col gap-1.5 text-[13px]" style={{ color: 'var(--fg-2)' }}>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
    </div>
  )
}

// ── A person known from a leads list ─────────────────────────────────────────

type Lead = Record<string, string | null>

export function ContactProfile({ id }: { id: string }) {
  const ws = useWorkspace()
  const router = useRouter()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const { data: lead, isLoading, error } = useQuery<Lead>({
    queryKey: ['lead', id],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${id}`)
      if (!r.ok) throw new Error(r.status === 404 ? 'This contact has moved: they are now in a pipeline, or were removed.' : 'Could not load the contact')
      return r.json()
    },
  })
  const company = useCompany(lead?.companyName ? companyKey(lead.companyName) : null, lead?.companyName ?? null)
  const back = ws.href('contacts')

  const move = async (to: 'speaker' | 'sponsor') => {
    if (!lead?.event) return
    setBusy(to); setErr('')
    try {
      const r = await fetch(`/api/leads/${id}/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, event: lead.event }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error || 'Could not add them')
      qc.invalidateQueries({ queryKey: ['ws-segments'] })
      qc.invalidateQueries({ queryKey: ['ws-board'] })
      router.replace(`/${j.kind === 'speaker' ? 'speakers' : 'sponsors'}/${j.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add them')
      setBusy(null)
    }
  }
  const remove = async () => {
    if (!confirm('Remove this contact from the CRM?')) return
    setBusy('remove')
    const r = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (r.ok) { qc.invalidateQueries({ queryKey: ['ws-segments'] }); router.replace(back) } else { setErr('Could not remove them'); setBusy(null) }
  }

  if (isLoading) return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6"><div className="ws-card h-40 animate-pulse" /></div>
  if (error || !lead) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <BackLink fallback={back} />
      <div className="ws-card p-6 text-[13.5px]" style={{ color: 'var(--fg-3)' }}>{(error as Error)?.message || 'Not found'}</div>
    </div>
  )

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || 'Unnamed'
  const where = [lead.city, lead.country].filter(Boolean).join(', ')
  const edition = lead.event ? eventParts(lead.event) : null
  const acct = company.data?.account
  const type = acct?.firmographic ?? (lead.segment as Account['firmographic'])
  const colleagues = (acct?.members ?? []).filter((m) => !m.records.some((r) => r.table === 'leads' && r.id === id))
  const firmHref = acct ? companyHref(ws.slug, acct) : null

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <nav><BackLink fallback={back} /></nav>

      <header className="ws-card overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)', border: '1px solid var(--line)' }}>{initials(name)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>Contact · {type}</p>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight truncate" style={{ color: 'var(--fg)' }}>{name}</h1>
            {(lead.jobTitle || lead.companyName) && (
              <p className="text-[13.5px] mt-0.5" style={{ color: 'var(--fg-2)' }}>
                {lead.jobTitle}{lead.jobTitle && lead.companyName && <span style={{ color: 'var(--fg-4)' }}> · </span>}
                {lead.companyName && (firmHref ? <Link href={firmHref} className="hover:underline underline-offset-4">{lead.companyName}</Link> : lead.companyName)}
              </p>
            )}
            <div className="flex items-center gap-1 mt-2 flex-wrap -ml-2">
              {lead.email && <CopyPopover label={`${name}'s email`} value={lead.email} title={`Email: ${lead.email}`}><Mail className="w-3.5 h-3.5" /> <span className="max-w-[240px] truncate">{lead.email}</span></CopyPopover>}
              {lead.email2 && <CopyPopover label={`${name}'s other email`} value={lead.email2} title={`Email: ${lead.email2}`}><Mail className="w-3.5 h-3.5" /> <span className="max-w-[240px] truncate">{lead.email2}</span></CopyPopover>}
              {lead.phone && <CopyPopover label={`${name}'s phone`} value={lead.phone} title={`Phone: ${lead.phone}`}><Phone className="w-3.5 h-3.5" /> {lead.phone}</CopyPopover>}
              {lead.linkedinUrl && <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="ws-btn ws-btn-ghost ws-btn-sm"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</a>}
            </div>
          </div>
          <button onClick={remove} disabled={!!busy} className="ws-btn ws-btn-sm ws-btn-ghost shrink-0" title="Delete this contact" aria-label="Delete this contact" style={{ color: 'var(--bad)' }}>
            {busy === 'remove' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <span className="text-[12px] font-medium mr-1" style={{ color: 'var(--fg-4)' }}>Not in a pipeline yet{edition ? ` · ${edition.title}` : ''}</span>
          {type === 'End User' ? (
            <button onClick={() => move('speaker')} disabled={!!busy} className="ws-btn ws-btn-sm">
              {busy === 'speaker' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />} Production pipeline
            </button>
          ) : (
            <button onClick={() => move('sponsor')} disabled={!!busy || !lead.companyName} className="ws-btn ws-btn-sm" title={lead.companyName ? `${lead.companyName} into Sales, with ${name} as its contact` : 'No company to add'}>
              {busy === 'sponsor' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />} Sales pipeline
            </button>
          )}
          {err && <span className="text-[12px]" style={{ color: 'var(--bad)' }}>{err}</span>}
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <section className="ws-card p-4 sm:p-5">
          <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--fg)' }}>About</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <Fact label="Company" value={lead.companyName ? <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {lead.companyName}</span> : '—'} />
            <Fact label="Type" value={type || '—'} />
            <Fact label="Location" value={where ? <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {where}</span> : '—'} />
            <Fact label="Industry" value={[lead.industry, lead.subIndustry].filter(Boolean).join(' · ') || '—'} />
            <Fact label="Website" value={lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline underline-offset-4"><Globe className="w-3.5 h-3.5" /> {lead.website.replace(/^https?:\/\/(www\.)?/, '')}</a> : '—'} />
            <Fact label="Added" value={fmtDate(lead.createdAt)} />
          </dl>
          {lead.notes && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
              <p className="text-[11.5px] font-medium mb-1" style={{ color: 'var(--fg-4)' }}>Notes</p>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fg-2)' }}>{lead.notes}</p>
            </div>
          )}
        </section>

        <section className="ws-card overflow-hidden">
          <div className="px-4 sm:px-5 pt-4 pb-2 flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>
              {lead.companyName ? <>Colleagues at {lead.companyName}</> : 'Colleagues'} <span className="font-normal" style={{ color: 'var(--fg-4)' }}>{company.isLoading ? '' : colleagues.length}</span>
            </h2>
            {firmHref && <Link href={firmHref} className="text-[12.5px] hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>Company profile</Link>}
          </div>
          {company.isLoading ? <div className="h-24 m-4 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} /> :
           colleagues.length === 0 ? <p className="px-5 pb-5 text-[13px]" style={{ color: 'var(--fg-4)' }}>No one else at {lead.companyName || 'their company'} yet.</p> : (
            <div className="[&_li]:!pl-5">
              <Members members={colleagues} query="" company={acct!.name} where="year" />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
