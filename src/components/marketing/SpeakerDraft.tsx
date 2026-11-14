'use client'

// A speaker's welcome post, drafted for review: the card as it will look,
// the caption (editable), a box to ask for a change, and "Approve and post
// to LinkedIn". The draft is an ordinary Content post (kind speaker, ref the
// speaker's line-up id), so it also shows in the Content tab; posting it
// ticks the speaker off here (api/marketing/content/<id>/linkedin).

import { useState } from 'react'
import { Loader2, Send, Sparkles, RefreshCw, Trash2 } from 'lucide-react'
import { Modal } from '@/components/workspace/ui'
import type { ContentPost } from '@/lib/contentStudio'

export function SpeakerDraftModal({
  name, post, busy, onClose, onRedraft, onDelete, onChanged, onPosted,
}: {
  name: string
  post: ContentPost
  busy: boolean
  onClose: () => void
  onRedraft: () => void
  onDelete: () => void
  onChanged: (p: ContentPost) => void
  onPosted: (url: string) => void
}) {
  const [caption, setCaption] = useState(post.caption)
  const [ask, setAsk] = useState('')
  const [working, setWorking] = useState<'' | 'save' | 'revise' | 'post'>('')
  const [error, setError] = useState('')
  const posted = post.status === 'posted'
  const img = `/api/marketing/content/${post.id}/image?v=${encodeURIComponent(post.updatedAt)}`

  const saveCaption = async () => {
    if (caption.trim() === post.caption.trim()) return true
    setWorking('save')
    const r = await fetch(`/api/marketing/content/${post.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption }) })
    const j = await r.json().catch(() => ({}))
    setWorking('')
    if (!r.ok) { setError(j?.error || 'The caption did not save.'); return false }
    if (j?.post) onChanged(j.post)
    return true
  }

  const revise = async () => {
    if (!ask.trim()) return
    setWorking('revise')
    setError('')
    const r = await fetch(`/api/marketing/content/${post.id}/revise`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction: ask.trim() }) })
    const j = await r.json().catch(() => ({}))
    setWorking('')
    if (!r.ok || !j?.post) { setError(j?.error || 'That change could not be made.'); return }
    setAsk('')
    setCaption(j.post.caption)
    onChanged(j.post)
  }

  const approve = async () => {
    setError('')
    if (!(await saveCaption())) return
    setWorking('post')
    const r = await fetch(`/api/marketing/content/${post.id}/linkedin`, { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    setWorking('')
    if (!r.ok) {
      setError(j?.reconnect ? `${j.error} Reconnect LinkedIn in the Content tab, then try again.` : j?.error || 'The post could not be put up.')
      return
    }
    onPosted(j.url)
  }

  const disabled = Boolean(working) || busy
  return (
    <Modal
      title={`Welcome post · ${name}`}
      subtitle={posted ? 'Already on LinkedIn.' : 'A draft: check it, change anything, then approve it to post on our LinkedIn page.'}
      onClose={onClose}
      width="max-w-xl"
      footer={
        posted ? (
          <>
            {post.postUrl && <a className="ws-btn" href={post.postUrl} target="_blank" rel="noreferrer">Open on LinkedIn</a>}
            <button className="ws-btn ws-btn-primary" onClick={onClose}>Done</button>
          </>
        ) : (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="ws-btn ws-btn-ghost justify-center sm:mr-auto" onClick={onDelete} disabled={disabled} title="Delete this draft" style={{ color: 'var(--bad)' }}>
              <Trash2 className="w-4 h-4" /> Delete draft
            </button>
            <button className="ws-btn justify-center" onClick={onRedraft} disabled={disabled} title="Throw this draft away and write a fresh one in a different design">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} New design
            </button>
            <button className="ws-btn ws-btn-primary justify-center" onClick={approve} disabled={disabled}>
              {working === 'post' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Approve and post to LinkedIn
            </button>
          </div>
        )
      }
    >
      <div className="grid gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={`The card for ${name}'s welcome post`} className="w-full rounded-lg" style={{ aspectRatio: '1 / 1', background: 'var(--surface-3)', border: '1px solid var(--line)' }} />
        <label className="block">
          <span className="ws-label">Caption</span>
          <textarea
            className="ws-input min-h-[160px] py-2 text-[14px] leading-relaxed"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={saveCaption}
            readOnly={posted}
          />
          {post.hashtags?.length > 0 && (
            <span className="block mt-1.5 text-[12.5px]" style={{ color: 'var(--accent-ink)' }}>{post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</span>
          )}
        </label>
        {!posted && (
          <div className="grid gap-1.5">
            <span className="ws-label">Ask for a change</span>
            <div className="flex gap-2">
              <input
                className="ws-input flex-1"
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') revise() }}
                placeholder="Shorter, mention their panel, warmer tone…"
                disabled={disabled}
              />
              <button className="ws-btn shrink-0" onClick={revise} disabled={disabled || !ask.trim()}>
                {working === 'revise' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Change
              </button>
            </div>
          </div>
        )}
        {working === 'save' && <p className="text-[12.5px]" style={{ color: 'var(--fg-4)' }}>Saving the caption…</p>}
        {error && <p className="text-[13px]" style={{ color: 'var(--bad)' }}>{error}</p>}
      </div>
    </Modal>
  )
}
