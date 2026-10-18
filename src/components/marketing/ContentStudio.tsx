'use client'

// The Content tab: a LinkedIn post a day for the edition, drafted from
// what the group already holds about it (an Insights briefing, a session,
// a speaker, a sponsor, the countdown), as an image in the brand's look
// and a caption in its voice. Each card can be drawn in twenty looks
// (contentBrand) and shuffled between them, or chosen from the look
// gallery, which draws the post in every one. The team
// reads it, changes what it likes, copies the caption or posts it straight
// to LinkedIn, and marks it posted.

import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, BarChart3, Bookmark, CaseUpper, Check, ChevronDown, ChevronLeft, ChevronRight, Columns2, Copy, MessageSquare, MousePointerClick, Download, Droplet, ExternalLink, Film, Frame, Image as ImageIcon, LayoutGrid, Layers, Linkedin, Milestone, Moon, Newspaper, PenLine, RefreshCw, Send, Shuffle, Sparkles, Square, SquareSplitVertical, StickyNote, Sun, Target, Trash2, Triangle, Undo2, Waves } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, Field, Segmented, Stat } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { LogPostModal, Notice, Tone, useEdition } from './shared'
import { LookGallery } from './LookGallery'
import { BRANDS, CARD_STYLES, brandFor, photosFor, styleOf, stylesFor, type BrandKey, type CardStyle } from '@/lib/contentBrand'

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
  source: { style?: CardStyle; photo?: string; photos?: string[]; image?: string; logo?: string; format?: 'carousel'; pages?: 'carousel' | 'two-page'; by?: string; slides?: { kind: string }[]; dropped?: string[]; before?: unknown; steers?: { text: string; at: string; changed?: string[]; notes?: string[]; reply?: string }[]; linkedin?: { state?: string; page?: string }; publishers?: string[] } & Record<string, unknown>
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
  // A post just moved to another page, said once at the top of the list.
  const [moved, setMoved] = useState('')
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

          {moved && (
            <div className="ws-card px-4 py-3 mb-3 flex items-start gap-3 text-[13px]" style={{ color: 'var(--fg-2)' }}>
              <ArrowRightLeft className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--accent-ink)' }} />
              <span className="flex-1">{moved}</span>
              <button type="button" onClick={() => setMoved('')} className="ws-btn ws-btn-ghost ws-btn-sm">Dismiss</button>
            </div>
          )}

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
                  onMoved={setMoved}
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

// A PNG's file name: the page, the post's headline (shortened between
// words) and, for a slide, its place in the carousel; always ending .png.
function pngName(post: Post, slide: { n: number; of: number; name?: string } | null): string {
  const words = post.headline.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
  const short = words.length > 70 ? words.slice(0, 70).replace(/\s+\S*$/, '') : words
  const brand = BRANDS[brandFor(post.series)].name
  return `${brand} - ${short || 'post'}${slide ? ` - ${String(slide.n).padStart(2, '0')} of ${slide.of}${slide.name ? ` ${slide.name}` : ''}` : ''}.png`
}

const PAGES: BrandKey[] = ['pharma', 'health', 'nexus']

// Where the team clicked on the picture, for Claude: a fraction of its
// width and height, on a slide (null for a single card).
type Spot = { x: number; y: number; slide: number | null; label: string }

// The picture as the team saw it, with the spot they clicked ringed in
// red, as a JPEG for Claude to look at.
async function markedPicture(url: string, spot: Spot): Promise<string> {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error('The picture could not be drawn.')
  const bitmap = await createImageBitmap(await r.blob())
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const c = canvas.getContext('2d')!
  c.drawImage(bitmap, 0, 0)
  const x = spot.x * bitmap.width
  const y = spot.y * bitmap.height
  const r0 = Math.round(bitmap.width * 0.045)
  c.lineWidth = 12
  c.strokeStyle = '#FFFFFF'
  c.beginPath(); c.arc(x, y, r0 + 6, 0, Math.PI * 2); c.stroke()
  c.lineWidth = 8
  c.strokeStyle = '#FF1F1F'
  c.beginPath(); c.arc(x, y, r0, 0, Math.PI * 2); c.stroke()
  return canvas.toDataURL('image/jpeg', 0.85)
}

// The ring on the picture where the team clicked, until it is sent.
function SpotRing({ spot }: { spot: Spot }) {
  return (
    <span className="pointer-events-none absolute" style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, width: 28, height: 28, marginLeft: -14, marginTop: -14, borderRadius: 999, border: '3px solid #FF1F1F', boxShadow: '0 0 0 2px #FFFFFF' }} />
  )
}

// Over the image on hover: anything on it can be clicked to ask for a change.
function ClickHint() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0) 40%)' }}>
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium" style={{ background: 'rgba(255,255,255,0.92)', color: '#0B0C10' }}>
        <MousePointerClick className="w-3.5 h-3.5" /> Click anything to change it
      </span>
    </span>
  )
}


// Moving a post to another page: Claude rewrites it for that page's
// readers and files it there as a draft (api/marketing/content/<id>/move).
function MovePanel({ post, onDone, onClose }: { post: Post; onDone: (message: string, removed: boolean) => void; onClose: () => void }) {
  const from = brandFor(post.series)
  const pages = PAGES.filter((b) => b !== from)
  const [to, setTo] = useState<BrandKey>(pages[0])
  const [keep, setKeep] = useState(post.status === 'posted')
  const [note, setNote] = useState('')
  const [moving, setMoving] = useState(false)
  const [err, setErr] = useState('')
  async function move() {
    setMoving(true)
    setErr('')
    const r = await fetch(`/api/marketing/content/${post.id}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, keep, note: note.trim() || null }) })
    const j = await r.json().catch(() => ({}))
    setMoving(false)
    if (!r.ok) {
      setErr(j?.error || 'The post could not be moved.')
      return
    }
    const notes: string[] = Array.isArray(j.notes) ? j.notes : []
    onDone(
      `"${j.post?.headline || post.headline}" is now a draft on ${j.edition}, rewritten for ${BRANDS[to].name}${j.removed ? ', and it has gone from here' : ', and the original is still here'}. Switch to ${j.edition} to see it.${notes.length ? ` Note: ${notes.join('; ')}.` : ''}`,
      Boolean(j.removed),
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-md p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
      <span className="text-[12.5px] font-medium flex items-center gap-1.5" style={{ color: 'var(--fg-2)' }}><ArrowRightLeft className="w-3.5 h-3.5" /> Move to another page</span>
      <Segmented size="sm" value={to} onChange={setTo} options={pages.map((b) => ({ value: b, label: BRANDS[b].name }))} />
      <input className="ws-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Anything to steer it for ${BRANDS[to].name} (optional), e.g. "Lead with what it means for pharma R&D"`} aria-label="Steer for the new page" disabled={moving} />
      <label className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--fg-3)' }}>
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} disabled={moving || post.status === 'posted'} />
        {post.status === 'posted' ? 'This one was posted, so it stays here too' : `Keep it on ${BRANDS[from].name} as well`}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={move} disabled={moving} className="ws-btn ws-btn-primary ws-btn-sm">
          {moving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Rewriting for {BRANDS[to].name}…</> : <><ArrowRightLeft className="w-3.5 h-3.5" /> {keep ? 'Copy' : 'Move'} to {BRANDS[to].name}</>}
        </button>
        <button type="button" onClick={onClose} disabled={moving} className="ws-btn ws-btn-ghost ws-btn-sm">Cancel</button>
        <span className="text-[11.5px]" style={{ color: 'var(--fg-4)' }}>Rewritten for that page’s readers from the same source, filed under its next edition as a draft.</span>
      </div>
      {err && <p className="text-[12.5px]" style={{ color: 'var(--bad)' }}>{err}</p>}
    </div>
  )
}

function PostCard({ post, onChanged, onMoved, onRegenerate, busy }: { post: Post; onChanged: () => void; onMoved: (message: string) => void; onRegenerate: () => void; busy: boolean }) {
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
  // What the next instruction is about: a slide or a part of the post,
  // chosen by clicking it; none for the whole post.
  const [target, setTarget] = useState<Spot | null>(null)
  // The words by hand, folded away: the chat is the way in.
  const [byHand, setByHand] = useState(false)
  const [asked, setAsked] = useState('')
  const chat = useRef<HTMLTextAreaElement>(null)
  const [moving, setMoving] = useState(false)
  const [saving_, setSaving_] = useState<'one' | 'all' | null>(null)
  const [saveErr, setSaveErr] = useState('')
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
    const instruction = target ? `${target.label}, at the spot clicked: ${steer.trim()}` : steer.trim()
    setAsked(undo ? 'Undo the last change' : instruction)
    // The picture with the click ringed, so Claude sees what was meant.
    let picture: string | null = null
    if (!undo && target) {
      try {
        picture = await markedPicture(target.slide === null ? image : `${image}&slide=${target.slide + 1}`, target)
      } catch {
        picture = null
      }
    }
    const r = await fetch(`/api/marketing/content/${post.id}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(undo ? { undo: true } : { instruction, picture, where: target?.label ?? null }),
    })
    const j = await r.json().catch(() => ({}))
    setRevising(null)
    setAsked('')
    if (!r.ok || !j?.post) {
      setReviseErr(j?.error || 'The post could not be revised.')
      return
    }
    take(j.post as Post)
    setNotes(Array.isArray(j.notes) ? j.notes : [])
    if (!undo) {
      setSteer('')
      setTarget(null)
    }
    setV((n) => n + 1)
    onChanged()
  }
  // A click on the picture: the spot is ringed and the chat is ready to type.
  function point(e: React.MouseEvent<HTMLElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    const y = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height))
    setTarget({ x, y, slide: carousel ? slide : null, label: carousel ? `On slide ${slide + 1} (${slideNames[slide] ?? 'slide'})` : 'On the image' })
    setTimeout(() => {
      chat.current?.focus()
      chat.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 0)
  }
  // The images saved as PNG files, named here so the name always ends in
  // .png and the file opens anywhere.
  async function saveImages(slides: (number | null)[]) {
    setSaveErr('')
    for (const n of slides) {
      const r = await fetch(n === null ? image : `${image}&slide=${n + 1}`, { cache: 'no-store' })
      const blob = await r.blob()
      if (!r.ok || blob.type !== 'image/png') {
        setSaveErr('The image could not be drawn just now. Try again.')
        return
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = pngName(post, n === null ? null : { n: n + 1, of: slideCount, name: slideNames[n] })
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      // A moment between files, so the browser takes each one.
      if (slides.length > 1) await new Promise((done) => setTimeout(done, 400))
    }
  }
  async function saveOne(n: number | null) {
    setSaving_('one')
    await saveImages([n]).catch(() => setSaveErr('The image could not be saved. Try again.'))
    setSaving_(null)
  }
  async function saveAll() {
    setSaving_('all')
    await saveImages(Array.from({ length: slideCount }, (_, i) => i)).catch(() => setSaveErr('The images could not be saved. Try again.'))
    setSaving_(null)
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
            <button type="button" onClick={point} className="group relative block w-full p-0 border-0 bg-transparent cursor-crosshair" title="Click anything on the slide to ask Claude to change it">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${image}&slide=${slide + 1}`} alt={`Slide ${slide + 1} of ${slideCount}`} width={1080} height={1350} className="w-full h-auto block" style={{ aspectRatio: '1080 / 1350', background: styleOf(post.source) === 'light' ? '#FFFFFF' : '#0A0F1D' }} />
              <ClickHint />
              {target && target.slide === slide ? <SpotRing spot={target} /> : null}
            </button>
            <div className="flex items-center gap-2 mt-3">
              <button type="button" className="ws-btn ws-btn-sm" disabled={slide === 0} onClick={() => setSlide((n) => n - 1)} aria-label="Previous slide"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="text-[12.5px] tabular flex-1 text-center" style={{ color: 'var(--fg-3)' }}>{`${slideNames[slide] ?? ''} · ${slide + 1} of ${slideCount}`}</span>
              <button type="button" className="ws-btn ws-btn-sm" disabled={slide >= slideCount - 1} onClick={() => setSlide((n) => n + 1)} aria-label="Next slide"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
            <StyleBar post={post} onChanged={() => { setSlide(0); onChanged() }} />
            <div className="flex items-center gap-2 mt-2">
              <button type="button" onClick={saveAll} disabled={saving_ !== null} className="ws-btn ws-btn-primary ws-btn-sm flex-1 justify-center" title="Every slide as its own 1080 × 1350 PNG image">
                {saving_ === 'all' ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving {slideCount} images…</> : <><Download className="w-3.5 h-3.5" /> Download all {slideCount} images</>}
              </button>
              <button type="button" onClick={() => saveOne(slide)} disabled={saving_ !== null} className="ws-btn ws-btn-sm" title="This slide on its own, as a PNG image">
                {saving_ === 'one' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} This slide
              </button>
            </div>
            {saveErr && <p className="text-[12px] mt-2" style={{ color: 'var(--bad)' }}>{saveErr}</p>}
            {post.source?.dropped?.length ? (
              <p className="text-[11.5px] mt-2" style={{ color: 'var(--fg-4)' }}>{`Left out, as not in the briefing word for word: ${post.source.dropped.join('; ')}.`}</p>
            ) : null}
          </div>
        ) : (
          <div className="p-4" style={{ background: 'var(--surface-2)', borderRight: '1px solid var(--line)' }}>
            <button type="button" onClick={point} className="group relative block w-full p-0 border-0 bg-transparent cursor-crosshair" title="Click anything on the image to ask Claude to change it">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" width={1080} height={1080} className="w-full h-auto block" style={{ aspectRatio: '1 / 1', background: styleOf(post.source) === 'light' ? '#FFFFFF' : '#0A0F1D' }} />
              <ClickHint />
              {target ? <SpotRing spot={target} /> : null}
            </button>
            <StyleBar post={post} onChanged={onChanged} />
            <div className="flex items-center gap-2 mt-2">
              <button type="button" onClick={() => saveOne(null)} disabled={saving_ !== null} className="ws-btn ws-btn-sm flex-1 justify-center" title="1080 × 1080 PNG image">
                {saving_ === 'one' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Save the image
              </button>
            </div>
            {saveErr && <p className="text-[12px] mt-2" style={{ color: 'var(--bad)' }}>{saveErr}</p>}
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
              <button type="button" onClick={() => setMoving((m) => !m)} className="ws-btn ws-btn-ghost ws-btn-sm" title="Rewrite it for another page (World Pharma AI, World Health AI or World Nexus Group) and move it there"><ArrowRightLeft className="w-3.5 h-3.5" /> Move</button>
              <button type="button" onClick={onRegenerate} disabled={busy} className="ws-btn ws-btn-ghost ws-btn-sm" title="Write it again from the same material"><RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} /> Again</button>
              <button type="button" onClick={remove} className="ws-btn ws-btn-ghost ws-btn-sm" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
            </span>
          </div>

          {moving && (
            <MovePanel
              post={post}
              onClose={() => setMoving(false)}
              onDone={(message) => { setMoving(false); onMoved(message); onChanged() }}
            />
          )}
          {post.source?.movedFrom ? <p className="text-[11.5px]" style={{ color: 'var(--fg-4)' }}>{`Moved here from ${(post.source.movedFrom as { edition?: string }).edition ?? 'another page'}.`}</p> : null}
          {carousel && <Tone tone="muted">{post.source?.pages === 'two-page' ? 'Two-page post' : 'Carousel'}</Tone>}
          <button type="button" onClick={() => setByHand((b) => !b)} className="self-start text-[12px] hover:underline underline-offset-4" style={{ color: 'var(--fg-3)' }}>
            {byHand ? 'Hide the words on the image' : 'Edit the words on the image by hand'}
          </button>
          {byHand && carousel && slides[slide] && (
            <SlideEditor slide={slides[slide]} name={`${slideNames[slide] ?? 'Slide'} · slide ${slide + 1}`} onChange={(next) => setSlides((all) => all.map((x, i) => (i === slide ? next : x)))} />
          )}
          <div className={cn('grid sm:grid-cols-[1fr_2fr] gap-2', (carousel || !byHand) && 'hidden')}>
            <input className="ws-input" value={kicker} onChange={(e) => setKicker(e.target.value)} placeholder="Kicker" aria-label="Kicker" />
            <input className="ws-input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" aria-label="Headline" />
            <input className="ws-input sm:col-span-2" value={subline} onChange={(e) => setSubline(e.target.value)} placeholder="Subline" aria-label="Subline" />
          </div>
          <textarea className="ws-input" rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Caption" style={{ resize: 'vertical', lineHeight: 1.5 }} />
          <p className="text-[12.5px] break-words" style={{ color: 'var(--accent-ink)' }}>{post.hashtags.join(' ')}</p>

          {/* Ask Claude: the team's instructions and what came of them, as a thread; the post is rewritten and drawn again. */}
          <div className="flex flex-col gap-2 rounded-md p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <span className="text-[12.5px] font-medium flex items-center gap-1.5" style={{ color: 'var(--fg-2)' }}><MessageSquare className="w-3.5 h-3.5" /> Ask Claude to change this post</span>
            {(post.source?.steers ?? []).slice(-6).map((x, i) => (
              <div key={`${x.at}-${i}`} className="flex flex-col gap-1">
                <p className="self-end max-w-[85%] rounded-lg px-3 py-1.5 text-[12.5px]" style={{ background: 'var(--accent-soft)', color: 'var(--fg)' }}>{x.text}</p>
                <p className="self-start max-w-[85%] rounded-lg px-3 py-1.5 text-[12.5px]" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--fg-2)' }}>
                  {x.reply || (x.changed === undefined ? 'Done.' : x.changed.length ? `Changed ${x.changed.join(', ')}.` : 'Nothing needed changing.')}
                  {x.notes?.length ? <span style={{ color: 'var(--fg-4)' }}>{` Note: ${x.notes.join('; ')}.`}</span> : null}
                </p>
              </div>
            ))}
            {revising && (
              <div className="flex flex-col gap-1">
                <p className="self-end max-w-[85%] rounded-lg px-3 py-1.5 text-[12.5px]" style={{ background: 'var(--accent-soft)', color: 'var(--fg)' }}>{asked}</p>
                <p className="self-start rounded-lg px-3 py-1.5 text-[12.5px] flex items-center gap-1.5" style={{ border: '1px solid var(--line)', color: 'var(--fg-3)' }}><RefreshCw className="w-3 h-3 animate-spin" /> {revising === 'undo' ? 'Putting it back…' : 'Rewriting and redrawing…'}</p>
              </div>
            )}
            {target && (
              <span className="self-start inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px]" style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', color: 'var(--fg-2)' }}>
                <MousePointerClick className="w-3 h-3" /> {`${target.label}: the spot you clicked`}
                <button type="button" onClick={() => setTarget(null)} aria-label="Clear the click and change the whole post instead" className="ml-0.5" style={{ color: 'var(--fg-4)' }}>×</button>
              </span>
            )}
            <textarea
              ref={chat}
              className="ws-input"
              rows={2}
              value={steer}
              onChange={(e) => setSteer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); revise() } }}
              placeholder={target ? 'What should change there? e.g. "Write the figure in full", "Use a different photo", "Make this about NHS buyers"' : carousel ? 'Click anything on the slide, then say what to change. Or just type, e.g. "End on what NHS buyers should check before they buy"' : 'Click anything on the image, then say what to change. Or just type, e.g. "Mention that early-bird passes close on 30 November"'}
              disabled={revising !== null}
              style={{ resize: 'vertical', lineHeight: 1.45 }}
              aria-label="What to change"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => revise()} disabled={!steer.trim() || revising !== null} className="ws-btn ws-btn-primary ws-btn-sm">
                <Sparkles className="w-3.5 h-3.5" /> Change it
              </button>
              {post.source?.before ? (
                <button type="button" onClick={() => revise(true)} disabled={revising !== null} className="ws-btn ws-btn-ghost ws-btn-sm" title="Back to the words before the last change">
                  <Undo2 className="w-3.5 h-3.5" /> Undo last change
                </button>
              ) : null}
              <span className="text-[11.5px]" style={{ color: 'var(--fg-4)' }}>Enter to send. Facts you give are used as written; everything else stays true to the source{carousel ? ', and figures are checked against the briefing' : ''}.</span>
            </div>
            {reviseErr && <p className="text-[12.5px]" style={{ color: 'var(--bad)' }}>{reviseErr}</p>}
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
