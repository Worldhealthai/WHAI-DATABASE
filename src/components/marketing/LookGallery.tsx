'use client'

// The look gallery: the post (or a sample of its kind) drawn in every look
// it can take, laid out as a wall of cards to choose from. Opens over the
// page, rises in, and the cards come up one after another as they are
// drawn. Clicking one chooses it; Escape or the backdrop closes it.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Check, RefreshCw, Shuffle, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardStyle } from '@/lib/contentBrand'

export interface LookOption { value: CardStyle; label: string; hint: string; photos: number }

const subscribeNever = () => () => {}

export function LookGallery({
  title, subtitle, looks, icons, current, preview, portrait = false, rotate = false, busy = null, again = false, error = '', onPick, onClose,
}: {
  title: string
  subtitle?: string
  looks: LookOption[]
  icons: Record<CardStyle, LucideIcon>
  /** The look the post has now, or 'rotate' when the next in turn is chosen */
  current: CardStyle | 'rotate' | null
  /** The image of the post (or the sample) in a look */
  preview: (style: CardStyle) => string
  /** A carousel's cover: 1080 by 1350 */
  portrait?: boolean
  /** Offer "the next look in turn" as a choice of its own */
  rotate?: boolean
  /** The look being applied, while it is */
  busy?: CardStyle | 'rotate' | null
  /** The current look takes photos, so choosing it again takes other ones */
  again?: boolean
  error?: string
  onPick: (style: CardStyle | 'rotate') => void
  onClose: () => void
}) {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  // Drawn only on the client: a portal has no place in the server's HTML.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const had = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = had
    }
  }, [onClose])

  if (!mounted) return null
  const ratio = portrait ? '1080 / 1350' : '1 / 1'
  const tiles = looks.length + (rotate ? 1 : 0)

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 anim-fade-in"
        style={{ background: 'rgba(6, 10, 18, 0.62)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      />
      <div className="look-gallery relative w-full max-w-6xl flex flex-col max-h-[92vh] rounded-xl overflow-hidden anim-rise" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>{title}</p>
            {subtitle && <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--fg-3)' }}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[12px] tabular hidden sm:inline" style={{ color: 'var(--fg-4)' }}>{`${looks.length} looks`}</span>
            <button ref={closeRef} type="button" onClick={onClose} className="ws-btn ws-btn-ghost ws-btn-sm -mr-1" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error && <p className="text-[12.5px] mb-3" style={{ color: 'var(--bad)' }}>{error}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {rotate && (
              <button
                type="button"
                onClick={() => onPick('rotate')}
                disabled={busy !== null}
                className="look-tile anim-fade-up text-left"
                data-active={current === 'rotate'}
                aria-pressed={current === 'rotate'}
              >
                <div className="relative flex items-center justify-center" style={{ aspectRatio: ratio, background: 'var(--surface-2)' }}>
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
                    {busy === 'rotate' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Shuffle className="w-5 h-5" />}
                  </span>
                  {current === 'rotate' && <Badge>Chosen</Badge>}
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--fg)' }}>The next look in turn</p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--fg-3)' }}>Takes each look before any comes round again</p>
                </div>
              </button>
            )}
            {looks.map((s, i) => {
              const Icon = icons[s.value]
              const active = current === s.value
              const ready = loaded[s.value]
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onPick(s.value)}
                  disabled={busy !== null}
                  className="look-tile anim-fade-up text-left"
                  style={{ animationDelay: `${Math.min(i + (rotate ? 1 : 0), tiles) * 35}ms` }}
                  data-active={active}
                  aria-pressed={active}
                  title={active && again ? `${s.label}: other photos` : s.label}
                >
                  <div className="relative overflow-hidden" style={{ aspectRatio: ratio, background: '#0A0F1D' }}>
                    {!ready && (
                      <div className="absolute inset-0 overflow-hidden" style={{ background: 'var(--surface-2)' }} aria-hidden="true">
                        <div className="absolute inset-y-0 w-1/3 look-sheen" />
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview(s.value)}
                      alt={`${s.label}: ${s.hint}`}
                      width={1080}
                      height={portrait ? 1350 : 1080}
                      decoding="async"
                      onLoad={() => setLoaded((m) => ({ ...m, [s.value]: true }))}
                      onError={() => setLoaded((m) => ({ ...m, [s.value]: true }))}
                      className="w-full h-full object-cover block"
                      style={{ opacity: ready ? 1 : 0, transition: 'opacity 320ms ease' }}
                    />
                    {active && <Badge>{again ? 'Current · click for other photos' : 'Current'}</Badge>}
                    {busy === s.value && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(6, 10, 18, 0.5)' }}>
                        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#FFFFFF' }} />
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-ink)' }} />
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--fg)' }}>{s.label}</span>
                      {s.photos > 0 && <span className="ml-auto text-[11px] shrink-0" style={{ color: 'var(--fg-4)' }}>{s.photos === 1 ? '1 photo' : `${s.photos} photos`}</span>}
                    </div>
                    <p className={cn('text-[11.5px] mt-0.5', 'line-clamp-2')} style={{ color: 'var(--fg-3)' }}>{s.hint}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute top-2 left-2 inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11.5px] font-medium" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
      <Check className="w-3 h-3" /> {children}
    </span>
  )
}
