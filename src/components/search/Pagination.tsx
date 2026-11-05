'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (page: number) => void
  // Without it the list has a fixed page size and no "Show" picker.
  onPageSize?: (size: number) => void
  // Scroll back to the top of the list on a page change.
  scrollTo?: React.RefObject<HTMLElement | null>
}

// Quiet by design: the current page is marked, not lit; the accent is kept
// for each page's one main action. Arrows are 40px taps on a phone.
export function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize, scrollTo }: PaginationProps) {
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const pages = getPagesArray(page, totalPages)
  const go = (p: number) => {
    onPage(p)
    const el = scrollTo?.current
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' })
  }
  const arrow = 'inline-flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-full transition-colors hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent'

  return (
    <div className="flex items-center justify-between pt-3 gap-2" style={{ borderTop: '1px solid var(--line)' }}>
      <div className="flex items-center gap-2 sm:gap-3 text-[12.5px]" style={{ color: 'var(--fg-3)' }}>
        <span className="whitespace-nowrap tabular">
          {total === 0 ? '0' : <><span style={{ color: 'var(--fg-2)' }}>{start}–{end}</span> of {total.toLocaleString()}</>}
        </span>
        {onPageSize && (
          <div className="hidden sm:flex items-center gap-1.5">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSize(parseInt(e.target.value))}
              className="bg-[var(--surface-2)] border border-[var(--line)] rounded-md px-1.5 py-0.5 text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            >
              {[25, 50, 100].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1" style={{ color: 'var(--fg-2)' }}>
        <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} className={arrow} aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* On a phone, where we are, between two big arrows */}
        <span className="sm:hidden text-[12.5px] tabular px-1" style={{ color: 'var(--fg-3)' }}>
          {page} / {totalPages}
        </span>

        <div className="hidden sm:flex items-center gap-0.5">
          {pages.map((p, i) =>
            p === '...' ? (
              <span key={i} className="px-1" style={{ color: 'var(--fg-4)' }}>…</span>
            ) : (
              <button
                type="button"
                key={p}
                onClick={() => go(p as number)}
                aria-current={page === p ? 'page' : undefined}
                className={cn(
                  'min-w-8 h-8 px-1.5 rounded-full text-[12.5px] tabular transition-colors',
                  page === p
                    ? 'bg-[var(--surface-3)] text-[var(--fg)] font-semibold'
                    : 'text-[var(--fg-3)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
                )}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button type="button" onClick={() => go(page + 1)} disabled={page >= totalPages} className={arrow} aria-label="Next page">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function getPagesArray(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}
