'use client'

// The Content tab: a LinkedIn post a day for the edition, drafted from
// what the group already holds about it (an Insights briefing, a session,
// a speaker, a sponsor, the countdown), as an image in the brand's look
// and a caption in its voice. Each card can be drawn in twenty looks
// (contentBrand) and shuffled between them, or chosen from the look
// gallery, which draws the post in every one. The team
// reads it, changes what it likes, copies the caption or posts it straight
// to LinkedIn, and marks it posted.

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Bookmark, CaseUpper, Check, ChevronDown, ChevronLeft, ChevronRight, Columns2, Copy, Download, Droplet, ExternalLink, FileText, Film, Frame, Image as ImageIcon, LayoutGrid, Layers, Linkedin, Milestone, Moon, Newspaper, PenLine, RefreshCw, Send, Shuffle, Sparkles, Square, SquareSplitVertical, StickyNote, Sun, Target, Trash2, Triangle, Undo2, Waves } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, Field, Segmented, Stat } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { LogPostModal, Notice, Tone, useEdition } from './shared'
import { LookGallery } from './LookGallery'
import { CARD_STYLES, brandFor, photosFor, styleOf, stylesFor, type BrandKey, type CardStyle } from '@/lib/contentBrand'

type Kind = 'insight' | 'session' | 'speaker' | 'theme' | 'countdown' | 'sponsor' | 'platform' | 'signal' | 'event'
type Pick = 'auto' | Kind
type Track = 'event' | 'nexus'
type Look = 'rotate' | CardStyle

// As lib/contentStudio.ts has them; listed here so the page needs nothing server-side.
const KINDS: { value: Kind; label: string; hint: string; track: Track }[] = [
  { value: 'insight', label: 'Insight', hint: 'A published Insights briefing', track: 'event' },
  { value: 'session', label: 'Session', hint: 'A session on the agenda and who is on it', track: 'event' },
  { value: 'speaker', label: 'Speaker', hint: 'A confirmed speaker who agreed to a post', track: 'event' },
  { value: 'theme', label: 'Theme', hint: 'A question the agenda raises', track: 'event' },
  { value: 'countdown', label: 'Countdown', hint: 'Days to go, and booking', track: 'event' },
  { value: 'sponsor', label: 'Sponsor', hint: 'A sponsor on the line-up', track: 'event' },
  { value: 'insight', label: 'Insight', hint: 'A published Insights briefing, any series', track: 'nexus' },
  { value: 'platform', label: 'Platform', hint: 'What the intelligence platform tracks, in its own figures', track: 'nexus' },
  { value: 'signal', label: 'Signal', hint: 'A kind of market movement it watches: funding, deployments, hiring, M&A', track: 'nexus' },
  { value: 'event', label: 'Event', hint: 'The next summit across the group', track: 'nexus' },
]
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k

const STYLE_ICONS: Record<CardStyle, typeof ImageIcon> = { photo: ImageIcon, night: Moon, light: Sun, block: Square, frame: Frame, bands: Layers, rings: Target, bars: BarChart3, arcs: Waves, wedge: Triangle, mosaic: LayoutGrid, split: SquareSplitVertical, masthead: Newspaper, column: Columns2, tape: Bookmark, paper: StickyNote, ticks: Milestone, tint: Droplet, initial: CaseUpper, still: Film }

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
  source: { style?: CardStyle; photo?: string; photos?: string[]; image?: string; logo?: string; format?: 'carousel'; pages?: 'carousel' | 'two-page'; by?: string; slides?: { kind: string }[]; dropped?: string[]; before?: unknown; steers?: { text: string; at: string }[]; linkedin?: { state?: string; page?: string }; publishers?: string[] } & Record<string, unknown>
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
  const [look, setLook] = useState<Look>('rotate')
  const [browsing, setBrowsing] = useState(false)
  const [brief, setBrief] = useState('')
  const [forDate, setForDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'all' | 'draft' | 'posted'>('all')
  // A single post, or a LinkedIn carousel from an Insights briefing.
  const [format, setFormat] = useState<'single' | 'carousel'>('single')
  const kinds = KINDS.filter((k) => k.track === track)

  async function generate(opts: { kind?: Pick; brief?: string; forDate?: string; format?: 'single' | 'carousel'; ref?: string | null; style?: Look } = {}) {
    if (!ed) return
    setBusy(true)
    setError('')
    const kind = opts.kind ?? pick
    const fmt = opts.format ?? format
    const style = opts.style ?? look
    const r = await fetch('/api/marketing/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ed, kind: kind === 'auto' ? null : kind, brief: opts.brief ?? brief, forDate: opts.forDate ?? forDate ?? null, format: fmt, ref: opts.ref ?? null, style: style === 'rotate' ? null : style }),
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
        ? 'A LinkedIn post a day for World Nexus Group: the intelligence platform, the market signals it watches, the Insights desk and the next summit, in the group’s own look.'
        : 'A LinkedIn post a day for this edition, drawn from the Insights desk, the agenda, the line-up and the countdown. Every card comes in eleven looks, and each post can be shuffled between them.'}
      actions={
        <Segmented
          size="sm"
          value={track}
          onChange={(t) => { setTrack(t); setPick('auto'); setError('') }}
          options={[
            { value: 'event', label: edition ? `${edition.series} ${edition.city} ${edition.year}`.replace(/\s+/g, ' ').trim() : 'This edition', hint: 'Posts for the event’s own page' },
            { value: 'nexus', label: 'World Nexus Group', hint: 'Posts for the group’s page: the intelligence platform' },
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
              <Field label="Look" hint="Browse the looks to see each one drawn for this edition. In turn takes each of the twenty before any comes round again; any card can be changed afterwards.">
                <button type="button" className="ws-input flex items-center gap-2 text-left w-full" onClick={() => setBrowsing(true)} aria-haspopup="dialog" aria-expanded={browsing}>
                  <LookIcon look={look} />
                  <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--fg)' }}>{look === 'rotate' ? 'The next look in turn' : CARD_STYLES.find((s) => s.value === look)?.label ?? look}</span>
                  <span className="text-[12px] shrink-0" style={{ color: 'var(--accent-ink)' }}>Browse</span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--fg-4)' }} />
                </button>
              </Field>
              {browsing && ed && (
                <LookGallery
                  title="Choose the look"
                  subtitle={`How each look draws ${format === 'carousel' ? 'a carousel cover' : pick === 'auto' ? 'a briefing' : `a ${kindLabel(pick).toLowerCase()} post`} for ${ed.label}: a sample, with its own speakers, sponsors and photos where it has them.`}
                  looks={CARD_STYLES.filter((s) => stylesFor(pick === 'auto' ? null : pick).includes(s.value))}
                  icons={STYLE_ICONS}
                  current={look}
                  rotate
                  portrait={format === 'carousel'}
                  preview={(style) => `/api/marketing/content/sample?${new URLSearchParams({ series: ed.series, city: ed.city, year: ed.year, kind: pick === 'auto' ? 'insight' : pick, style, ...(format === 'carousel' ? { format: 'carousel' } : {}) })}`}
                  onPick={(style) => { setLook(style); setBrowsing(false) }}
                  onClose={() => setBrowsing(false)}
                />
              )}
              <Field label="Planned for" hint="Left blank, the next day with nothing planned.">
                <input className="ws-input" type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} />
              </Field>
              <Field label="Any steer (optional)" hint="A line for the writer: an angle, a person to mention, something to leave out.">
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
                <PostCard
                  key={p.id}
                  post={p}
                  onChanged={refresh}
                  onRegenerate={() => generate({ kind: p.kind, brief: p.brief ?? '', forDate: p.forDate ?? '', format: p.source?.format === 'carousel' ? 'carousel' : 'single', ref: p.source?.format === 'carousel' ? p.ref : null, style: styleOf(p.source) })}
                  busy={busy}
                />
              ))}
            </div>
          )}
        </>
      )}
    </WorkspacePage>
  )
}

// The current look's icon, in the look field and the card's bar.
function LookIcon({ look, busy = false }: { look: Look; busy?: boolean }) {
  const Icon = look === 'rotate' ? Shuffle : STYLE_ICONS[look]
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }} aria-hidden="true">
      {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
    </span>
  )
}

// The look a card is drawn in: its name opens the gallery, the post drawn
// in every look it can take, to pick from; a shuffle takes the next. For a
// look with photos, choosing it again takes other ones.
function StyleBar({ post, onChanged }: { post: Post; onChanged: () => void }) {
  const [busy, setBusy] = useState<CardStyle | 'next' | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const current = styleOf(post.source)
  const carousel = post.source?.format === 'carousel'
  const looks = CARD_STYLES.filter((s) => stylesFor(post.kind).includes(s.value))
  const meta = CARD_STYLES.find((s) => s.value === current)
  async function set(style?: CardStyle) {
    setBusy(style ?? 'next')
    setErr('')
    try {
      const r = await fetch(`/api/marketing/content/${post.id}/style`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(style ? { style } : {}) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErr(j?.error || 'That look could not be drawn.')
        return
      }
      setOpen(false)
      onChanged()
    } catch {
      setErr('The CRM could not be reached. Try again.')
    } finally {
      setBusy(null)
    }
  }
  // A speaker's own headshot fills the photo and frame looks, so there is no other photo to take.
  const again = photosFor(current) > 0 && !(post.kind === 'speaker' && (current === 'photo' || current === 'frame'))
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy !== null}
          className="ws-input flex-1 min-w-0 flex items-center gap-2 text-left"
          style={{ height: 36, padding: '0 8px 0 4px', fontSize: 12.5 }}
          aria-haspopup="dialog"
          aria-expanded={open}
          title={meta ? `${meta.label}: ${meta.hint}. Click to see every look.` : 'The look'}
        >
          <LookIcon look={current} busy={busy !== null} />
          <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--fg)' }}>{meta?.label ?? current}</span>
          <span className="text-[11.5px] shrink-0" style={{ color: 'var(--accent-ink)' }}>{`${looks.length} looks`}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--fg-4)' }} />
        </button>
        <button type="button" onClick={() => set()} disabled={busy !== null} className="ws-btn ws-btn-sm" style={{ height: 36 }} title="The next look, with other photos when it takes them" aria-label="Shuffle the look">
          <Shuffle className="w-3.5 h-3.5" />
        </button>
      </div>
      {again && (
        <div className="flex items-center justify-end mt-1.5">
          <button type="button" onClick={() => set(current)} disabled={busy !== null} className="text-[11.5px] shrink-0 hover:underline underline-offset-4" style={{ color: 'var(--accent-ink)' }}>
            Other photos
          </button>
        </div>
      )}
      {err && !open && <p className="text-[12px] mt-1.5" style={{ color: 'var(--bad)' }}>{err}</p>}
      {open && (
        <LookGallery
          title={carousel ? 'Choose the cover\'s look' : 'Choose the look'}
          subtitle={carousel ? 'This carousel\'s cover, drawn in every look it can take. The slides after it follow in the night, or on white.' : 'This post, drawn in every look it can take. Click one to redraw it.'}
          looks={looks}
          icons={STYLE_ICONS}
          current={current}
          portrait={carousel}
          busy={busy === 'next' ? null : busy}
          again={again}
          error={err}
          preview={(style) => `/api/marketing/content/${post.id}/image?style=${style}&v=${encodeURIComponent(post.updatedAt)}`}
          onPick={(style) => { if (style !== 'rotate') set(style) }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// A slide's words as saved in the post (lib/contentCarousel's Slide).
type SlideWords = { kind: string; points?: { figure: string; label: string }[] } & Record<string, unknown>

const SLIDE_FIELDS: Record<string, { key: string; label: string; long?: boolean }[]> = {
  news: [{ key: 'kicker', label: 'Kicker' }, { key: 'headline', label: 'Headline' }, { key: 'summary', label: 'Summary', long: true }],
  statistic: [{ key: 'figure', label: 'Figure' }, { key: 'label', label: 'What it measures' }, { key: 'context', label: 'Context', long: true }],
  data: [{ key: 'title', label: 'Title' }],
  quote: [{ key: 'text', label: 'Quotation (word for word)', long: true }, { key: 'speaker', label: 'Speaker' }, { key: 'role', label: 'Role' }],
  end: [{ key: 'headline', label: 'Closing line' }],
}

// The words on the slide in view, to correct before it goes out.
function SlideEditor({ slide, name, onChange }: { slide: SlideWords; name: string; onChange: (next: SlideWords) => void }) {
  const fields = SLIDE_FIELDS[slide.kind] ?? []
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px]" style={{ color: 'var(--fg-3)' }}>{`The words on ${name}`}</span>
      {fields.map((f) =>
        f.long ? (
          <textarea key={f.key} className="ws-input" rows={2} value={str(slide[f.key])} onChange={(e) => onChange({ ...slide, [f.key]: e.target.value })} placeholder={f.label} aria-label={f.label} style={{ resize: 'vertical', lineHeight: 1.45 }} />
        ) : (
          <input key={f.key} className="ws-input" value={str(slide[f.key])} onChange={(e) => onChange({ ...slide, [f.key]: e.target.value })} placeholder={f.label} aria-label={f.label} />
        ),
      )}
      {slide.kind === 'data' && (slide.points ?? []).map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
          <input className="ws-input" value={p.figure} onChange={(e) => onChange({ ...slide, points: (slide.points ?? []).map((q, j) => (j === i ? { ...q, figure: e.target.value } : q)) })} placeholder="Figure" aria-label={`Figure ${i + 1}`} />
          <input className="ws-input" value={p.label} onChange={(e) => onChange({ ...slide, points: (slide.points ?? []).map((q, j) => (j === i ? { ...q, label: e.target.value } : q)) })} placeholder="What it measures" aria-label={`Label ${i + 1}`} />
        </div>
      ))}
    </div>
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
  const carousel = post.source?.format === 'carousel'
  const slideNames = (post.source?.slides ?? []).map((x) => ({ news: 'The news', statistic: 'Statistic', data: 'Data', quote: 'Quote', end: 'Read more' } as Record<string, string>)[x.kind] ?? x.kind)
  const slideCount = Math.max(1, slideNames.length)
  const [slide, setSlide] = useState(0)
  // A carousel's words, slide by slide, as the team corrects them.
  const [slides, setSlides] = useState<SlideWords[]>(() => ((post.source?.slides ?? []) as SlideWords[]).map((x) => ({ ...x })))
  const slidesDirty = carousel && JSON.stringify(slides) !== JSON.stringify(post.source?.slides ?? [])
  const dirty = caption !== post.caption || headline !== post.headline || subline !== post.subline || kicker !== post.kicker || slidesDirty
  const words = () => ({ caption, headline, subline, kicker, ...(slidesDirty ? { slides } : {}) })
  // The team's instruction for Claude to rewrite the post by.
  const [steer, setSteer] = useState('')
  const [revising, setRevising] = useState<'revise' | 'undo' | null>(null)
  const [reviseErr, setReviseErr] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const text = `${caption.trim()}\n\n${post.hashtags.join(' ')}`.trim()
  const image = `/api/marketing/content/${post.id}/image?v=${encodeURIComponent(post.updatedAt)}-${v}`

  async function patch(fields: Record<string, unknown>) {
    setSaving(true)
    const r = await fetch(`/api/marketing/content/${post.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) })
    setSaving(false)
    if (r.ok) {
      // The slides as saved (house style applied), so they read as unchanged.
      if (fields.slides) {
        const saved = ((await r.json().catch(() => ({})))?.post?.source?.slides ?? null) as SlideWords[] | null
        if (saved) setSlides(saved.map((x) => ({ ...x })))
      }
      setV((n) => n + 1)
      onChanged()
    }
    return r.ok
  }
  // The words on screen take the post as saved after a revision.
  function take(next: Post) {
    setCaption(next.caption)
    setHeadline(next.headline)
    setSubline(next.subline)
    setKicker(next.kicker)
    setSlides(((next.source?.slides ?? []) as SlideWords[]).map((x) => ({ ...x })))
  }
  async function revise(undo = false) {
    if (!undo && !steer.trim()) return
    // Unsaved edits are saved first, so the revision starts from them.
    if (dirty && !(await patch(words()))) return
    setRevising(undo ? 'undo' : 'revise')
    setReviseErr('')
    setNotes([])
    const r = await fetch(`/api/marketing/content/${post.id}/revise`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(undo ? { undo: true } : { instruction: steer.trim() }) })
    const j = await r.json().catch(() => ({}))
    setRevising(null)
    if (!r.ok || !j?.post) {
      setReviseErr(j?.error || 'The post could not be revised.')
      return
    }
    take(j.post as Post)
    setNotes(Array.isArray(j.notes) ? j.notes : [])
    if (!undo) setSteer('')
    setV((n) => n + 1)
    onChanged()
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
    if (dirty && !(await patch(words()))) return
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
            <img src={`${image}&slide=${slide + 1}`} alt={`Slide ${slide + 1} of ${slideCount}`} width={1080} height={1350} className="w-full h-auto block" style={{ aspectRatio: '1080 / 1350', background: styleOf(post.source) === 'light' ? '#FFFFFF' : '#0A0F1D' }} />
            <div className="flex items-center gap-2 mt-3">
              <button type="button" className="ws-btn ws-btn-sm" disabled={slide === 0} onClick={() => setSlide((n) => n - 1)} aria-label="Previous slide"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="text-[12.5px] tabular flex-1 text-center" style={{ color: 'var(--fg-3)' }}>{`${slideNames[slide] ?? ''} · ${slide + 1} of ${slideCount}`}</span>
              <button type="button" className="ws-btn ws-btn-sm" disabled={slide >= slideCount - 1} onClick={() => setSlide((n) => n + 1)} aria-label="Next slide"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
            <StyleBar post={post} onChanged={() => { setSlide(0); onChanged() }} />
            <div className="flex items-center gap-2 mt-2">
              <a href={`/api/marketing/content/${post.id}/carousel?format=png`} className="ws-btn ws-btn-primary ws-btn-sm flex-1 justify-center" title="Every slide as a 1080 × 1350 PNG, in one zip, to upload as the images of a post yourself"><Download className="w-3.5 h-3.5" /> Download images</a>
              <a href={`/api/marketing/content/${post.id}/carousel`} className="ws-btn ws-btn-sm" title="Every slide as one PDF: what LinkedIn's Add a document takes as a carousel"><FileText className="w-3.5 h-3.5" /> PDF</a>
              <a href={`${image}&slide=${slide + 1}&download=1`} className="ws-btn ws-btn-sm" title="This slide on its own, as a PNG"><Download className="w-3.5 h-3.5" /></a>
            </div>
            {post.source?.dropped?.length ? (
              <p className="text-[11.5px] mt-2" style={{ color: 'var(--fg-4)' }}>{`Left out, as not in the briefing word for word: ${post.source.dropped.join('; ')}.`}</p>
            ) : null}
          </div>
        ) : (
          <div className="p-4" style={{ background: 'var(--surface-2)', borderRight: '1px solid var(--line)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" width={1080} height={1080} className="w-full h-auto block" style={{ aspectRatio: '1 / 1', background: styleOf(post.source) === 'light' ? '#FFFFFF' : '#0A0F1D' }} />
            <StyleBar post={post} onChanged={onChanged} />
            <div className="flex items-center gap-2 mt-2">
              <a href={`${image}&download=1`} className="ws-btn ws-btn-sm flex-1 justify-center" title="1080 × 1080 PNG"><Download className="w-3.5 h-3.5" /> Save the image</a>
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
          {carousel && slides[slide] && (
            <SlideEditor slide={slides[slide]} name={`${slideNames[slide] ?? 'Slide'} · slide ${slide + 1}`} onChange={(next) => setSlides((all) => all.map((x, i) => (i === slide ? next : x)))} />
          )}
          <div className={cn('grid sm:grid-cols-[1fr_2fr] gap-2', carousel && 'hidden')}>
            <input className="ws-input" value={kicker} onChange={(e) => setKicker(e.target.value)} placeholder="Kicker" aria-label="Kicker" />
            <input className="ws-input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" aria-label="Headline" />
            <input className="ws-input sm:col-span-2" value={subline} onChange={(e) => setSubline(e.target.value)} placeholder="Subline" aria-label="Subline" />
          </div>
          <textarea className="ws-input" rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Caption" style={{ resize: 'vertical', lineHeight: 1.5 }} />
          <p className="text-[12.5px] break-words" style={{ color: 'var(--accent-ink)' }}>{post.hashtags.join(' ')}</p>

          {/* Revise with Claude: the team's instruction, the post rewritten and drawn again. */}
          <div className="flex flex-col gap-2 rounded-md p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <label htmlFor={`steer-${post.id}`} className="text-[12.5px] font-medium flex items-center gap-1.5" style={{ color: 'var(--fg-2)' }}><Sparkles className="w-3.5 h-3.5" /> Revise with Claude</label>
            <textarea
              id={`steer-${post.id}`}
              className="ws-input"
              rows={2}
              value={steer}
              onChange={(e) => setSteer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) revise() }}
              placeholder={carousel ? 'What to change, e.g. "End on what NHS buyers should check before they buy" or "Lead with the 461 trials"' : 'What to change, e.g. "Mention that early-bird passes close on 30 November" or "Make the headline about the NHS"'}
              disabled={revising !== null}
              style={{ resize: 'vertical', lineHeight: 1.45 }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => revise()} disabled={!steer.trim() || revising !== null} className="ws-btn ws-btn-primary ws-btn-sm">
                {revising === 'revise' ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Revising…</> : <><Sparkles className="w-3.5 h-3.5" /> Revise</>}
              </button>
              {post.source?.before ? (
                <button type="button" onClick={() => revise(true)} disabled={revising !== null} className="ws-btn ws-btn-ghost ws-btn-sm" title="Back to the words before the last revision">
                  <Undo2 className="w-3.5 h-3.5" /> {revising === 'undo' ? 'Undoing…' : 'Undo last revision'}
                </button>
              ) : null}
              <span className="text-[11.5px]" style={{ color: 'var(--fg-4)' }}>Facts you give here are used as written; everything else stays true to the source{carousel ? ', and figures are checked against the briefing' : ''}.</span>
            </div>
            {reviseErr && <p className="text-[12.5px]" style={{ color: 'var(--bad)' }}>{reviseErr}</p>}
            {notes.length > 0 && <p className="text-[12px]" style={{ color: 'var(--fg-3)' }}>{`Revised. Note: ${notes.join('; ')}.`}</p>}
            {post.source?.steers?.length ? (
              <p className="text-[11.5px]" style={{ color: 'var(--fg-4)' }} title={post.source.steers.map((x) => x.text).join('\n')}>{`Last instruction: "${post.source.steers[post.source.steers.length - 1].text}"`}</p>
            ) : null}
          </div>
          {post.link && <p className="text-[12px] truncate" style={{ color: 'var(--fg-4)' }}>Points to {post.link}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {dirty ? (
              <button type="button" onClick={() => patch(words())} disabled={saving} className="ws-btn ws-btn-primary ws-btn-sm">{saving ? 'Saving…' : 'Save changes'}</button>
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
                  title={liPage ? `Puts it up on ${liPage.name} now` : li?.connected ? 'Choose this brand’s LinkedIn page at the top of the tab first' : 'Connect LinkedIn at the top of the tab first'}
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
