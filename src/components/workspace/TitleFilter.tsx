'use client'

// The job title filter, in the way of a research database: type a word
// ("chief") and it offers every job title in the list that holds it, with
// how many people have each; add the word itself (every title containing
// it) or one exact title. Each choice is a chip; adding more widens the
// list (any chip matches). The counts follow the other filters.

import { useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

export interface TitleToken { kind: 'word' | 'title'; value: string }

export const tokenMatches = (job: string | null | undefined, t: TitleToken) => {
  const j = (job || '').trim().toLowerCase()
  return t.kind === 'word' ? j.includes(t.value.toLowerCase()) : j === t.value.toLowerCase()
}

export function TitleFilter({ titles, tokens, onChange }: {
  titles: { title: string; count: number }[]
  tokens: TitleToken[]
  onChange: (t: TitleToken[]) => void
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const q = text.trim().toLowerCase()

  // The word (everyone whose title contains it), then the matching titles,
  // most people first.
  const options = useMemo(() => {
    if (!q) return titles.slice(0, 12).map((t) => ({ token: { kind: 'title' as const, value: t.title }, count: t.count }))
    const hits = titles.filter((t) => t.title.toLowerCase().includes(q))
    const total = hits.reduce((n, t) => n + t.count, 0)
    return [
      { token: { kind: 'word' as const, value: text.trim() }, count: total },
      ...hits.slice(0, 14).map((t) => ({ token: { kind: 'title' as const, value: t.title }, count: t.count })),
    ]
  }, [q, text, titles])

  const add = (t: TitleToken) => {
    if (!tokens.some((x) => x.kind === t.kind && x.value.toLowerCase() === t.value.toLowerCase())) onChange([...tokens, t])
    setText(''); setHi(0); input.current?.focus()
  }
  const remove = (i: number) => onChange(tokens.filter((_, j) => j !== i))

  return (
    <div className="relative">
      <div className="ws-input !py-1 !px-2 flex flex-wrap items-center gap-1 min-w-[300px] max-w-[560px]" onClick={() => input.current?.focus()}>
        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--fg-4)' }} />
        {tokens.map((t, i) => (
          <span key={`${t.kind}:${t.value}`} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full text-[12px] font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
            {t.kind === 'word' ? <>contains &ldquo;{t.value}&rdquo;</> : t.value}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(i) }} aria-label={`Remove ${t.value}`} className="rounded-full p-0.5 hover:bg-[var(--surface)]"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input
          ref={input}
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); setHi(0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, options.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
            else if (e.key === 'Enter' && options[hi]) { e.preventDefault(); add(options[hi].token) }
            else if (e.key === 'Backspace' && !text && tokens.length) remove(tokens.length - 1)
            else if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={tokens.length ? 'Add another title…' : 'Job title: type e.g. chief, director…'}
          className="flex-1 min-w-[140px] bg-transparent outline-none text-[13px] py-1"
          aria-label="Filter by job title"
        />
      </div>
      {open && options.length > 0 && (
        <div className="crm-menu absolute left-0 top-[calc(100%+6px)] z-50 w-[380px] max-h-[340px] overflow-y-auto" role="listbox">
          {!q && <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-4)' }}>Most common titles</p>}
          {options.map((o, i) => (
            <button
              key={`${o.token.kind}:${o.token.value}`}
              type="button"
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); add(o.token) }}
              onMouseEnter={() => setHi(i)}
              className="crm-menu-item w-full justify-between"
              style={i === hi ? { background: 'var(--surface-2)' } : undefined}
            >
              <span className="truncate">
                {o.token.kind === 'word' ? <>Any title containing <strong>&ldquo;{o.token.value}&rdquo;</strong></> : o.token.value}
              </span>
              <span className="tabular text-[12px] shrink-0" style={{ color: 'var(--fg-4)' }}>{o.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
