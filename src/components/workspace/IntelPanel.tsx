'use client'

// The company intelligence layer on a company's page (November 2026): what
// a company is and does, with where each fact came from; the hospitals a
// vendor has announced work with (and the vendors a hospital has), each with
// its evidence; companies like it, with the reasons; named competitors,
// suggested until a person confirms them; the people Lusha names; and
// recent signals. Reads /api/intel/company (crm.intel_company) and
// /api/intel/cards (crm.v_intel_cards); writes a person's verdicts through
// /api/intel/review and an AI-written description through
// /api/intel/describe. Nothing here invents a number: every figure shown
// carries the source the database holds for it.
//
// The pieces are laid out by the profile pages (workspace/Profiles,
// crm/CompanyProfile): the strip in the header, the description and the
// deployments table in the main column, the rest (IntelSidebar) in the
// sidebar, the Lusha-named people under the team.

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronRight, ExternalLink, Linkedin, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { ContactLink } from '@/components/crm/ContactLink'
import { fmtDate } from '@/components/crm/profileParts'
import { companyKey, type Firmographic } from '@/lib/segments'
import type { Competitor, Confidence, Deployment, IntelCard, IntelCompany, Source } from '@/lib/intel'
import { isProvider, providerTypeLabel, reasonText } from '@/lib/intel'
import { Initials } from './ui'

// ── Reading ──────────────────────────────────────────────────────────────────

export function useIntel(key: string | null, name: string | null) {
  return useQuery<{ company: IntelCompany | null }>({
    queryKey: ['intel', 'company', key, name],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (key) p.set('key', key)
      if (name) p.set('name', name)
      const r = await fetch(`/api/intel/company?${p}`)
      if (!r.ok) throw new Error('Could not load the company intelligence')
      return r.json()
    },
    enabled: !!(key || name),
    staleTime: 60_000,
  })
}

const CHUNK = 60

export interface IntelCards {
  cardFor: (key: string, name: string) => IntelCard | null
  ask: (keys: string[]) => void
  failed: boolean
  categories: string[]
  known: Map<string, IntelCard | null>
}

// The light rows for the companies in view, fetched in chunks of CRM keys as
// the page asks for them (ask, or useIntelCardsFor) and kept for the life of
// the tab. `cardFor` reads by the CRM key, then by the key of the name.
export function useIntelCards(): IntelCards {
  const [cards, setCards] = useState<Map<string, IntelCard | null>>(() => new Map())
  const asked = useRef<Set<string>>(new Set())
  const [failed, setFailed] = useState(false)
  const cats = useQuery<{ categories: string[] }>({
    queryKey: ['intel', 'categories'],
    queryFn: async () => {
      const r = await fetch('/api/intel/cards')
      if (!r.ok) throw new Error('intel categories')
      return r.json()
    },
    staleTime: 5 * 60_000,
  })
  const ask = useCallback((keys: string[]) => {
    const fresh = Array.from(new Set(keys.filter((k) => k && k !== '__none' && !asked.current.has(k))))
    if (!fresh.length) return
    for (const k of fresh) asked.current.add(k)
    const run = async () => {
      for (let i = 0; i < fresh.length; i += CHUNK) {
        const batch = fresh.slice(i, i + CHUNK)
        try {
          const r = await fetch(`/api/intel/cards?keys=${encodeURIComponent(batch.join(','))}`)
          if (!r.ok) throw new Error('intel cards')
          const j = (await r.json()) as { cards?: IntelCard[] }
          // Read outside the state update, so a malformed answer is caught here
          // instead of breaking the page while it renders.
          const list = Array.isArray(j?.cards) ? j.cards : []
          setCards((m) => {
            const next = new Map(m)
            for (const k of batch) next.set(k, null)
            for (const c of list) next.set(c.crmKey, c)
            return next
          })
        } catch {
          for (const k of batch) asked.current.delete(k)
          setFailed(true)
        }
      }
    }
    void run()
  }, [])
  const cardFor = useCallback((key: string, name: string): IntelCard | null => cards.get(key) ?? cards.get(companyKey(name) ?? '') ?? null, [cards])
  return { cardFor, ask, failed, categories: Array.isArray(cats.data?.categories) ? cats.data.categories : [], known: cards }
}

// Asks for these keys' cards whenever they change; true once every one of
// them has an answer (a card, or none on file).
export function useIntelCardsFor(intel: IntelCards, keys: string[]): boolean {
  const { ask, known } = intel
  useEffect(() => { ask(keys) }, [ask, keys])
  return keys.length > 0 && keys.every((k) => k === '__none' || known.has(k))
}

async function review(action: 'verify_description' | 'competitor' | 'deployment', payload: Record<string, unknown>) {
  const r = await fetch('/api/intel/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'The review was not saved')
  return j as { ok: true; reviewedBy?: string; reviewedAt?: string; verifiedBy?: string; verifiedAt?: string }
}

// ── Small marks ──────────────────────────────────────────────────────────────

export const usd = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1).replace(/\.0$/, '')}bn` : n >= 1e6 ? `$${Math.round(n / 1e6)}m` : `$${Math.round(n / 1e3)}k`)
const monthYear = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '')
export const companyPath = (slug: string | null, key: string, name: string) => (slug ? `/event/${slug}/companies/${encodeURIComponent(key)}?name=${encodeURIComponent(name)}` : '#')
const num = (n: number) => n.toLocaleString('en-GB')

const CONF: Record<Confidence, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const CONF_INK: Record<Confidence, string> = { high: 'var(--ok)', medium: 'var(--warn)', low: 'var(--line-3)' }

// How old a piece of evidence is, said only once it is more than eighteen
// months old: "2½ yrs ago".
function evidenceAge(iso: string | null | undefined): string | null {
  if (!iso) return null
  const months = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  if (!Number.isFinite(months) || months < 18) return null
  const half = Math.round(months / 6) / 2
  const whole = Math.floor(half)
  const text = half - whole === 0.5 ? `${whole}½` : String(whole)
  return `${text} ${half === 1 ? 'yr' : 'yrs'} ago`
}

// How sure we are, and whether a person has checked it: "High ✓ verified",
// or "High" alone while nobody has (the tooltip says so).
function ConfidenceMark({ level, verifiedBy, verifiedAt }: { level: Confidence | null; verifiedBy?: string | null; verifiedAt?: string | null }) {
  if (!level) return <span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>—</span>
  const title = verifiedBy ? `${CONF[level]} confidence; checked by ${verifiedBy}${verifiedAt ? `, ${fmtDate(verifiedAt)}` : ''}` : `${CONF[level]} confidence; not yet checked by anyone on the team`
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap" style={{ color: 'var(--fg-3)' }} title={title}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CONF_INK[level] }} />
      {CONF[level]}
      {verifiedBy && <span className="inline-flex items-center gap-1" style={{ color: 'var(--fg-2)' }}><Check className="w-3 h-3" style={{ color: 'var(--ok)' }} /> verified</span>}
    </span>
  )
}

// Where a fact came from and when, with the page it came from. Plain inline
// text, so the link icon stays with the date when the label wraps.
function SourceLine({ source, className = '', showAge = false }: { source: Source; className?: string; showAge?: boolean }) {
  const age = showAge ? evidenceAge(source.date) : null
  const text = (
    <>
      {source.label}
      {source.date ? <span style={{ color: 'var(--fg-4)' }}> · {fmtDate(source.date)}{age ? ` · ${age}` : ''}</span> : null}
    </>
  )
  return source.url ? (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className={`text-[12px] hover:underline underline-offset-4 ${className}`} style={{ color: 'var(--fg-3)' }} title={source.url}>
      {text}<ExternalLink className="inline-block align-[-2px] ml-1 w-3 h-3" style={{ color: 'var(--fg-4)' }} />
    </a>
  ) : (
    <span className={`text-[12px] ${className}`} style={{ color: 'var(--fg-3)' }}>{text}</span>
  )
}

const STATUS_INK: Partial<Record<Deployment['status'], string>> = { Production: 'var(--ok)', Expanded: 'var(--ok)', Discontinued: 'var(--bad)' }
// A deployment's status, as the source or an analyst recorded it.
// 'Announced' is the default when the source says nothing more.
function Status({ d }: { d: Deployment }) {
  const from = d.status === 'Announced' ? 'Announced: the source names the hospital but not a go-live'
    : d.status === 'Not known' ? 'No source says how far this went'
    : d.evidence ? `${d.status} · per ${d.evidence.label.replace(/\s*\(.*\)$/, '')}${d.evidence.date ? `, ${fmtDate(d.evidence.date)}` : ''}` : undefined
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap" style={{ color: d.status === 'Not known' ? 'var(--fg-4)' : 'var(--fg)' }} title={from}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_INK[d.status] ?? (d.status === 'Not known' ? 'var(--line-2)' : 'var(--line-3)') }} />
      {d.status}
    </span>
  )
}

// A card in the sidebar: a small heading with its count, an optional note
// as a tooltip on the heading, and rows underneath.
function SideCard({ title, count, note, children, className = '', foot }: { title: string; count?: React.ReactNode; note?: string; children: React.ReactNode; className?: string; foot?: React.ReactNode }) {
  return (
    <section className={`ws-card overflow-hidden ${className}`}>
      <div className="px-4 pt-3 pb-1.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[13.5px] font-semibold" style={{ color: 'var(--fg)' }} title={note}>{title} {count != null && <span className="font-normal" style={{ color: 'var(--fg-4)' }}>{count}</span>}</h2>
      </div>
      {children}
      {foot}
    </section>
  )
}

// ── The ten-second strip, inside the header ──────────────────────────────────

// One row: the one-liner, then the categories and the facts (team, HQ,
// founded, funding, revenue, beds, status). Where a fact came from is in its
// tooltip; the Lusha facts say so once, in small grey at the end of the row.
export function IntelStrip({ c }: { c: IntelCompany }) {
  const provider = isProvider(c)
  const facts: { label: string; value: React.ReactNode; title?: string }[] = []
  if (c.teamFact) facts.push({ label: 'Team', value: `about ${num(c.teamFact.value)}`, title: `${c.teamFact.source.label}${c.teamFact.source.date ? `, ${monthYear(c.teamFact.source.date)}` : ''}${c.teamRange ? `; Lusha bucket ${c.teamRange}` : ''}; ${CONF[c.teamFact.confidence].toLowerCase()} confidence. A LinkedIn-based estimate, not a headcount.` })
  if (c.hq) facts.push({ label: 'HQ', value: provider && c.region ? c.region : c.hq })
  if (c.founded) facts.push({ label: provider ? 'Formed' : 'Founded', value: String(c.founded) })
  if (c.funding && (c.funding.totalUsd || c.funding.lastRoundUsd)) {
    const last = c.funding.lastRoundUsd ? `${c.funding.lastRoundType ?? 'Last round'} ${usd(c.funding.lastRoundUsd)}${c.funding.lastRoundDate ? `, ${monthYear(c.funding.lastRoundDate)}` : ''}` : null
    facts.push({ label: 'Funding', value: [c.funding.totalUsd ? usd(c.funding.totalUsd) : null, last].filter(Boolean).join(' · '), title: `${c.funding.source.label}${c.funding.source.date ? `, ${monthYear(c.funding.source.date)}` : ''}; ${CONF[c.funding.confidence].toLowerCase()} confidence` })
  }
  if (c.revenueBand && (c.revenueBand.minUsd || c.revenueBand.maxUsd)) facts.push({ label: 'Revenue', value: [c.revenueBand.minUsd, c.revenueBand.maxUsd].filter((n): n is number => n != null).map(usd).join('–'), title: `${c.revenueBand.source.label}${c.revenueBand.source.date ? `, ${monthYear(c.revenueBand.source.date)}` : ''}` })
  if (c.beds) facts.push({ label: 'Beds', value: `about ${num(c.beds)}`, title: `${c.sourceKind === 'seed' ? 'Seed data' : 'WNG Intelligence dataset'}, unverified` })
  if (c.status && c.status !== 'Active') facts.push({ label: 'Status', value: c.acquiredBy ? `${c.status} by ${c.acquiredBy}` : c.status })
  const lusha = [c.teamFact?.source.kind === 'lusha' && 'team', c.funding?.source.kind === 'lusha' && 'funding', c.revenueBand && 'revenue'].filter(Boolean) as string[]
  if (!c.oneLiner && !facts.length && !c.categories.length) return null
  const lushaNote = lusha.length ? `${lusha.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(lusha.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1')} from Lusha${c.teamFact?.source.date ? `, ${monthYear(c.teamFact.source.date)}` : ''}` : null
  return (
    <div className="px-4 sm:px-5 py-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--line)' }}>
      {c.oneLiner && <p className="text-[13.5px]" style={{ color: 'var(--fg-2)' }}>{c.oneLiner}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]" style={{ color: 'var(--fg-3)' }}>
        {c.categories.length > 0 && (
          <span className="inline-flex flex-wrap gap-1.5">
            {c.categories.map((k) => <span key={k} className="px-2 py-0.5 rounded-md text-[12px]" style={{ border: '1px solid var(--line)', color: 'var(--fg-2)' }}>{k}</span>)}
          </span>
        )}
        {facts.map((f) => (
          <span key={f.label} className="inline-flex items-baseline gap-1" title={f.title}>
            <span className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>{f.label}</span>
            <span style={{ color: 'var(--fg-2)' }}>{f.value}</span>
          </span>
        ))}
        {lushaNote && <span className="text-[11.5px]" style={{ color: 'var(--fg-4)' }} title="Team size is a LinkedIn-based estimate, not a headcount">{lushaNote}</span>}
      </div>
    </div>
  )
}

// ── What they do ─────────────────────────────────────────────────────────────

// Who wrote the description, said next to the heading. An AI-written one
// carries the note the owner asked for, in small grey text.
function DescriptionOrigin({ kind }: { kind: IntelCompany['description']['kind'] }) {
  const text = kind === 'ai' ? 'AI generated description' : kind === 'lusha' ? 'Description from Lusha' : 'Description from the WNG Intelligence dataset'
  return <span className="text-[11.5px] font-normal" style={{ color: 'var(--fg-4)' }}>{text}</span>
}

export function IntelDescription({ c, className = '' }: { c: IntelCompany; className?: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'verify' | 'write' | null>(null)
  const [err, setErr] = useState('')
  const d = c.description
  const has = !!d.value
  const canWrite = !has || d.kind === 'lusha'
  const refresh = () => qc.invalidateQueries({ queryKey: ['intel', 'company'] })
  const verify = async () => {
    setBusy('verify'); setErr('')
    try { await review('verify_description', { key: c.key }); await refresh() } catch (e) { setErr(e instanceof Error ? e.message : 'Not saved') } finally { setBusy(null) }
  }
  const write = async () => {
    setBusy('write'); setErr('')
    try {
      const r = await fetch(`/api/intel/describe?key=${encodeURIComponent(c.key)}`, { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Nothing was written')
      await refresh()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Nothing was written') } finally { setBusy(null) }
  }
  return (
    <section className={`ws-card overflow-hidden ${className}`}>
      <div className="px-4 sm:px-5 pt-4 pb-2 flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-[14px] font-semibold flex flex-col sm:flex-row sm:items-baseline gap-x-2.5 gap-y-0.5" style={{ color: 'var(--fg)' }}>
          What they do
          {has && <DescriptionOrigin kind={d.kind} />}
        </h2>
        <span className="inline-flex items-center gap-2 text-[12px] flex-wrap" style={{ color: 'var(--fg-3)' }}>
          {has && (d.verifiedBy
            ? <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} /> Verified by {d.verifiedBy}{d.verifiedAt ? `, ${fmtDate(d.verifiedAt)}` : ''}</span>
            : <>
                <span>Unverified</span>
                <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-2" onClick={verify} disabled={busy != null} title="Record that you have read this and it is right">
                  {busy === 'verify' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Mark as verified
                </button>
              </>)}
          {canWrite && (
            <button type="button" className="ws-btn ws-btn-sm !h-7 !px-2" onClick={write} disabled={busy != null} title="Write a description with Claude from the company's homepage, its one-liner, the Lusha or dataset text and its latest signals. Saved as an AI generated description until someone verifies it.">
              {busy === 'write' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {has ? 'Write a fuller one with AI' : 'Write with AI'}
            </button>
          )}
          {has && d.sources.length > 0 && (
            <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-2 -mr-2" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              Sources ({d.sources.length}) {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </span>
      </div>
      <div className="px-4 sm:px-5 pb-4">
        {has
          ? <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--fg-2)' }}>{d.value}</p>
          : <p className="text-[13px]" style={{ color: 'var(--fg-4)' }}>No description on file yet{c.oneLiner ? `; the one-liner above is all the dataset holds` : ''}.</p>}
        {busy === 'write' && <p className="text-[12px] mt-2" style={{ color: 'var(--fg-4)' }}>Reading the homepage and writing, a few seconds…</p>}
        {err && <p className="text-[12px] mt-2" style={{ color: 'var(--bad)' }}>{err}</p>}
        {open && has && (
          <ul className="mt-3 pt-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--line)' }}>
            <li className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>{d.kind === 'ai' ? 'Written by AI from these pages and records' : 'Written from these pages'}{d.writtenAt ? `, ${fmtDate(d.writtenAt)}` : ''}</li>
            {d.sources.map((s, i) => <li key={`${s.url ?? s.label}-${i}`}><SourceLine source={s} /></li>)}
          </ul>
        )}
      </div>
    </section>
  )
}

// ── Similar companies, and named competitors (the sidebar) ───────────────────

const SIDE_KEEP = 6

// The reasons for a similarity, once each and short: "same category ·
// similar size", never the same phrase six times.
export function shortReasons(reasons: unknown[]): string {
  const out: string[] = []
  for (const r of reasons) {
    const raw = reasonText(r).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
    const t = (raw.charAt(0).toLowerCase() + raw.slice(1)).replace(/^same categories$/i, 'same category')
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out.slice(0, 3).join(' · ')
}

function Similar({ c, slug, title, note, className }: { c: IntelCompany; slug: string | null; title: string; note: string; className?: string }) {
  const [all, setAll] = useState(false)
  if (!c.similarCompanies.length) return null
  const competitors = new Set(c.competitors.filter((k) => k.review === 'confirmed').map((k) => k.key))
  const asOf = c.similarCompanies.find((s) => s.teamAsOf)?.teamAsOf
  const rows = all ? c.similarCompanies : c.similarCompanies.slice(0, SIDE_KEEP)
  const hidden = c.similarCompanies.length - rows.length
  return (
    <SideCard title={title} count={c.similarCompanies.length} note={`${note}${asOf ? ` · team sizes LinkedIn via Lusha, ${monthYear(asOf)}` : ''}`} className={className}
      foot={hidden > 0 && (
        <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm w-full !justify-start !rounded-none !h-9 !px-4" style={{ borderTop: '1px solid var(--line)', color: 'var(--fg-3)' }} onClick={() => setAll(true)}>
          Show {hidden} more <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}>
      <ul className="flex flex-col pb-1">
        {rows.map((s) => (
          <li key={s.key} className="flex items-start gap-2.5 px-4 py-1.5 min-w-0">
            <Initials name={s.name} size={26} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 min-w-0">
                <Link href={companyPath(slug, s.key, s.name)} className="text-[13px] font-medium leading-tight truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }} title={s.oneLiner ?? undefined}>{s.name}</Link>
                {competitors.has(s.key) && <span className="shrink-0 px-1.5 py-px rounded-md text-[11px]" style={{ border: '1px solid var(--line)', color: 'var(--fg-3)' }} title="A confirmed competitor">Competitor</span>}
              </span>
              {(s.team != null || s.country) && (
                <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }} title={s.team != null ? `About ${num(s.team)}, LinkedIn via Lusha${s.teamAsOf ? `, ${monthYear(s.teamAsOf)}` : ''}` : undefined}>
                  {s.team != null ? `Team about ${num(s.team)}${s.country ? ' · ' : ''}` : ''}{s.country ?? ''}
                </span>
              )}
              {s.reasons.length > 0 && <span className="block text-[11.5px] truncate" style={{ color: 'var(--fg-4)' }} title={s.reasons.map(reasonText).join(' · ')}>{shortReasons(s.reasons)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </SideCard>
  )
}

function Competitors({ c, slug, className }: { c: IntelCompany; slug: string | null; className?: string }) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  // A verdict shows at once; the record behind it is refreshed after.
  const [decided, setDecided] = useState<Record<string, 'confirmed' | 'rejected'>>({})
  if (!c.competitors.length) return null
  const stateOf = (k: Competitor): 'confirmed' | 'rejected' | 'suggested' => decided[k.key] ?? (k.review === 'confirmed' ? 'confirmed' : 'suggested')
  const confirmed = c.competitors.filter((k) => stateOf(k) === 'confirmed').length
  const suggested = c.competitors.filter((k) => stateOf(k) === 'suggested').length
  const decide = async (k: Competitor, verdict: 'confirmed' | 'rejected') => {
    setBusy(k.key); setErr('')
    try {
      await review('competitor', { key: c.key, other_key: k.key, verdict })
      setDecided((x) => ({ ...x, [k.key]: verdict }))
      qc.invalidateQueries({ queryKey: ['intel', 'company'] })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Not saved') } finally { setBusy(null) }
  }
  return (
    <SideCard title="Competitors" count={`${confirmed} confirmed · ${suggested} suggested`} note="AI suggestions; a company only counts as a competitor once someone on the team confirms it" className={className}>
      <ul className="flex flex-col pb-1">
        {c.competitors.map((k) => {
          const st = stateOf(k)
          return (
            <li key={k.key} className="flex flex-col gap-1 px-4 py-1.5" style={{ opacity: st === 'rejected' ? 0.55 : 1 }}>
              <span className="flex items-center gap-2.5 min-w-0">
                <Initials name={k.name} size={26} />
                <span className="min-w-0 flex-1">
                  <Link href={companyPath(slug, k.key, k.name)} className="block text-[13px] font-medium leading-tight truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }} title={k.oneLiner ?? undefined}>{k.name}</Link>
                  <span className="block text-[11.5px] truncate" style={{ color: 'var(--fg-4)' }}>
                    {st === 'rejected' ? 'Not a competitor · noted'
                      : st === 'confirmed' ? <><Check className="inline w-3 h-3 align-[-2px] mr-0.5" style={{ color: 'var(--ok)' }} /> Confirmed by {k.reviewedBy ?? 'you'}{k.reviewedAt ? `, ${fmtDate(k.reviewedAt)}` : decided[k.key] ? ', just now' : ''}</>
                      : <>{k.source.label}{k.source.date ? `, ${fmtDate(k.source.date)}` : ''}</>}
                  </span>
                </span>
              </span>
              {st === 'suggested' && (
                <span className="flex items-center gap-1 pl-[36px]">
                  <button type="button" className="ws-btn ws-btn-sm !h-7 !px-2" disabled={busy === k.key} onClick={() => decide(k, 'confirmed')}>{busy === k.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Confirm</button>
                  <button type="button" className="ws-btn ws-btn-sm ws-btn-ghost !h-7 !px-2" disabled={busy === k.key} onClick={() => decide(k, 'rejected')}><X className="w-3.5 h-3.5" /> Not a competitor</button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {err && <p className="px-4 py-2 text-[12px]" style={{ color: 'var(--bad)', borderTop: '1px solid var(--line)' }}>{err}</p>}
    </SideCard>
  )
}

// ── Signals (the sidebar) ────────────────────────────────────────────────────

const SIGNALS_KEEP = 4

function Signals({ c, className }: { c: IntelCompany; className?: string }) {
  if (!c.signals.length) return null
  const rows = c.signals.slice(0, SIGNALS_KEEP)
  return (
    <SideCard title="Signals" count={c.signals.length > rows.length ? `latest ${rows.length} of ${c.signals.length}` : c.signals.length} note="From Lusha" className={className}>
      <ul className="flex flex-col pb-1">
        {rows.map((s, i) => {
          const date = s.date ?? s.source.date
          const body = <span className="block text-[13px] truncate" style={{ color: 'var(--fg)' }} title={s.headline}>{s.headline}</span>
          return (
            <li key={s.id ?? i} className="px-4 py-1.5 min-w-0">
              <span className="flex items-baseline justify-between gap-3 text-[11.5px]" style={{ color: 'var(--fg-4)' }}>
                <span className="font-medium">{s.type}</span>
                {date && <span className="shrink-0">{fmtDate(date)}</span>}
              </span>
              {s.source.url ? <a href={s.source.url} target="_blank" rel="noopener noreferrer" className="block min-w-0 hover:underline underline-offset-4" title={`${s.headline}\n${s.source.label}`}>{body}</a> : body}
            </li>
          )
        })}
      </ul>
    </SideCard>
  )
}

// ── Deployments, from either side (the main column) ──────────────────────────

// The fixed headline: a lower bound, never a count of customers. Rows with
// no source are not in it; they are listed apart, under their own heading.
export function deploymentsHeadline(rows: Deployment[], noun: string) {
  const sourced = rows.filter((r) => r.evidence)
  const verified = sourced.filter((r) => r.review === 'verified').length
  const live = sourced.filter((r) => r.status === 'Production' || r.status === 'Expanded').length
  return `${sourced.length} ${noun} named in sourced announcements (${verified} verified) · ${live} in production`
}

// A row's evidence in one short line: "Trust news · 14 Mar 2024 ↗", the
// full label, the page and how old it is in the tooltip. A row with none
// says so.
function Evidence({ d }: { d: Deployment }) {
  if (!d.evidence) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap" style={{ color: 'var(--fg-4)' }} title={d.origin ? `From ${d.origin}. Pasting the announcement comes with the review queue.` : 'Pasting the announcement comes with the review queue.'}>
        <span className="italic">No source on file</span>
        <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-6 !px-1" disabled aria-label="Add a source"><Plus className="w-3 h-3" /></button>
      </span>
    )
  }
  const e = d.evidence
  const short = e.label.replace(/\s*\([^)]*\)/g, '').replace(/\s*,\s*via Lusha.*$/i, '')
  const age = evidenceAge(e.date)
  const title = `${e.label}${e.date ? `, ${fmtDate(e.date)}` : ''}${age ? ` (${age})` : ''}${e.url ? `\n${e.url}` : ''}`
  const text = <>{short}{e.date && <span style={{ color: 'var(--fg-4)' }}> · {fmtDate(e.date)}</span>}{age && <span style={{ color: 'var(--warn)' }}> · {age}</span>}</>
  return e.url
    ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] truncate hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }} title={title}>{text}<ExternalLink className="inline-block align-[-2px] ml-1 w-3 h-3" style={{ color: 'var(--fg-4)' }} /></a>
    : <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }} title={title}>{text}</span>
}

// A proposed row with evidence can be verified or rejected here; a verdict
// shows at once and the record is refreshed after.
function Verdict({ d, onDone }: { d: Deployment; onDone: (v: 'verified' | 'rejected') => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  if (!d.evidence || d.review !== 'proposed') return null
  const go = async (verdict: 'verified' | 'rejected') => {
    setBusy(verdict)
    try { await review('deployment', { id: d.id, verdict }); onDone(verdict) } catch { /* the row keeps its state; the next load says what the database holds */ } finally { setBusy(null) }
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-1.5" disabled={!!busy} onClick={() => go('verified')} title="The evidence says this; mark it verified">{busy === 'verified' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Verify</button>
      <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-1.5" disabled={!!busy} onClick={() => go('rejected')} title="The evidence does not support this; drop it" aria-label="Reject"><X className="w-3 h-3" /></button>
    </span>
  )
}

function DeploymentsTable({ rows: given, slug, side }: { rows: Deployment[]; slug: string | null; side: 'provider' | 'vendor' }) {
  const qc = useQueryClient()
  const [verdicts, setVerdicts] = useState<Record<string, 'verified' | 'rejected'>>({})
  const rows = given.filter((d) => verdicts[d.id] !== 'rejected').map((d) => (verdicts[d.id] === 'verified' ? { ...d, review: 'verified' as const, reviewedBy: d.reviewedBy ?? 'you' } : d))
  const done = (d: Deployment) => (v: 'verified' | 'rejected') => { setVerdicts((x) => ({ ...x, [d.id]: v })); qc.invalidateQueries({ queryKey: ['intel', 'company'] }) }
  const other = (d: Deployment) => (side === 'provider' ? d.provider : d.vendor)
  const head = side === 'provider' ? 'Hospital' : 'Vendor'
  const sourced = rows.filter((d) => d.evidence)
  const unsourced = rows.filter((d) => !d.evidence)
  const alsoHeading = `Also mentioned, no source on file (${unsourced.length})`
  const conf = (d: Deployment) => <ConfidenceMark level={d.confidence} verifiedBy={d.review === 'verified' ? d.reviewedBy ?? 'the team' : null} verifiedAt={d.reviewedAt} />
  const tr = (d: Deployment) => {
    const o = other(d)
    return (
      <tr key={d.id}>
        <td className="!pl-5 !py-2"><Link href={companyPath(slug, o.key, o.name)} className="block font-medium truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }} title={o.name}>{o.name}</Link></td>
        <td className="!py-2"><span className="block text-[13px] truncate" style={{ color: 'var(--fg-2)' }} title={d.useCase}>{d.useCase}</span></td>
        <td className="!py-2"><Status d={d} /></td>
        <td className="!py-2"><Evidence d={d} /></td>
        <td className="!pr-5 !py-2"><span className="flex items-center justify-between gap-2">{conf(d)}<Verdict d={d} onDone={done(d)} /></span></td>
      </tr>
    )
  }
  const li = (d: Deployment) => {
    const o = other(d)
    return (
      <li key={d.id} className="px-4 py-2.5 flex flex-col gap-1" style={{ borderTop: '1px solid var(--line)' }}>
        <span className="flex items-center justify-between gap-3">
          <Link href={companyPath(slug, o.key, o.name)} className="text-[13.5px] font-medium hover:underline underline-offset-4 min-w-0 truncate" style={{ color: 'var(--fg)' }}>{o.name}</Link>
          <Status d={d} />
        </span>
        <span className="text-[13px]" style={{ color: 'var(--fg-2)' }}>{d.useCase}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0"><Evidence d={d} />{d.confidence && conf(d)}<Verdict d={d} onDone={done(d)} /></span>
      </li>
    )
  }
  return (
    <>
      {/* Desktop: a fixed table, long cells truncated with the whole in the tooltip. */}
      <table className="ws-table ws-table-fixed hidden md:table">
        <colgroup><col style={{ width: '22%' }} /><col /><col style={{ width: 108 }} /><col style={{ width: '23%' }} /><col style={{ width: 160 }} /></colgroup>
        <thead>
          <tr><th className="!pl-5 !py-2">{head}</th><th className="!py-2">Use case</th><th className="!py-2" title={STATUS_NOTE}>Status</th><th className="!py-2">Evidence</th><th className="!pr-5 !py-2">Confidence</th></tr>
        </thead>
        <tbody>
          {sourced.map(tr)}
          {unsourced.length > 0 && (
            <tr><td colSpan={5} className="!pl-5 !py-1.5 text-[11.5px] font-medium" style={{ color: 'var(--fg-4)', background: 'var(--surface-2)' }}>{alsoHeading}</td></tr>
          )}
          {unsourced.map(tr)}
        </tbody>
      </table>
      {/* Phone: each row stacked. */}
      <ul className="md:hidden flex flex-col">
        {sourced.map(li)}
        {unsourced.length > 0 && (
          <li className="px-4 py-1.5 text-[11.5px] font-medium" style={{ color: 'var(--fg-4)', background: 'var(--surface-2)', borderTop: '1px solid var(--line)' }}>{alsoHeading}</li>
        )}
        {unsourced.map(li)}
      </ul>
    </>
  )
}

const STATUS_NOTE = 'Status is Announced unless the source says otherwise'

// The hospitals a vendor has announced work with, or the vendors a hospital
// has: one card with the headline count, or one quiet line when there are
// none on file.
export function IntelDeployments({ c, slug, className = '' }: { c: IntelCompany; slug: string | null; className?: string }) {
  const provider = isProvider(c)
  const rows = provider ? c.providerDeployments : c.vendorDeployments
  const title = provider ? 'Vendors they work with' : 'Hospitals and health systems'
  if (!rows.length) return <p className={`px-1 text-[12.5px] ${className}`} style={{ color: 'var(--fg-4)' }}>{provider ? 'No vendor named in a sourced announcement yet.' : 'No hospital named in a sourced announcement yet.'}</p>
  return (
    <section className={`ws-card overflow-hidden ${className}`}>
      <div className="px-4 sm:px-5 pt-4 pb-2 flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }} title={provider ? 'Announcements from the trust or the vendor' : 'Only hospitals we have an announcement for; the real list is longer'}>{title}</h2>
        <span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>{deploymentsHeadline(rows, provider ? 'vendors' : 'hospitals')}</span>
      </div>
      <DeploymentsTable rows={rows} slug={slug} side={provider ? 'vendor' : 'provider'} />
    </section>
  )
}

// ── Not at this trust yet (the sidebar) ──────────────────────────────────────

function NotYetHere({ c, slug, className }: { c: IntelCompany; slug: string | null; className?: string }) {
  // Vendors named at similar trusts and not here: never one that already
  // has a row in the table, even without a source, and only with evidence.
  const here = new Set(c.providerDeployments.map((d) => d.vendor.key))
  const gaps = c.whitespace.filter((w) => !here.has(w.key) && w.evidence)
  if (!gaps.length) return null
  return (
    <SideCard title="Not here yet" count={gaps.length} note="Vendors named in sourced announcements at similar trusts, none here" className={className}>
      <ul className="flex flex-col pb-1">
        {gaps.map((w) => (
          <li key={w.key} className="flex items-start gap-2.5 px-4 py-1.5 min-w-0">
            <Initials name={w.name} size={26} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <Link href={companyPath(slug, w.key, w.name)} className="block text-[13px] font-medium leading-tight truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }} title={w.oneLiner ?? w.useCase ?? undefined}>{w.name}</Link>
              <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }} title={`At ${w.at}${w.useCase ? `: ${w.useCase}` : ''}`}>At {w.at}</span>
              {w.evidence && <span className="block text-[11.5px] truncate" style={{ color: 'var(--fg-4)' }}><SourceLine source={w.evidence} className="!text-[11.5px]" showAge /></span>}
            </span>
          </li>
        ))}
      </ul>
    </SideCard>
  )
}

// ── The sidebar ──────────────────────────────────────────────────────────────

// Similar companies, competitors, signals and (for a hospital) the vendors
// not here yet, each a compact card. `className` goes on every card, for
// where it sits when the page stacks on a phone.
export function IntelSidebar({ c, slug, className }: { c: IntelCompany; slug: string | null; className?: string }) {
  const provider = isProvider(c)
  return (
    <>
      <Similar c={c} slug={slug} className={className} title={provider ? 'Similar trusts' : 'Similar companies'} note={provider ? 'By type, region, size and shared vendors' : 'Computed from categories, size, country and shared hospitals'} />
      <Competitors c={c} slug={slug} className={className} />
      {provider && <NotYetHere c={c} slug={slug} className={className} />}
      <Signals c={c} className={className} />
    </>
  )
}

// ── People Lusha names ───────────────────────────────────────────────────────

// Under a company's team: the people Lusha names who are not in the CRM,
// names and titles only. A click opens the contact panel with what there is.
export function IntelPeopleNamed({ c, exclude = [], type }: { c: IntelCompany; exclude?: string[]; type?: Firmographic | null }) {
  const [all, setAll] = useState(false)
  const skip = new Set(exclude.map((n) => n.trim().toLowerCase()))
  const people = c.people.filter((p) => !skip.has(p.name.trim().toLowerCase()))
  if (!people.length) return null
  const src = people[0].source
  const rows = all ? people : people.slice(0, 4)
  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <p className="px-4 sm:px-5 pt-2.5 pb-1 text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>Also named by {src.kind === 'lusha' ? 'Lusha' : src.label}{src.date ? `, ${monthYear(src.date)}` : ''} <span className="font-normal">· not in the CRM; names and titles only</span></p>
      <ul className="flex flex-col pb-1">
        {rows.map((p, i) => (
          <li key={`${p.name}-${i}`} className="flex items-center gap-2.5 px-4 sm:px-5 py-1.5">
            <Initials name={p.name} size={26} />
            <ContactLink seed={{ name: p.name, jobTitle: p.jobTitle, country: p.country ?? null, linkedinUrl: p.linkedinUrl, company: c.name, type: type ?? null, records: [] }} className="min-w-0 flex-1 text-left">
              <span className="block text-[13px] font-medium truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{p.name}</span>
              <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[p.jobTitle, p.country].filter(Boolean).join(' · ')}</span>
            </ContactLink>
            {p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded-md hover:bg-[var(--surface-2)]" title="LinkedIn" style={{ color: 'var(--fg-3)' }}><Linkedin className="w-3.5 h-3.5" /></a>}
          </li>
        ))}
        {people.length > rows.length && (
          <li className="px-3 sm:px-4"><button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-1.5" style={{ color: 'var(--fg-3)' }} onClick={() => setAll(true)}>Show {people.length - rows.length} more <ChevronDown className="w-3.5 h-3.5" /></button></li>
        )}
      </ul>
    </div>
  )
}

// A quiet line for a company the layer has nothing on, so a profile reads
// the same with or without intelligence.
export function NoIntel({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`text-[12.5px] ${compact ? 'px-4 sm:px-5 py-2.5' : 'ws-card px-4 sm:px-5 py-3'}`} style={{ color: 'var(--fg-4)', ...(compact ? { borderTop: '1px solid var(--line)' } : {}) }}>
      No intel yet · the intelligence layer has nothing on this company; it is added as companies are linked and enriched.
    </p>
  )
}

// ── The compact strip on a person's page ─────────────────────────────────────

export function IntelCompanyStrip({ companyKey: key, name, slug }: { companyKey: string | null; name: string | null; slug: string | null }) {
  const { data } = useIntel(key, name)
  const c = data?.company
  if (!c) return null
  const href = companyPath(slug, c.key, c.name)
  const provider = isProvider(c)
  const cell = (label: string, value: React.ReactNode, title?: string) => (
    <span className="inline-flex items-baseline gap-1" title={title}>
      <span className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>{label}</span>
      <span style={{ color: 'var(--fg-2)' }}>{value}</span>
    </span>
  )
  const sourced = provider ? c.vendors : c.hospitals
  return (
    <Link href={href} className="ws-card px-4 sm:px-5 py-3 flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-2 transition-colors hover:bg-[var(--glass-hover)]" title={`Open ${c.name}`}>
      <span className="shrink-0"><Initials name={c.name} size={40} /></span>
      <span className="min-w-0 flex-1 flex flex-col gap-1.5">
        <span className="text-[13.5px] min-w-0">
          <span className="font-medium" style={{ color: 'var(--fg)' }}>{c.name}</span>
          {c.oneLiner && <span style={{ color: 'var(--fg-3)' }}> · {c.oneLiner}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
          {c.teamFact && cell('Team', <>about {num(c.teamFact.value)} <span style={{ color: 'var(--fg-4)' }}>({c.teamFact.source.kind === 'lusha' ? 'Lusha' : c.teamFact.source.label}<span className="hidden sm:inline">{c.teamFact.source.date ? `, ${monthYear(c.teamFact.source.date)}` : ''}</span>)</span></>, `${c.teamFact.source.label}${c.teamFact.source.date ? `, ${monthYear(c.teamFact.source.date)}` : ''}; a LinkedIn-based estimate, not a headcount`)}
          {c.hq && cell('HQ', c.hq)}
          {cell(provider ? 'Vendors' : 'Hospitals', <>{sourced} <span style={{ color: 'var(--fg-4)' }}><span className="hidden sm:inline">in sourced announcements</span><span className="sm:hidden">sourced</span></span></>, `${sourced} named in sourced announcements; a lower bound, not a customer list`)}
          {cell('Similar', String(c.similar))}
        </span>
      </span>
    </Link>
  )
}
