'use client'

// The Content tab: a LinkedIn post a day for the edition, drafted from
// what the group already holds about it (an Insights briefing, a session,
// a speaker, a sponsor, the countdown), as an image in the brand's look
// and a caption in its voice. The team reads it, changes what it likes,
// copies the caption, saves the image, and marks it posted.

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, FileText, Linkedin, PenLine, RefreshCw, Send, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, Field, Segmented, Stat } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { LogPostModal, Notice, Tone, useEdition } from './shared'
import { CARD_LAYOUTS, brandFor, type BrandKey, type CardLayout } from '@/lib/contentBrand'

type Kind = 'insight' | 'session' | 'speaker' | 'theme' | 'countdown' | 'sponsor' | 'platform' | 'signal' | 'event'
type Pick = 'auto' | Kind
type Track = 'event' | 'nexus'

// As lib/contentStudio.ts has them; listed here so the page needs nothing server-side.
const KINDS: { value: Kind; label: string; hint: string; track: Track }[] = [
  { value: 'insight', label: 'Insight', hint: 'A published Insights briefing', track: 'event' },
  { value: 'session', label: 'Session', hint: 'A session on the agenda and its questions', track: 'event' },
  { value: 'speaker', label: 'Speaker', hint: 'A confirmed speaker who agreed to a post', track: 'event' },
  { value: 'theme', label: 'Theme', hint: 'A topic the agenda raises', track: 'event' },
  { value: 'countdown', label: 'Countdown', hint: 'Days to go, and booking', track: 'event' },
  { value: 'sponsor', label: 'Sponsor', hint: 'A sponsor on the line-up', track: 'event' },
  { value: 'insight', label: 'Insight', hint: 'A published Insights briefing, any series', track: 'nexus' },
  { value: 'platform', label: 'Platform', hint: 'What the intelligence platform tracks, in its own figures', track: 'nexus' },
  { value: 'signal', label: 'Signal', hint: 'A kind of market movement it watches: funding, deployments, hiring, M&A', track: 'nexus' },
  { value: 'event', label: 'Event', hint: 'The next summit across the group', track: 'nexus' },
]
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k

// The group's own page, filed as an edition of its own.
const NEXUS = { series: 'World Nexus Group', city: '', year: '', label: 'World Nexus Group' }

export interface Post {
  id: string
  edition: string
  series: string
  kind: Kind
  ref: string | null
  forDate: string | null
  kicker: string
  headline: string
  subline: string
  caption: string
  hashtags: string[]
  link: string | null
  source: { layout?: CardLayout; photo?: string; image?: string; logo?: string; format?: 'carousel'; pages?: 'carousel' | 'two-page'; by?: string; slides?: { kind: string }[]; dropped?: string[]; linkedin?: { state?: string; page?: string }; publishers?: string[] }
  brief: string | null
  status: 'draft' | 'posted'
  postUrl: string | null
  postedAt: string | null
  createdAt: string
  updatedAt: string
}

const fmtDay = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'No day set'

// The LinkedIn connection (api/linkedin): whether posts can go straight up.
interface LinkedInStatus {
  configured: boolean
  tableMissing: boolean
  redirectUri: string
  connected: boolean
  expiresAt: string | null
  renews: boolean
  pages: { urn: string; name: string }[]
  pageFor: Partial<Record<BrandKey, string>>
  pagesError: string | null
  /** Days left on the sign-in, worked out when it was read */
  days: number | null
}
function useLinkedIn() {
  return useQuery<LinkedInStatus>({
    queryKey: ['linkedin'],
    queryFn: async () => {
      const j = (await (await fetch('/api/linkedin', { cache: 'no-store' })).json()) as LinkedInStatus
      return { ...j, days: j.expiresAt ? Math.ceil((Date.parse(j.expiresAt) - Date.now()) / 86400000) : null }
    },
    refetchOnWindowFocus: true,
  })
}
const BRAND_NAMES: { key: BrandKey; name: string }[] = [
  { key: 'health', name: 'World Health AI' },
  { key: 'pharma', name: 'World Pharma AI' },
  { key: 'nexus', name: 'World Nexus Group' },
]

function LinkedInBar() {
  const qc = useQueryClient()
  const q = useLinkedIn()
  const [err, setErr] = useState('')
  const s = q.data
  if (!s) return null
  const call = async (method: string, body?: unknown) => {
    setErr('')
    const r = await fetch('/api/linkedin', { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) setErr(j?.error || 'That did not work.')
    else qc.invalidateQueries({ queryKey: ['linkedin'] })
  }
  const connect = () => window.open('/api/linkedin/connect', '_blank', 'noopener')
  const days = s.days
  return (
    <div className="ws-card px-5 py-4 mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <Linkedin className="w-4 h-4" style={{ color: 'var(--accent-ink)' }} />
        <p className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>LinkedIn</p>
        {!s.configured ? (
          <span className="text-[13px]" style={{ color: 'var(--fg-3)' }}>Not set up yet. Posts are downloaded and put up by hand until then.</span>
        ) : s.tableMissing ? (
          <span className="text-[13px]" style={{ color: 'var(--warn)' }}>Run supabase/migrations/012_linkedin_connection.sql in the Supabase SQL editor first.</span>
        ) : s.connected ? (
          <span className="text-[13px]" style={{ color: days != null && days <= 7 && !s.renews ? 'var(--warn)' : 'var(--fg-3)' }}>
            {`Connected${days != null && !s.renews ? ` · the sign-in lasts ${days} more day${days === 1 ? '' : 's'}` : ''}`}
          </span>
        ) : (
          <span className="text-[13px]" style={{ color: 'var(--fg-3)' }}>Connect once to post drafts straight to the company pages.</span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {s.configured && !s.tableMissing && (
            <button type="button" onClick={connect} className={cn('ws-btn ws-btn-sm', !s.connected && 'ws-btn-primary')}>
              <ExternalLink className="w-3.5 h-3.5" /> {s.connected ? 'Connect again' : 'Connect LinkedIn'}
            </button>
          )}
          {s.connected && <button type="button" onClick={() => call('POST', { action: 'refresh-pages' })} className="ws-btn ws-btn-ghost ws-btn-sm" title="Read the pages again">Refresh pages</button>}
        </span>
      </div>
      {!s.configured && (
        <p className="text-[12.5px] mt-2" style={{ color: 'var(--fg-4)' }}>
          {`When LinkedIn approves the app (Community Management API), add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to the CRM in Vercel and redeploy. In the LinkedIn app, the authorised redirect URL is ${s.redirectUri}`}
        </p>
      )}
      {s.connected && (
        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          {BRAND_NAMES.map((b) => (
            <Field key={b.key} label={`${b.name} posts to`}>
              <select className="ws-input" value={s.pageFor[b.key] ?? ''} onChange={(e) => call('PATCH', { pageFor: { ...s.pageFor, [b.key]: e.target.value || undefined } })}>
                <option value="">Not chosen</option>
                {s.pages.map((p) => <option key={p.urn} value={p.urn}>{p.name}</option>)}
              </select>
            </Field>
          ))}
        </div>
      )}
      {s.connected && !s.pages.length && (
        <p className="text-[12.5px] mt-2" style={{ color: 'var(--warn)' }}>{`No company pages came back${s.pagesError ? ` (${s.pagesError})` : ''}. The person who connected must be an admin of the pages.`}</p>
      )}
      {err && <p className="text-[12.5px] mt-2" style={{ color: 'var(--bad)' }}>{err}</p>}
    </div>
  )
}

export function ContentStudio() {
  const edition = useEdition()
  // Which page the posts are for: this edition, or World Nexus Group (the
  // parent, whose page is about the intelligence platform).
  const [track, setTrack] = useState<Track>('event')
  const ed = track === 'nexus' ? NEXUS : edition
  const qc = useQueryClient()
  const key = ['marketing', 'content', ed?.label ?? '']
  const q = useQuery<{ data: Post[]; error?: string; migration?: boolean }>({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(`/api/marketing/content?edition=${encodeURIComponent(ed!.label)}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return { data: [], error: j?.error || 'Could not load', migration: Boolean(j?.migration) }
      return j
    },
    enabled: Boolean(ed),
    placeholderData: (prev) => prev,
  })
  const posts = useMemo(() => q.data?.data ?? [], [q.data])
  const refresh = () => qc.invalidateQueries({ queryKey: key })

  const [pick, setPick] = useState<Pick>('auto')
  const [brief, setBrief] = useState('')
  const [forDate, setForDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'all' | 'draft' | 'posted'>('all')
  // A single post, or a LinkedIn carousel from an Insights briefing.
  const [format, setFormat] = useState<'single' | 'carousel'>('single')
  const kinds = KINDS.filter((k) => k.track === track)

  async function generate(opts: { kind?: Pick; brief?: string; forDate?: string; format?: 'single' | 'carousel'; ref?: string | null } = {}) {
    if (!ed) return
    setBusy(true)
    setError('')
    const kind = opts.kind ?? pick
    const fmt = opts.format ?? format
    const r = await fetch('/api/marketing/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ed, kind: kind === 'auto' ? null : kind, brief: opts.brief ?? brief, forDate: opts.forDate ?? forDate ?? null, format: fmt, ref: opts.ref ?? null }),
    })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) {
      setError(j?.error || 'The post could not be written.')
      return
    }
    setBrief('')
    setForDate('')
    refresh()
  }

  const shown = posts.filter((p) => (view === 'all' ? true : p.status === view))
  const drafts = posts.filter((p) => p.status === 'draft')
  const posted = posts.filter((p) => p.status === 'posted')
  const nextDay = drafts.map((p) => p.forDate).filter(Boolean).sort()[0] ?? null
  const migration = Boolean(q.data?.migration)

  return (
    <WorkspacePage
      title="Content"
      description={track === 'nexus'
        ? 'A LinkedIn post a day for World Nexus Group: the intelligence platform, the market signals it watches, the Insights desk and the next summit, in the group\u2019s own look.'
        : 'A LinkedIn post a day for this edition: an image in the event\u2019s own look and a caption in its voice, drawn from the Insights desk, the agenda, the line-up and the countdown.'}
      actions={
        <Segmented
          size="sm"
          value={track}
          onChange={(t) => { setTrack(t); setPick('auto'); setError('') }}
          options={[
            { value: 'event', label: edition ? `${edition.series} ${edition.city} ${edition.year}`.replace(/\s+/g, ' ').trim() : 'This edition', hint: 'Posts for the event\u2019s own page' },
            { value: 'nexus', label: 'World Nexus Group', hint: 'Posts for the group\u2019s page: the intelligence platform' },
          ]}
        />
      }
    >
      {q.data?.error ? (
        <Notice message={q.data.error} tone={migration ? 'warn' : 'bad'} />
      ) : (
        <>
          <LinkedInBar />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat label="Drafts ready" value={drafts.length} loading={q.isLoading} hint={nextDay ? `Next planned for ${fmtDay(nextDay)}` : 'Nothing planned yet'} />
            <Stat label="Posted" value={posted.length} loading={q.isLoading} hint={posted[0]?.postedAt ? `Last on ${fmtDay(posted[0].postedAt.slice(0, 10))}` : 'None yet'} />
            <Stat label="From Insights" value={posts.filter((p) => p.kind === 'insight').length} loading={q.isLoading} hint="briefings turned into posts" />
            <Stat label="From the agenda" value={posts.filter((p) => p.kind === 'session' || p.kind === 'theme').length} loading={q.isLoading} hint="sessions and themes" />
          </div>

          {/* Draft one */}
          <div className="ws-card px-5 py-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <PenLine className="w-4 h-4" style={{ color: 'var(--accent-ink)' }} />
              <p className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>Draft the next post</p>
            </div>
            <div className="mb-3">
              <Segmented
                size="sm"
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'single', label: 'Single post', hint: 'One image and a caption' },
                  { value: 'carousel', label: 'Carousel', hint: 'Swipeable slides from an Insights briefing, as a PDF for LinkedIn' },
                ]}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {format === 'carousel' ? (
                <Field label="What it is about" hint="One of the newest Insights briefings not yet turned into a carousel.">
                  <p className="ws-input flex items-center" style={{ color: 'var(--fg-2)' }}>An Insights briefing: the news, a statistic, the data, a quote</p>
                </Field>
              ) : (
                <Field label="What it is about" hint="Choose for me rotates through the kinds, skipping what the last posts used.">
                  <select className="ws-input" value={pick} onChange={(e) => setPick(e.target.value as Pick)}>
                    <option value="auto">Choose for me</option>
                    {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}: {k.hint}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Planned for" hint="Left blank, the next day with nothing planned.">
                <input className="ws-input" type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} />
              </Field>
              <Field label="Any steer (optional)" span hint="A line for the writer: an angle, a person to mention, something to leave out.">
                <input className="ws-input" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={track === 'nexus' ? 'e.g. Aim it at investors; keep it to deployments' : 'e.g. Lead with the NHS angle; mention the early-bird rate ends Friday'} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button type="button" onClick={() => generate()} disabled={busy || !ed} className="ws-btn ws-btn-primary">
                {busy ? <><RefreshCw className="w-4 h-4 animate-spin" /> Writing…</> : format === 'carousel' ? 'Draft the carousel' : 'Draft the post'}
              </button>
              {error && <span className="text-[13px]" style={{ color: 'var(--bad)' }}>{error}</span>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mb-3">
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'all', label: `All ${posts.length}` },
                { value: 'draft', label: `Drafts ${drafts.length}` },
                { value: 'posted', label: `Posted ${posted.length}` },
              ]}
            />
          </div>

          {q.isLoading ? (
            <p className="text-[13px]" style={{ color: 'var(--fg-3)' }}>Loading…</p>
          ) : shown.length === 0 ? (
            <div className="ws-card">
              <EmptyState icon={PenLine} title={posts.length ? 'Nothing here' : 'No posts drafted yet'} body={posts.length ? 'Nothing in this view.' : 'Draft the first one above. Each takes about half a minute.'} className="py-12" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {shown.map((p) => (
                <PostCard key={p.id} post={p} onChanged={refresh} onRegenerate={() => generate({ kind: p.kind, brief: p.brief ?? '', forDate: p.forDate ?? '', format: p.source?.format === 'carousel' ? 'carousel' : 'single', ref: p.source?.format === 'carousel' ? p.ref : null })} busy={busy} />
              ))}
            </div>
          )}
        </>
      )}
    </WorkspacePage>
  )
}

function PostCard({ post, onChanged, onRegenerate, busy }: { post: Post; onChanged: () => void; onRegenerate: () => void; busy: boolean }) {
  const [caption, setCaption] = useState(post.caption)
  const [headline, setHeadline] = useState(post.headline)
  const [subline, setSubline] = useState(post.subline)
  const [kicker, setKicker] = useState(post.kicker)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [logging, setLogging] = useState(false)
  const [v, setV] = useState(0)
  const li = useLinkedIn().data
  const brand = brandFor(post.series)
  const liPage = li?.connected ? li.pages.find((p) => p.urn === li.pageFor[brand]) : undefined
  // Where the facts come from, for the team only: the briefing's publishers,
  // or on older carousels the source each slide used to carry.
  const sources = [...new Set([
    ...(post.source?.publishers ?? []),
    ...((post.source?.slides ?? []) as { source?: string | null }[]).flatMap((x) => (x.source ? x.source.split(/,\s*/) : [])),
  ].filter(Boolean))]
  const [posting, setPosting] = useState(false)
  const [postErr, setPostErr] = useState('')
  const [layout, setLayout] = useState<CardLayout>(post.source?.layout ?? 'headline')
  const carousel = post.source?.format === 'carousel'
  const slideNames = (post.source?.slides ?? []).map((x) => ({ news: 'The news', statistic: 'Statistic', data: 'Data', quote: 'Quote', end: 'Read more' } as Record<string, string>)[x.kind] ?? x.kind)
  const slideCount = Math.max(1, slideNames.length)
  const [slide, setSlide] = useState(0)
  const dirty = caption !== post.caption || headline !== post.headline || subline !== post.subline || kicker !== post.kicker
  const text = `${caption.trim()}\n\n${post.hashtags.join(' ')}`.trim()
  const image = `/api/marketing/content/${post.id}/image?v=${encodeURIComponent(post.updatedAt)}-${v}`

  async function patch(fields: Record<string, unknown>) {
    setSaving(true)
    const r = await fetch(`/api/marketing/content/${post.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) })
    setSaving(false)
    if (r.ok) {
      setV((n) => n + 1)
      onChanged()
    }
    return r.ok
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* the caption is on screen to select */ }
  }
  // Approve and post: up on the brand's page now, then marked posted.
  async function approve() {
    if (!liPage) return
    if (dirty && !(await patch({ caption, headline, subline, kicker }))) return
    if (!confirm(`Post this to ${liPage.name} on LinkedIn now?`)) return
    setPosting(true)
    setPostErr('')
    const r = await fetch(`/api/marketing/content/${post.id}/linkedin`, { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    setPosting(false)
    if (!r.ok) {
      setPostErr(j?.error || 'It could not be posted.')
      return
    }
    onChanged()
  }
  async function remove() {
    if (!confirm('Delete this draft?')) return
    const r = await fetch(`/api/marketing/content/${post.id}`, { method: 'DELETE' })
    if (r.ok) onChanged()
  }

  return (
    <div className="ws-card overflow-hidden">
      <div className="grid md:grid-cols-[300px_1fr]">
        {/* The image, or the carousel's slides */}
        {carousel ? (
          <div className="p-4" style={{ background: 'var(--surface-2)', borderRight: '1px solid var(--line)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${image}&slide=${slide + 1}`} alt={`Slide ${slide + 1} of ${slideCount}`} width={1080} height={1350} className="w-full h-auto block" style={{ aspectRatio: '1080 / 1350', background: '#0A0F1D' }} />
            <div className="flex items-center gap-2 mt-3">
              <button type="button" className="ws-btn ws-btn-sm" disabled={slide === 0} onClick={() => setSlide((n) => n - 1)} aria-label="Previous slide"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="text-[12.5px] tabular flex-1 text-center" style={{ color: 'var(--fg-3)' }}>{`${slideNames[slide] ?? ''} · ${slide + 1} of ${slideCount}`}</span>
              <button type="button" className="ws-btn ws-btn-sm" disabled={slide >= slideCount - 1} onClick={() => setSlide((n) => n + 1)} aria-label="Next slide"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <a href={`/api/marketing/content/${post.id}/carousel`} className="ws-btn ws-btn-primary ws-btn-sm flex-1 justify-center" title="Every slide as one PDF: on LinkedIn, Add a document"><FileText className="w-3.5 h-3.5" /> Download PDF</a>
              <a href={`${image}&slide=${slide + 1}&download=1`} className="ws-btn ws-btn-sm" title="This slide as a 1080 × 1350 PNG"><Download className="w-3.5 h-3.5" /> Slide</a>
            </div>
            {post.source?.dropped?.length ? (
              <p className="text-[11.5px] mt-2" style={{ color: 'var(--fg-4)' }}>{`Left out, as not in the briefing word for word: ${post.source.dropped.join('; ')}.`}</p>
            ) : null}
          </div>
        ) : (
        <div className="p-4" style={{ background: 'var(--surface-2)', borderRight: '1px solid var(--line)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" width={1080} height={1080} className="w-full h-auto block" style={{ aspectRatio: '1 / 1', background: '#0A0F1D' }} />
          <div className="flex items-center gap-2 mt-3">
            <select
              className="ws-input"
              style={{ height: 32, padding: '0 8px', fontSize: 12.5, flex: 1 }}
              value={layout}
              onChange={async (e) => { const l = e.target.value as CardLayout; setLayout(l); await patch({ layout: l }) }}
              aria-label="Card layout"
              title="How the card is set"
            >
              {CARD_LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}: {l.hint}</option>)}
            </select>
            <a href={`${image}&download=1`} className="ws-btn ws-btn-sm" title="1080 × 1080 PNG"><Download className="w-3.5 h-3.5" /> Save</a>
          </div>
        </div>
        )}

        {/* The words */}
        <div className="p-4 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Tone tone={post.status === 'posted' ? 'ok' : 'accent'}>{post.status === 'posted' ? 'Posted' : 'Draft'}</Tone>
            <Tone tone="muted">{kindLabel(post.kind)}</Tone>
            {post.source?.by === 'routine' && <Tone tone="muted">Daily routine</Tone>}
            <span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{fmtDay(post.forDate)}</span>
            {post.postUrl && <a href={post.postUrl} target="_blank" rel="noreferrer" className="text-[12.5px] hover:underline underline-offset-4" style={{ color: 'var(--accent-ink)' }}>View the post</a>}
            <span className="ml-auto flex items-center gap-1">
              <button type="button" onClick={onRegenerate} disabled={busy} className="ws-btn ws-btn-ghost ws-btn-sm" title="Write it again from the same material"><RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} /> Again</button>
              <button type="button" onClick={remove} className="ws-btn ws-btn-ghost ws-btn-sm" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
            </span>
          </div>

          {carousel && <Tone tone="muted">{post.source?.pages === 'two-page' ? 'Two-page post' : 'Carousel'}</Tone>}
          <div className={cn('grid sm:grid-cols-[1fr_2fr] gap-2', carousel && 'hidden')}>
            <input className="ws-input" value={kicker} onChange={(e) => setKicker(e.target.value)} placeholder="Kicker" aria-label="Kicker" />
            <input className="ws-input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" aria-label="Headline" />
            <input className="ws-input sm:col-span-2" value={subline} onChange={(e) => setSubline(e.target.value)} placeholder="Subline" aria-label="Subline" />
          </div>
          <textarea className="ws-input" rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Caption" style={{ resize: 'vertical', lineHeight: 1.5 }} />
          <p className="text-[12.5px] break-words" style={{ color: 'var(--accent-ink)' }}>{post.hashtags.join(' ')}</p>
          {post.link && <p className="text-[12px] truncate" style={{ color: 'var(--fg-4)' }}>Points to {post.link}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {dirty ? (
              <button type="button" onClick={() => patch({ caption, headline, subline, kicker })} disabled={saving} className="ws-btn ws-btn-primary ws-btn-sm">{saving ? 'Saving…' : 'Save changes'}</button>
            ) : (
              <button type="button" onClick={copy} className="ws-btn ws-btn-sm">{copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy caption</>}</button>
            )}
            {post.status === 'posted' ? (
              <button type="button" onClick={() => patch({ status: 'draft' })} className="ws-btn ws-btn-ghost ws-btn-sm">Back to draft</button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={approve}
                  disabled={!liPage || posting}
                  className="ws-btn ws-btn-primary ws-btn-sm"
                  title={liPage ? `Puts it up on ${liPage.name} now` : li?.connected ? 'Choose this brand\u2019s LinkedIn page at the top of the tab first' : 'Connect LinkedIn at the top of the tab first'}
                >
                  {posting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Posting…</> : <><Send className="w-3.5 h-3.5" /> Approve and post</>}
                </button>
                <button type="button" onClick={() => setLogging(true)} className="ws-btn ws-btn-ghost ws-btn-sm">Mark as posted</button>
              </>
            )}
          </div>
          {postErr && <p className="text-[12.5px]" style={{ color: 'var(--bad)' }}>{postErr}</p>}
          {sources.length > 0 && (
            <p className="text-[12px]" style={{ color: 'var(--fg-4)' }} title="For your reference: not shown on the post">
              {`Sources (not on the post): ${sources.join(', ')}`}
            </p>
          )}
        </div>
      </div>
      {logging && (
        <LogPostModal
          title="Mark as posted"
          subtitle="The link to the post on LinkedIn, so the team can find it later."
          onClose={() => setLogging(false)}
          onSave={async (url) => patch({ status: 'posted', postUrl: url || null })}
        />
      )}
    </div>
  )
}
