'use client'

// The company profile's own parts (November 2026): where we are with the
// company as a row of steps, the links down the page, its numbers as tiles,
// and its news. The same on every company, so a profile reads the same way
// each time: who they are, where we are, the numbers, what they do, the
// news, then the hospitals, the people and the events.

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, ExternalLink, Newspaper } from 'lucide-react'
import { CardHead, fmtDate, useCollapse } from '@/components/crm/profileParts'
import { KINDS } from '@/lib/recordKinds'
import type { IntelCompany, Signal } from '@/lib/intel'
import { isProvider } from '@/lib/intel'
import { domainOf, isNews, monthYear, signalHeadline, signalLabel, tidySignals, usd } from './IntelPanel'

// ── Where we are with them ───────────────────────────────────────────────────

// One row of steps, the same on every company: in the directory, then the
// Sales stages (a Solution Provider) or Production (an End User). The steps
// behind are ticked, the one we are on is marked, and, once the company is
// in Sales, a later step moves it there.
export interface JourneyStep { key: string; label: string; hint?: string }
export function CompanyJourney({ steps, at, closed, onPick, busy }: { steps: JourneyStep[]; at: number; closed?: string | null; onPick?: (key: string) => void; busy?: boolean }) {
  return (
    <ol className="flex items-stretch gap-0 min-w-0 overflow-x-auto scrollbar-none -mx-1 px-1" aria-label="Where we are with this company">
      {steps.map((s, i) => {
        const done = !closed && i < at
        const here = !closed && i === at
        const can = !!onPick && !closed && i > 0 && i !== at
        const dot = (
          <span
            className="w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 text-[10.5px] font-semibold tabular"
            style={done ? { background: 'var(--ok)', color: 'var(--surface)' } : here ? { background: 'var(--accent)', color: 'var(--surface)', boxShadow: '0 0 0 3px var(--accent-soft)' } : { background: 'transparent', color: 'var(--fg-4)', boxShadow: 'inset 0 0 0 1.5px var(--line-3)' }}
          >
            {done ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
          </span>
        )
        const text = (
          <span className="min-w-0 text-left">
            <span className={`block text-[12.5px] leading-4 whitespace-nowrap ${here ? 'font-semibold' : 'font-medium'}`} style={{ color: here ? 'var(--fg)' : done ? 'var(--fg-2)' : 'var(--fg-3)' }}>{s.label}</span>
            {s.hint && <span className="block text-[11px] leading-4 whitespace-nowrap" style={{ color: 'var(--fg-4)' }}>{s.hint}</span>}
          </span>
        )
        return (
          <li key={s.key} className="flex items-center min-w-0 shrink-0" aria-current={here ? 'step' : undefined}>
            {i > 0 && <span aria-hidden className="w-5 sm:w-8 h-px mx-1.5 shrink-0" style={{ background: done || here ? 'var(--ok)' : 'var(--line-2)' }} />}
            {can ? (
              <button type="button" disabled={busy} onClick={() => onPick!(s.key)} className="flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-[var(--surface)] transition-colors" title={`Move to ${s.label.toLowerCase()}`}>
                {dot}{text}
              </button>
            ) : (
              <span className="flex items-center gap-2 py-1">{dot}{text}</span>
            )}
          </li>
        )
      })}
      {closed && (
        <li className="flex items-center shrink-0">
          <span aria-hidden className="w-5 sm:w-8 h-px mx-1.5 shrink-0" style={{ background: 'var(--line-2)' }} />
          <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: 'var(--bad)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--bad)' }} /> {closed}
          </span>
        </li>
      )}
    </ol>
  )
}

// The Sales steps as the pipeline names them, after "In the directory".
export function salesSteps(): JourneyStep[] {
  return [{ key: '__directory', label: 'In the directory' }, ...KINDS.sponsor.stages.filter((s) => !s.negative).map((s) => ({ key: s.status, label: s.label }))]
}

// ── Down the page ────────────────────────────────────────────────────────────

// The page's sections as links, kept under the top bar while the page
// scrolls, with the one in view marked. A section with nothing in it is not
// offered.
export interface SectionLink { id: string; label: string; count?: number | null }
export function SectionNav({ items, className = '' }: { items: SectionLink[]; className?: string }) {
  const [active, setActive] = useState(items[0]?.id ?? '')
  const [top, setTop] = useState(64)
  const ids = items.map((i) => i.id).join(',')
  useEffect(() => {
    const bar = () => Math.round(document.querySelector('header.crm-top')?.getBoundingClientRect().bottom ?? 64)
    const check = () => {
      const t = bar()
      setTop(t)
      // The last section whose top has passed under the bar.
      let cur = ids.split(',')[0]
      for (const id of ids.split(',')) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top - t - 72 <= 0) cur = id
      }
      setActive(cur)
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [ids])
  const go = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - top - 60, behavior: 'smooth' })
  }
  if (items.length < 2) return null
  return (
    <nav aria-label="On this page" className={`max-lg:hidden sticky z-20 -mx-1 px-1 py-1.5 ${className}`} style={{ top, background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(8px)' }}>
      <ul className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {items.map((i) => (
          <li key={i.id} className="shrink-0">
            <button type="button" onClick={() => go(i.id)} className="ws-chip" data-active={active === i.id} aria-current={active === i.id ? 'true' : undefined}>
              {i.label}{i.count != null && <span className="tabular" style={{ color: 'var(--fg-4)' }}>{i.count}</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ── The numbers ──────────────────────────────────────────────────────────────

const num = (n: number) => n.toLocaleString('en-GB')
const metaNum = (s: Signal | undefined, k: string): number | null => {
  const v = s?.meta?.[k]
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() && v !== 'null' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}
const pct = (n: number) => `${n > 0 ? '+' : ''}${Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10}%`

// A change, up or down, in its colour with its arrow.
function Trend({ change, text }: { change: number; text: string }) {
  const up = change >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-0.5" style={{ color: up ? 'var(--ok)' : 'var(--bad)' }}>
      <Icon className="w-3.5 h-3.5" />{text}
    </span>
  )
}

interface Tile { label: string; value: React.ReactNode; hint?: React.ReactNode; title?: string }

// The company in numbers: its size and how it is moving, its money, and
// what we hold on it. Each tile says where its figure is from on hover; the
// line under them says it once for all.
export function CompanyStats({ c, contacts, className = '' }: { c: IntelCompany; contacts: number; className?: string }) {
  const provider = isProvider(c)
  const figures = useMemo(() => c.figures ?? c.signals.filter((s) => !s.source.url && !isNews(s.type)), [c.figures, c.signals])
  const of = (re: RegExp) => figures.find((s) => re.test(s.type))
  const headcount = of(/^headcount/i)
  const hiring = of(/^surgeInHiring/i)
  const traffic = of(/^websiteTraffic/i)
  const itSpend = of(/^itSpend/i)

  const tiles: Tile[] = []
  if (c.teamFact) {
    const ch = metaNum(headcount, 'changePct')
    const window = headcount?.type.match(/(\d+)m$/)?.[1]
    tiles.push({
      label: 'Team', value: `about ${num(c.teamFact.value)}`,
      hint: ch != null && ch !== 0 ? <Trend change={ch} text={`${pct(ch)}${window ? ` in ${window} ${window === '1' ? 'month' : 'months'}` : ''}`} /> : c.teamRange ?? undefined,
      title: `${c.teamFact.source.label}${c.teamFact.source.date ? `, ${monthYear(c.teamFact.source.date)}` : ''}. A LinkedIn-based estimate, not a headcount.`,
    })
  }
  if (hiring) {
    const jobs = metaNum(hiring, 'newJobsPostedLastWeek') ?? metaNum(hiring, 'newJobsPostedLast4Weeks')
    const weekly = metaNum(hiring, 'newJobsPostedLastWeek') != null
    const avg = metaNum(hiring, 'historicalAvg')
    if (jobs != null) tiles.push({
      label: 'Hiring', value: `${num(jobs)} new ${jobs === 1 ? 'job' : 'jobs'}`,
      hint: `${weekly ? 'in a week' : 'in 4 weeks'}${avg != null ? ` · usually ${Math.round(avg * 10) / 10}` : ''}`,
      title: `${hiring.headline} Lusha, ${fmtDate(hiring.date)}.`,
    })
  }
  if (traffic) {
    const visits = metaNum(traffic, 'lastMonthVisits')
    const ch = metaNum(traffic, 'changePct')
    if (visits != null) tiles.push({
      label: 'Website visits', value: `${num(visits)} a month`,
      hint: ch != null ? <Trend change={/Decrease/i.test(traffic.type) ? -Math.abs(ch) : ch} text={`${pct(/Decrease/i.test(traffic.type) ? -Math.abs(ch) : ch)} on its average`} /> : undefined,
      title: `${traffic.headline} Lusha, ${fmtDate(traffic.date)}.`,
    })
  }
  if (c.funding && (c.funding.totalUsd || c.funding.lastRoundUsd)) {
    const last = c.funding.lastRoundUsd ? `${c.funding.lastRoundType ?? 'Last round'} ${usd(c.funding.lastRoundUsd)}${c.funding.lastRoundDate ? `, ${monthYear(c.funding.lastRoundDate)}` : ''}` : null
    tiles.push({ label: 'Funding', value: c.funding.totalUsd ? usd(c.funding.totalUsd) : last, hint: c.funding.totalUsd ? last ?? undefined : undefined, title: `${c.funding.source.label}${c.funding.source.date ? `, ${monthYear(c.funding.source.date)}` : ''}` })
  }
  if (c.revenueBand && (c.revenueBand.minUsd || c.revenueBand.maxUsd)) {
    tiles.push({ label: 'Revenue', value: [c.revenueBand.minUsd, c.revenueBand.maxUsd].filter((n): n is number => n != null).map(usd).join('–'), hint: 'a year, estimated', title: `${c.revenueBand.source.label}${c.revenueBand.source.date ? `, ${monthYear(c.revenueBand.source.date)}` : ''}` })
  }
  if (itSpend) {
    const spend = metaNum(itSpend, 'estimatedAnnualItSpend')
    const ch = metaNum(itSpend, 'changePct')
    if (spend != null) tiles.push({ label: 'IT spend', value: `${usd(spend)} a year`, hint: ch != null ? <Trend change={/Decrease/i.test(itSpend.type) ? -Math.abs(ch) : ch} text={pct(/Decrease/i.test(itSpend.type) ? -Math.abs(ch) : ch)} /> : 'estimated', title: `${itSpend.headline} Lusha, ${fmtDate(itSpend.date)}.` })
  }
  if (c.beds) tiles.push({ label: 'Beds', value: `about ${num(c.beds)}`, title: 'From the WNG Intelligence dataset; not yet checked by anyone on the team' })
  const sourced = provider ? c.vendors : c.hospitals
  if (sourced > 0) tiles.push({ label: provider ? 'Vendors' : 'Hospitals', value: num(sourced), hint: 'named in sourced announcements', title: 'A lower bound: only those with a source' })
  if (c.founded) tiles.push({ label: provider ? 'Formed' : 'Founded', value: String(c.founded), hint: c.hq ?? undefined })
  else if (c.hq) tiles.push({ label: 'Based in', value: provider && c.region ? c.region : c.hq })
  tiles.push({ label: 'In the CRM', value: `${num(contacts)} ${contacts === 1 ? 'contact' : 'contacts'}`, hint: c.people.length ? `${c.people.length} more named by Lusha` : undefined })
  if (c.status && c.status !== 'Active') tiles.push({ label: 'Status', value: c.acquiredBy ? `${c.status} by ${c.acquiredBy}` : c.status })

  // Where the figures are from, once.
  const from = new Set<string>()
  if (c.teamFact?.source.kind === 'lusha' || c.revenueBand || figures.length) from.add(`Lusha${c.teamFact?.source.date ? `, ${monthYear(c.teamFact.source.date)}` : ''}`)
  if (c.funding && c.funding.source.kind !== 'lusha' && (c.funding.totalUsd || c.funding.lastRoundUsd)) from.add(`funding from ${c.funding.source.label}${c.funding.source.date ? `, ${monthYear(c.funding.source.date)}` : ''}`)
  if (c.beds || sourced > 0) from.add('the WNG Intelligence dataset')

  return (
    <section id="numbers" className={`ws-card overflow-hidden scroll-mt-4 ${className}`}>
      <CardHead title="In numbers" sub={from.size ? `From ${Array.from(from).join(' · ')}. Team size is a LinkedIn-based estimate.` : undefined} />
      <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 m-0" style={{ borderTop: '1px solid var(--line)' }}>
        {tiles.map((t) => (
          <div key={t.label} className="crm-stat px-4 sm:px-5 py-3.5 min-w-0" title={t.title}>
            <dt className="text-[11.5px] font-medium" style={{ color: 'var(--fg-4)' }}>{t.label}</dt>
            <dd className="m-0 mt-1 text-[17px] font-semibold leading-tight tracking-tight tabular" style={{ color: 'var(--fg)' }}>{t.value}</dd>
            {t.hint && <dd className="m-0 mt-1 text-[12px] leading-snug" style={{ color: 'var(--fg-3)' }}>{t.hint}</dd>}
          </div>
        ))}
      </dl>
    </section>
  )
}

// ── The news ─────────────────────────────────────────────────────────────────

const NEWS_KEEP = 5

// What has happened to the company lately: each item opens its article, and
// says what kind of news it is, when, and where it was published.
export function CompanyNews({ c, className = '' }: { c: IntelCompany; className?: string }) {
  const [all, setAll] = useState(false)
  const collapse = useCollapse('company-news', true)
  // Newest first, each article once.
  const news = useMemo(() => tidySignals(c.news ?? c.signals).filter((s) => !!s.source.url).sort((x, y) => (y.date ?? '').localeCompare(x.date ?? '')), [c.news, c.signals])
  if (!news.length) return null
  const rows = all ? news : news.slice(0, NEWS_KEEP)
  return (
    <section id="news" className={`ws-card overflow-hidden scroll-mt-4 ${className}`}>
      <CardHead title="News" count={news.length} sub="From Lusha's news signals. Each opens the article it came from." collapse={{ open: collapse.open, toggle: collapse.toggle, id: collapse.id }} />
      <div id={collapse.id} className={collapse.bodyClass}>
        <ul className="flex flex-col">
          {rows.map((s, i) => {
            const title = typeof s.meta?.articleTitle === 'string' && s.meta.articleTitle !== 'null' ? s.meta.articleTitle : null
            const headline = signalHeadline(s)
            return (
              <li key={s.id ?? i} style={{ borderTop: '1px solid var(--line)' }}>
                <a href={s.source.url!} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 px-4 sm:px-5 py-3 crm-row" title={s.source.url!}>
                  <span className="mt-0.5 w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--fg-3)', border: '1px solid var(--line)' }}><Newspaper className="w-3.5 h-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 text-[11.5px]" style={{ color: 'var(--fg-4)' }}>
                      <span className="font-medium" style={{ color: 'var(--accent-ink)' }}>{signalLabel(s)}</span>
                      <span className="whitespace-nowrap">{fmtDate(s.date ?? s.source.date)}</span>
                    </span>
                    <span className="block text-[13.5px] font-medium leading-snug mt-0.5 group-hover:underline underline-offset-4" style={{ color: 'var(--fg)' }}>{headline}</span>
                    {title && title.replace(/\.$/, '').toLowerCase() !== headline.replace(/\.$/, '').toLowerCase() && <span className="block text-[12.5px] leading-snug mt-0.5 line-clamp-1" style={{ color: 'var(--fg-3)' }}>{title}</span>}
                    <span className="block text-[11.5px] mt-1" style={{ color: 'var(--fg-4)' }}>{domainOf(s.source.url) ?? 'Open the article'}<ExternalLink className="inline-block align-[-2px] ml-1 w-3 h-3" /></span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
        {news.length > NEWS_KEEP && (
          <div className="px-3 sm:px-4 py-2" style={{ borderTop: '1px solid var(--line)' }}>
            <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm ws-tap" style={{ color: 'var(--fg-3)' }} onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? 'Show fewer' : `Show all ${news.length}`} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${all ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
