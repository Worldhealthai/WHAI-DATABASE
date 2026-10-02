'use client'

// The Content tab: a LinkedIn post a day for the edition, drafted from
// what the group already holds about it (an Insights briefing, a session,
// a speaker, a sponsor, the countdown), as an image in the brand's look
// and a caption in its voice. The team reads it, changes what it likes,
// copies the caption, saves the image, and marks it posted.

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, PenLine, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, Field, Segmented, Stat } from '@/components/workspace/ui'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { LogPostModal, Notice, Tone, useEdition } from './shared'

type Kind = 'insight' | 'session' | 'speaker' | 'theme' | 'countdown' | 'sponsor'
type Pick = 'auto' | Kind

// As lib/contentStudio.ts has them; listed here so the page needs nothing server-side.
const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: 'insight', label: 'Insight', hint: 'A published Insights briefing' },
  { value: 'session', label: 'Session', hint: 'A session on the agenda and its questions' },
  { value: 'speaker', label: 'Speaker', hint: 'A confirmed speaker who agreed to a post' },
  { value: 'theme', label: 'Theme', hint: 'A topic the agenda raises' },
  { value: 'countdown', label: 'Countdown', hint: 'Days to go, and booking' },
  { value: 'sponsor', label: 'Sponsor', hint: 'A sponsor on the line-up' },
]
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k

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
  brief: string | null
  status: 'draft' | 'posted'
  postUrl: string | null
  postedAt: string | null
  createdAt: string
  updatedAt: string
}

const fmtDay = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'No day set'

export function ContentStudio() {
  const ed = useEdition()
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

  async function generate(opts: { kind?: Pick; brief?: string; forDate?: string } = {}) {
    if (!ed) return
    setBusy(true)
    setError('')
    const kind = opts.kind ?? pick
    const r = await fetch('/api/marketing/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ed, kind: kind === 'auto' ? null : kind, brief: opts.brief ?? brief, forDate: opts.forDate ?? forDate ?? null }),
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
      description="A LinkedIn post a day for this edition: an image in the event's own look and a caption in its voice, drawn from the Insights desk, the agenda, the line-up and the countdown."
    >
      {q.data?.error ? (
        <Notice message={q.data.error} tone={migration ? 'warn' : 'bad'} />
      ) : (
        <>
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
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="What it is about" hint="Choose for me rotates through the kinds, skipping what the last posts used.">
                <select className="ws-input" value={pick} onChange={(e) => setPick(e.target.value as Pick)}>
                  <option value="auto">Choose for me</option>
                  {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}: {k.hint}</option>)}
                </select>
              </Field>
              <Field label="Planned for" hint="Left blank, the next day with nothing planned.">
                <input className="ws-input" type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} />
              </Field>
              <Field label="Any steer (optional)" span hint="A line for the writer: an angle, a person to mention, something to leave out.">
                <input className="ws-input" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. Lead with the NHS angle; mention the early-bird rate ends Friday" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button type="button" onClick={() => generate()} disabled={busy || !ed} className="ws-btn ws-btn-primary">
                {busy ? <><RefreshCw className="w-4 h-4 animate-spin" /> Writing…</> : 'Draft the post'}
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
                <PostCard key={p.id} post={p} onChanged={refresh} onRegenerate={() => generate({ kind: p.kind, brief: p.brief ?? '', forDate: p.forDate ?? '' })} busy={busy} />
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
  async function remove() {
    if (!confirm('Delete this draft?')) return
    const r = await fetch(`/api/marketing/content/${post.id}`, { method: 'DELETE' })
    if (r.ok) onChanged()
  }

  return (
    <div className="ws-card overflow-hidden">
      <div className="grid md:grid-cols-[300px_1fr]">
        {/* The image */}
        <div className="p-4" style={{ background: 'var(--surface-2)', borderRight: '1px solid var(--line)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" width={1080} height={1080} className="w-full h-auto block" style={{ aspectRatio: '1 / 1', background: '#0A0F1D' }} />
          <div className="flex items-center gap-2 mt-3">
            <a href={`${image}&download=1`} className="ws-btn ws-btn-sm"><Download className="w-3.5 h-3.5" /> Save image</a>
            <span className="text-[11.5px]" style={{ color: 'var(--fg-4)' }}>1080 × 1080</span>
          </div>
        </div>

        {/* The words */}
        <div className="p-4 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Tone tone={post.status === 'posted' ? 'ok' : 'accent'}>{post.status === 'posted' ? 'Posted' : 'Draft'}</Tone>
            <Tone tone="muted">{kindLabel(post.kind)}</Tone>
            <span className="text-[12.5px]" style={{ color: 'var(--fg-3)' }}>{fmtDay(post.forDate)}</span>
            {post.postUrl && <a href={post.postUrl} target="_blank" rel="noreferrer" className="text-[12.5px] hover:underline underline-offset-4" style={{ color: 'var(--accent-ink)' }}>View the post</a>}
            <span className="ml-auto flex items-center gap-1">
              <button type="button" onClick={onRegenerate} disabled={busy} className="ws-btn ws-btn-ghost ws-btn-sm" title="Write it again from the same material"><RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} /> Again</button>
              <button type="button" onClick={remove} className="ws-btn ws-btn-ghost ws-btn-sm" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
            </span>
          </div>

          <div className="grid sm:grid-cols-[1fr_2fr] gap-2">
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
              <button type="button" onClick={() => setLogging(true)} className="ws-btn ws-btn-ghost ws-btn-sm">Mark as posted</button>
            )}
          </div>
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
