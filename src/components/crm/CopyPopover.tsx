'use client'

// A contact's email addresses or phone numbers in a small pop-up, each with
// a Copy button, instead of a mailto:/tel: link (which opens whatever mail
// app the computer is set to, often not the one the team uses).

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

// "a@x.com or b@y.com" / "a@x.com; b@y.com" → each address on its own.
export function splitValues(raw: string): string[] {
  return raw.split(/\s+or\s+|[,;/]\s*|\s+and\s+/i).map((v) => v.trim()).filter(Boolean)
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers, or a page not allowed the clipboard API.
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  }
}

export function CopyPopover({ label, value, children, title }: { label: string; value: string; children: React.ReactNode; title?: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const values = splitValues(value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const copy = async (v: string) => {
    if (await copyText(v)) {
      setCopied(v)
      setTimeout(() => setCopied((c) => (c === v ? null : c)), 1600)
    }
  }

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="ws-btn ws-btn-ghost ws-btn-sm"
        title={title ?? value}
        aria-label={title ?? label}
        aria-expanded={open}
      >
        {children}
      </button>
      {open && (
        <span
          role="dialog"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1.5 z-30 w-[300px] max-w-[80vw] p-2 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', boxShadow: 'var(--shadow-md)' }}
        >
          <span className="block px-2 pt-1 pb-1.5 text-[11px] font-medium" style={{ color: 'var(--fg-4)' }}>{label}</span>
          {values.map((v) => (
            <span key={v} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--surface-2)]">
              <span className="flex-1 min-w-0 text-[13px] select-all break-all" style={{ color: 'var(--fg)' }}>{v}</span>
              <button type="button" onClick={() => copy(v)} className="ws-btn ws-btn-sm shrink-0" aria-label={`Copy ${v}`}>
                {copied === v ? <><Check className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
