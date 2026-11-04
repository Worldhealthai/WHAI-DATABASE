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

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronRight, ExternalLink, Linkedin, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { fmtDate } from '@/components/crm/profileParts'
import { companyKey } from '@/lib/segments'
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
          const j = (await r.json()) as { cards: IntelCard[] }
          setCards((m) => {
            const next = new Map(m)
            for (const k of batch) next.set(k, null)
            for (const c of j.cards) next.set(c.crmKey, c)
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
  return { cardFor, ask, failed, categories: cats.data?.categories ?? [], known: cards }
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
const confOf = (s: string | null | undefined): Confidence | null => (s === 'high' || s === 'medium' || s === 'low' ? s : null)

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

// How sure we are, and whether a person has checked it.
function ConfidenceMark({ level, verifiedBy, verifiedAt }: { level: Confidence | null; verifiedBy?: string | null; verifiedAt?: string | null }) {
  if (!level) return <span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>—</span>
  const title = verifiedBy ? `Checked by ${verifiedBy}${verifiedAt ? `, ${fmtDate(verifiedAt)}` : ''}` : 'Not yet checked by anyone on the team'
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap" style={{ color: 'var(--fg-3)' }} title={title}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CONF_INK[level] }} />
      {CONF[level]}
      {verifiedBy ? <span className="inline-flex items-center gap-1" style={{ color: 'var(--fg-2)' }}><Check className="w-3 h-3" style={{ color: 'var(--ok)' }} /> verified</span> : <span style={{ color: 'var(--fg-4)' }}>· unverified</span>}
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

function SectionCard({ title, count, aside, children, flush, id }: { title: string; count?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; flush?: boolean; id?: string }) {
  return (
    <section className="ws-card overflow-hidden" id={id}>
      <div className={`px-4 sm:px-5 pt-4 ${flush ? 'pb-2' : 'pb-3'} flex items-center justify-between gap-3 flex-wrap`}>
        <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>{title} {count != null && <span className="font-normal" style={{ color: 'var(--fg-4)' }}>{count}</span>}</h2>
        {aside}
      </div>
      {flush ? children : <div className="px-4 sm:px-5 pb-4 sm:pb-5">{children}</div>}
    </section>
  )
}

// On phones, a list shows its first few and offers the rest; on wider
// screens everything is shown. Done in CSS, so nothing moves on resize.
function ShowMore({ hidden, open, onOpen }: { hidden: number; open: boolean; onOpen: () => void }) {
  if (open || hidden <= 0) return null
  return (
    <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm sm:hidden self-start -ml-2 !h-10" onClick={onOpen}>
      Show {hidden} more <ChevronDown className="w-3.5 h-3.5" />
    </button>
  )
}
// (Written out in full: Tailwind reads whole class names from the source.)
const foldClass = (i: number, open: boolean, keep: number, display: 'flex' | 'grid' = 'flex') =>
  i >= keep && !open ? (display === 'grid' ? 'hidden sm:grid' : 'hidden sm:flex') : display

// ── The ten-second strip, inside the header ──────────────────────────────────

export function IntelStrip({ c }: { c: IntelCompany }) {
  const provider = isProvider(c)
  const facts: { label: string; value: React.ReactNode; title?: string }[] = []
  if (c.teamFact) facts.push({ label: 'Team', value: `about ${num(c.teamFact.value)}`, title: `${c.teamFact.source.label}${c.teamFact.source.date ? `, ${monthYear(c.teamFact.source.date)}` : ''}${c.teamRange ? `; Lusha bucket ${c.teamRange}` : ''}. A LinkedIn-based estimate, not a headcount.` })
  if (c.hq) facts.push({ label: 'HQ', value: provider && c.region ? c.region : c.hq })
  if (c.founded) facts.push({ label: provider ? 'Formed' : 'Founded', value: String(c.founded) })
  if (c.funding && (c.funding.totalUsd || c.funding.lastRoundUsd)) {
    const last = c.funding.lastRoundUsd ? `${c.funding.lastRoundType ?? 'Last round'} ${usd(c.funding.lastRoundUsd)}${c.funding.lastRoundDate ? `, ${monthYear(c.funding.lastRoundDate)}` : ''}` : null
    facts.push({ label: 'Funding', value: [c.funding.totalUsd ? usd(c.funding.totalUsd) : null, last].filter(Boolean).join(' · '), title: `${c.funding.source.label}${c.funding.source.date ? `, ${monthYear(c.funding.source.date)}` : ''}; ${CONF[c.funding.confidence].toLowerCase()} confidence` })
  }
  if (c.revenueBand && (c.revenueBand.minUsd || c.revenueBand.maxUsd)) facts.push({ label: 'Revenue', value: [c.revenueBand.minUsd, c.revenueBand.maxUsd].filter((n): n is number => n != null).map(usd).join('–'), title: `${c.revenueBand.source.label}${c.revenueBand.source.date ? `, ${monthYear(c.revenueBand.source.date)}` : ''}` })
  if (c.beds) facts.push({ label: 'Beds', value: <>about {num(c.beds)} <span style={{ color: 'var(--fg-4)' }}>· {c.sourceKind === 'seed' ? 'seed data' : 'dataset'}, unverified</span></> })
  if (c.status && c.status !== 'Active') facts.push({ label: 'Status', value: c.acquiredBy ? `${c.status} by ${c.acquiredBy}` : c.status })
  const lusha = [c.teamFact?.source.kind === 'lusha' && 'team', c.funding?.source.kind === 'lusha' && 'funding', c.revenueBand && 'revenue'].filter(Boolean) as string[]
  if (!c.oneLiner && !facts.length && !c.categories.length) return null
  return (
    <div className="px-4 sm:px-5 py-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--line)' }}>
      {c.oneLiner && <p className="text-[13.5px]" style={{ color: 'var(--fg-2)' }}>{c.oneLiner}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]" style={{ color: 'var(--fg-3)' }}>
        {c.categories.length > 0 && (
          <span className="inline-flex flex-wrap gap-2">
            {c.categories.map((k) => <span key={k} className="px-2 py-0.5 rounded-md" style={{ border: '1px solid var(--line)', color: 'var(--fg-2)' }}>{k}</span>)}
          </span>
        )}
        {facts.map((f) => (
          <span key={f.label} className="inline-flex items-baseline gap-1" title={f.title}>
            <span className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>{f.label}</span>
            <span style={{ color: 'var(--fg-2)' }}>{f.value}</span>
          </span>
        ))}
      </div>
      {lusha.length > 0 && c.teamFact && (
        <p className="text-[12px]" style={{ color: 'var(--fg-4)' }}>
          {lusha.length > 1 ? `${lusha[0][0].toUpperCase()}${lusha[0].slice(1)}${lusha.length > 2 ? `, ${lusha.slice(1, -1).join(', ')}` : ''} and ${lusha[lusha.length - 1]} are` : 'Team size is'} from Lusha{c.teamFact.source.date ? `, ${monthYear(c.teamFact.source.date)}` : ''} ({CONF[c.teamFact.confidence].toLowerCase()} confidence); team size is a LinkedIn-based estimate, not a headcount.
        </p>
      )}
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

function Description({ c }: { c: IntelCompany }) {
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
    <section className="ws-card overflow-hidden">
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3 flex-wrap">
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
      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
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

// ── Similar companies, and named competitors ─────────────────────────────────

const PHONE_KEEP = 3

function Similar({ c, slug, title, note }: { c: IntelCompany; slug: string | null; title: string; note: string }) {
  const [all, setAll] = useState(false)
  if (!c.similarCompanies.length) return null
  const competitors = new Set(c.competitors.filter((k) => k.review === 'confirmed').map((k) => k.key))
  const asOf = c.similarCompanies.find((s) => s.teamAsOf)?.teamAsOf
  return (
    <SectionCard title={title} count={c.similarCompanies.length} aside={<span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>{note}{asOf ? ` · team sizes LinkedIn via Lusha, ${monthYear(asOf)}` : ''}</span>}>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {c.similarCompanies.map((s, i) => (
          <li key={s.key} className={`${foldClass(i, all, PHONE_KEEP)} rounded-lg p-3 flex-col gap-1 min-w-0`} style={{ border: '1px solid var(--line)' }}>
            <Link href={companyPath(slug, s.key, s.name)} className="flex items-center gap-2.5 min-w-0">
              <Initials name={s.name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[13.5px] font-medium leading-tight truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{s.name}</span>
                  {competitors.has(s.key) && <span className="shrink-0 px-1.5 py-px rounded-md text-[11px]" style={{ border: '1px solid var(--line)', color: 'var(--fg-3)' }} title="A confirmed competitor">Competitor</span>}
                </span>
                {(s.team != null || s.country) && (
                  <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }} title={s.team != null ? `About ${num(s.team)}, LinkedIn via Lusha${s.teamAsOf ? `, ${monthYear(s.teamAsOf)}` : ''}` : undefined}>
                    {s.team != null ? `Team about ${num(s.team)}${s.country ? ' · ' : ''}` : ''}{s.country ?? ''}
                  </span>
                )}
              </span>
            </Link>
            {s.oneLiner && <p className="text-[12.5px] leading-snug" style={{ color: 'var(--fg-2)' }}>{s.oneLiner}</p>}
            {s.reasons.length > 0 && <p className="text-[11.5px] mt-auto pt-1" style={{ color: 'var(--fg-4)' }}>{s.reasons.map(reasonText).filter(Boolean).join(' · ')}</p>}
          </li>
        ))}
      </ul>
      <ShowMore hidden={c.similarCompanies.length - PHONE_KEEP} open={all} onOpen={() => setAll(true)} />
    </SectionCard>
  )
}

function Competitors({ c, slug }: { c: IntelCompany; slug: string | null }) {
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
  const row = (k: Competitor) => {
    const st = stateOf(k)
    return (
      <li key={k.key} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 sm:px-5 py-2.5" style={{ borderTop: '1px solid var(--line)', opacity: st === 'rejected' ? 0.55 : 1 }}>
        <Link href={companyPath(slug, k.key, k.name)} className="flex items-center gap-2.5 min-w-0 flex-1 basis-[200px]">
          <Initials name={k.name} size={28} />
          <span className="min-w-0">
            <span className="block text-[13.5px] font-medium truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{k.name}</span>
            <span className="block text-[12px] sm:truncate" style={{ color: 'var(--fg-3)' }}>{k.source.label}{k.source.date ? `, ${fmtDate(k.source.date)}` : ''}</span>
          </span>
        </Link>
        {st === 'rejected' ? (
          <span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>Not a competitor · noted</span>
        ) : st === 'confirmed' ? (
          <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--fg-2)' }}>
            <Check className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} /> Confirmed by {k.reviewedBy ?? 'you'}{k.reviewedAt ? `, ${fmtDate(k.reviewedAt)}` : decided[k.key] ? ', just now' : ''}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <button type="button" className="ws-btn ws-btn-sm" disabled={busy === k.key} onClick={() => decide(k, 'confirmed')}>{busy === k.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Confirm</button>
            <button type="button" className="ws-btn ws-btn-sm ws-btn-ghost" disabled={busy === k.key} onClick={() => decide(k, 'rejected')}><X className="w-3.5 h-3.5" /> Not a competitor</button>
          </span>
        )}
      </li>
    )
  }
  return (
    <SectionCard title="Competitors" count={`· ${confirmed} confirmed, ${suggested} suggested`} flush aside={<span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>AI suggestions; a company only counts as a competitor once someone on the team confirms it</span>}>
      <ul className="flex flex-col">{c.competitors.map(row)}</ul>
      {err && <p className="px-4 sm:px-5 py-2 text-[12px]" style={{ color: 'var(--bad)', borderTop: '1px solid var(--line)' }}>{err}</p>}
    </SectionCard>
  )
}

// ── Deployments, from either side ────────────────────────────────────────────

// The fixed headline: a lower bound, never a count of customers. Rows with
// no source are not in it; they are listed apart, under their own heading.
export function deploymentsHeadline(rows: Deployment[], noun: string) {
  const sourced = rows.filter((r) => r.evidence)
  const verified = sourced.filter((r) => r.review === 'verified').length
  const live = sourced.filter((r) => r.status === 'Production' || r.status === 'Expanded').length
  return `${sourced.length} ${noun} named in sourced announcements (${verified} verified) · ${live} in production`
}

// A row's evidence; for a row with none, where it came from.
function Evidence({ d }: { d: Deployment }) {
  if (d.evidence) return <SourceLine source={d.evidence} showAge />
  return (
    <span className="inline-flex items-center gap-2 flex-wrap text-[12px]" style={{ color: 'var(--fg-4)' }}>
      <span className="italic">No source on file{d.origin ? ` · ${d.origin}` : ''}</span>
      <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-1.5" title="Paste the announcement this came from (coming with the review queue)" disabled><Plus className="w-3.5 h-3.5" /> Add a source</button>
    </span>
  )
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
    <span className="inline-flex items-center gap-1">
      <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-1.5" disabled={!!busy} onClick={() => go('verified')} title="The evidence says this; mark it verified">{busy === 'verified' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Verify</button>
      <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm !h-7 !px-1.5" disabled={!!busy} onClick={() => go('rejected')} title="The evidence does not support this; drop it"><X className="w-3 h-3" /></button>
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
  if (!rows.length) return <p className="px-4 sm:px-5 pb-4 text-[13px]" style={{ color: 'var(--fg-4)' }}>None on file yet.</p>
  const tr = (d: Deployment) => {
    const o = other(d)
    return (
      <tr key={d.id}>
        <td className="!pl-5"><Link href={companyPath(slug, o.key, o.name)} className="font-medium hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{o.name}</Link></td>
        <td style={{ color: 'var(--fg-2)' }}>{d.useCase}</td>
        <td><Status d={d} /></td>
        <td><Evidence d={d} /></td>
        <td className="!pr-5"><span className="inline-flex items-center gap-2"><ConfidenceMark level={d.confidence} verifiedBy={d.review === 'verified' ? d.reviewedBy ?? 'the team' : null} verifiedAt={d.reviewedAt} /><Verdict d={d} onDone={done(d)} /></span></td>
      </tr>
    )
  }
  const li = (d: Deployment) => {
    const o = other(d)
    return (
      <li key={d.id} className="px-4 py-3 flex flex-col gap-1" style={{ borderTop: '1px solid var(--line)' }}>
        <span className="flex items-center justify-between gap-3 min-h-[40px]">
          <Link href={companyPath(slug, o.key, o.name)} className="text-[13.5px] font-medium hover:underline underline-offset-4 min-w-0" style={{ color: 'var(--fg)' }}>{o.name}</Link>
          <Status d={d} />
        </span>
        <span className="text-[13px]" style={{ color: 'var(--fg-2)' }}>{d.useCase}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><Evidence d={d} />{d.confidence && <ConfidenceMark level={d.confidence} verifiedBy={d.review === 'verified' ? d.reviewedBy ?? 'the team' : null} verifiedAt={d.reviewedAt} />}<Verdict d={d} onDone={done(d)} /></span>
      </li>
    )
  }
  return (
    <>
      {/* Desktop: a table. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="ws-table w-full">
          <thead>
            <tr><th className="!pl-5 w-[22%]">{head}</th><th>Use case</th><th>Status</th><th className="w-[30%]">Evidence</th><th className="!pr-5">Confidence</th></tr>
          </thead>
          <tbody>
            {sourced.map(tr)}
            {unsourced.length > 0 && (
              <tr><td colSpan={5} className="!pl-5 !py-2 text-[11.5px] font-medium" style={{ color: 'var(--fg-4)', background: 'var(--surface-2)' }}>{alsoHeading}</td></tr>
            )}
            {unsourced.map(tr)}
          </tbody>
        </table>
      </div>
      {/* Phone: each row stacked. */}
      <ul className="md:hidden flex flex-col">
        {sourced.map(li)}
        {unsourced.length > 0 && (
          <li className="px-4 py-2 text-[11.5px] font-medium" style={{ color: 'var(--fg-4)', background: 'var(--surface-2)', borderTop: '1px solid var(--line)' }}>{alsoHeading}</li>
        )}
        {unsourced.map(li)}
      </ul>
    </>
  )
}

// ── Signals ──────────────────────────────────────────────────────────────────

function Signals({ c }: { c: IntelCompany }) {
  const [all, setAll] = useState(false)
  if (!c.signals.length) return null
  return (
    <SectionCard title="Signals" count={c.signals.length} flush aside={<span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>Lusha, the latest eight</span>}>
      <ul className="flex flex-col">
        {c.signals.map((s, i) => (
          <li key={s.id ?? i} className={`${foldClass(i, all, PHONE_KEEP, 'grid')} grid-cols-[76px_minmax(0,1fr)] sm:grid-cols-[88px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-baseline px-4 sm:px-5 py-2.5`} style={{ borderTop: '1px solid var(--line)' }}>
            <span className="text-[12px] font-medium" style={{ color: 'var(--fg-4)' }}>{s.type}</span>
            <span className="text-[13px] min-w-0" style={{ color: 'var(--fg)' }}>{s.headline}</span>
            <span className="col-start-2 sm:col-start-3 text-[12px] sm:whitespace-nowrap"><SourceLine source={{ ...s.source, date: s.date ?? s.source.date }} /></span>
          </li>
        ))}
        {c.signals.length > PHONE_KEEP && !all && (
          <li className="px-4 py-1 sm:hidden" style={{ borderTop: '1px solid var(--line)' }}><ShowMore hidden={c.signals.length - PHONE_KEEP} open={all} onOpen={() => setAll(true)} /></li>
        )}
      </ul>
    </SectionCard>
  )
}

// ── People Lusha names ───────────────────────────────────────────────────────

function People({ c }: { c: IntelCompany }) {
  const [all, setAll] = useState(false)
  if (!c.people.length) return null
  const src = c.people[0].source
  return (
    <SectionCard title="People named" count={c.people.length} flush aside={<span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>{src.label}{src.date ? `, ${monthYear(src.date)}` : ''} · names and titles only</span>}>
      <ul className="flex flex-col">
        {c.people.map((p, i) => (
          <li key={`${p.name}-${i}`} className={`${foldClass(i, all, PHONE_KEEP)} items-center gap-2.5 px-4 sm:px-5 py-2`} style={{ borderTop: '1px solid var(--line)' }}>
            <Initials name={p.name} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{p.name}</span>
              <span className="block text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>{[p.jobTitle, p.country].filter(Boolean).join(' · ')}</span>
            </span>
            {p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded-md hover:bg-[var(--surface-2)]" title="LinkedIn" style={{ color: 'var(--fg-3)' }}><Linkedin className="w-3.5 h-3.5" /></a>}
          </li>
        ))}
        {c.people.length > PHONE_KEEP && !all && (
          <li className="px-4 py-1 sm:hidden" style={{ borderTop: '1px solid var(--line)' }}><ShowMore hidden={c.people.length - PHONE_KEEP} open={all} onOpen={() => setAll(true)} /></li>
        )}
      </ul>
    </SectionCard>
  )
}

// ── The sections, for a vendor and for a hospital ────────────────────────────

const STATUS_NOTE = 'status is Announced unless the source says otherwise'

export function IntelVendorSections({ c, slug }: { c: IntelCompany; slug: string | null }) {
  return (
    <>
      <Description c={c} />
      <Similar c={c} slug={slug} title="Similar companies" note="Computed from categories, size, country and shared hospitals" />
      <Competitors c={c} slug={slug} />
      <SectionCard title="Hospitals and health systems" flush aside={<span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>Only hospitals we have an announcement for; the real list is longer · {STATUS_NOTE}</span>}>
        <p className="px-4 sm:px-5 pb-3 text-[13px]" style={{ color: 'var(--fg-2)' }}>{deploymentsHeadline(c.vendorDeployments, 'hospitals')}</p>
        <DeploymentsTable rows={c.vendorDeployments} slug={slug} side="provider" />
      </SectionCard>
      <People c={c} />
      <Signals c={c} />
    </>
  )
}

export function IntelHospitalSections({ c, slug }: { c: IntelCompany; slug: string | null }) {
  // Vendors named at similar trusts and not here: never one that already
  // has a row above, even without a source, and only with evidence.
  const here = new Set(c.providerDeployments.map((d) => d.vendor.key))
  const gaps = c.whitespace.filter((w) => !here.has(w.key) && w.evidence)
  return (
    <>
      <Description c={c} />
      <SectionCard title="Vendors they work with" flush aside={<span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>Announcements from the trust or the vendor · {STATUS_NOTE}</span>}>
        <p className="px-4 sm:px-5 pb-3 text-[13px]" style={{ color: 'var(--fg-2)' }}>{deploymentsHeadline(c.providerDeployments, 'vendors')}</p>
        <DeploymentsTable rows={c.providerDeployments} slug={slug} side="vendor" />
      </SectionCard>
      <Similar c={c} slug={slug} title="Similar trusts" note="By type, region, size and shared vendors" />
      {gaps.length > 0 && (
        <SectionCard title="Not at this trust yet" count={gaps.length} flush aside={<span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>Named in sourced announcements at similar trusts, none here</span>}>
          <ul className="flex flex-col">
            {gaps.map((w) => (
              <li key={w.key} className="flex items-start gap-2.5 px-4 sm:px-5 py-2.5" style={{ borderTop: '1px solid var(--line)' }}>
                <Link href={companyPath(slug, w.key, w.name)} className="shrink-0 mt-0.5"><Initials name={w.name} size={28} /></Link>
                <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                  <Link href={companyPath(slug, w.key, w.name)} className="text-[13.5px] font-medium truncate hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{w.name}</Link>
                  {(w.oneLiner || w.useCase) && <span className="text-[12px] sm:truncate" style={{ color: 'var(--fg-3)' }}>{w.oneLiner ?? w.useCase}</span>}
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: 'var(--fg-4)' }}>
                    <span>At {w.at}</span>
                    {w.evidence && <SourceLine source={w.evidence} showAge />}
                    <ConfidenceMark level={confOf(w.confidence)} verifiedBy={w.review === 'verified' ? w.reviewedBy ?? 'the team' : null} verifiedAt={w.evidence?.date} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      <People c={c} />
      <Signals c={c} />
    </>
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

// The whole panel, self-fetching: the strip, then the sections for a vendor
// or a hospital, or the quiet line. Mounted on the sponsor company page.
// part: 'summary' is the strip only (the top of a sponsor's page, so the
// stage and contacts stay near the top); 'details' the sections below it
// (further down that page); 'all' both, as on a company's own profile.
export function IntelPanel({ companyKey: key, name, slug, part = 'all' }: { companyKey: string | null; name: string | null; slug: string | null; part?: 'all' | 'summary' | 'details' }) {
  const { data, isLoading, isError } = useIntel(key, name)
  if (part === 'details' && (isLoading || isError || !data?.company)) return null
  if (isLoading) return <div className="ws-card h-16 animate-pulse" />
  if (isError) return <p className="ws-card px-4 sm:px-5 py-3 text-[12.5px]" style={{ color: 'var(--fg-4)' }}>The intelligence layer could not be reached just now.</p>
  const c = data?.company
  if (!c) return <NoIntel />
  const provider = isProvider(c)
  const sections = provider ? <IntelHospitalSections c={c} slug={slug} /> : <IntelVendorSections c={c} slug={slug} />
  if (part === 'details') return sections
  return (
    <>
      <section className="ws-card overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-1 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Intelligence <span className="font-normal" style={{ color: 'var(--fg-4)' }}>{c.name}{c.providerType ? ` · ${providerTypeLabel(c.providerType)}` : ''}</span></h2>
          <span className="text-[12px]" style={{ color: 'var(--fg-4)' }}>WNG Intelligence dataset{c.lushaEnrichedAt ? ` and Lusha, ${monthYear(c.lushaEnrichedAt)}` : ''}</span>
        </div>
        <IntelStrip c={c} />
      </section>
      {part === 'all' && sections}
    </>
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
