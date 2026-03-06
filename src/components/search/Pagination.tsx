'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}

export function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize }: PaginationProps) {
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const pages = getPagesArray(page, totalPages)

  return (
    <div className="flex items-center justify-between pt-3 border-t border-border">
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>
          {total === 0 ? '0' : `${start}–${end}`} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-1.5">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(parseInt(e.target.value))}
            className="bg-[#112850] border border-[#1a3a5c] rounded px-1.5 py-0.5 text-white outline-none focus:border-[#00B4D8]"
          >
            {[25, 50, 100].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="p-1 rounded hover:bg-[#112850] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={i} className="px-1 text-slate-500">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={cn(
                'w-7 h-7 rounded text-xs font-medium transition-colors',
                page === p
                  ? 'bg-[#00B4D8] text-[#0A1628]'
                  : 'text-slate-400 hover:bg-[#112850] hover:text-white',
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="p-1 rounded hover:bg-[#112850] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
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
