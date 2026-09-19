'use client'

// Small building blocks shared by the workspace screens.

import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// A stable, pleasant colour for a name — so the same company always gets
// the same avatar tint.
const HUES = [199, 262, 152, 24, 340, 214, 44, 174]
export function hueFor(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

export function Initials({ name, size = 36, className = '' }: { name: string; size?: number; className?: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const text = (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)).toUpperCase()
  const hue = hueFor(name)
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-lg shrink-0 font-semibold select-none', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `hsl(${hue} 70% 93%)`,
        color: `hsl(${hue} 55% 32%)`,
      }}
    >
      {text}
    </span>
  )
}

export function EmptyState({
  icon: Icon, title, body, action, className,
}: { icon: LucideIcon; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-14', className)}>
      <span className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
        <Icon className="w-5 h-5" />
      </span>
      <p className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>{title}</p>
      {body && <p className="text-[13px] mt-1 max-w-sm" style={{ color: 'var(--fg-3)' }}>{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Stat({
  label, value, hint, tone = 'default', loading,
}: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'default' | 'accent' | 'ok' | 'warn'; loading?: boolean }) {
  const color = tone === 'accent' ? 'var(--accent-ink)' : tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : 'var(--fg)'
  return (
    <div className="ws-card px-5 py-4 min-w-0">
      <p className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>{label}</p>
      {loading ? (
        <div className="h-8 w-20 rounded-md mt-2 animate-pulse" style={{ background: 'var(--surface-3)' }} />
      ) : (
        <p className="display text-[28px] leading-none mt-2 tabular" style={{ color, fontWeight: 600 }}>{value}</p>
      )}
      {hint && <p className="text-[12px] mt-2 truncate" style={{ color: 'var(--fg-4)' }}>{hint}</p>}
    </div>
  )
}

export function Segmented<T extends string>({
  options, value, onChange, size = 'md',
}: { options: { value: T; label: React.ReactNode; hint?: string }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            title={o.hint}
            className={cn('rounded-md font-medium transition-all whitespace-nowrap', size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]')}
            style={
              active
                ? { background: 'var(--surface)', color: 'var(--fg)', boxShadow: 'var(--shadow-sm)' }
                : { color: 'var(--fg-3)' }
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Modal({
  title, subtitle, onClose, children, footer, width = 'max-w-lg',
}: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 anim-fade-in"
        style={{ background: 'rgba(15, 23, 42, 0.45)' }}
        // Mouse down, not click: releasing a text selection outside the panel
        // must not close it.
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      />
      <div className={cn('relative w-full anim-scale-in flex flex-col max-h-[90vh] rounded-2xl overflow-hidden', width)} style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
          <div>
            <p className="text-[15px] font-semibold display" style={{ color: 'var(--fg)' }}>{title}</p>
            {subtitle && <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--fg-3)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="ws-btn ws-btn-ghost ws-btn-sm -mr-1" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-3.5 shrink-0" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint, span = false }: { label: string; children: React.ReactNode; hint?: string; span?: boolean }) {
  return (
    <label className={cn('block', span && 'sm:col-span-2')}>
      <span className="ws-label">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] mt-1" style={{ color: 'var(--fg-4)' }}>{hint}</span>}
    </label>
  )
}

export function formatMoney(amount: number | null | undefined, currency = 'GBP'): string {
  const n = Number(amount ?? 0)
  if (!n) return '—'
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
  } catch {
    return `${currency} ${n.toLocaleString()}`
  }
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function StageDot({ hex, className = '' }: { hex: string; className?: string }) {
  return <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', className)} style={{ background: hex }} />
}
