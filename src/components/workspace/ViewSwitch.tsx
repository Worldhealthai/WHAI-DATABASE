'use client'

// One place per kind of record, seen two ways: the board (the pipeline,
// by stage) or the list (the table, to search, filter and export). For
// partners (Marketing). Sponsors and speakers have the board only: their
// list is Companies, where anyone can be added to a pipeline.

import Link from 'next/link'
import { KanbanSquare, List } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { workspaceHref } from '@/lib/portals'

type Kind = 'partner'

const BOARD: Record<Kind, string> = { partner: 'pipeline?kind=partner' }
const LIST: Record<Kind, string> = { partner: 'partners' }

export function ViewSwitch({ kind, view }: { kind: Kind; view: 'board' | 'list' }) {
  const { portal, slug, year } = useWorkspace()
  if (!portal || !slug) return null
  const href = (path: string) => {
    const [section, query] = path.split('?')
    const base = workspaceHref(portal.key, slug, section, year ?? undefined)
    return query ? `${base}${base.includes('?') ? '&' : '?'}${query}` : base
  }
  const item = (v: 'board' | 'list', label: string, Icon: typeof List) => (
    <Link
      href={href(v === 'board' ? BOARD[kind] : LIST[kind])}
      aria-current={view === v ? 'page' : undefined}
      data-active={view === v}
      className="crm-seg-item inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium"
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </Link>
  )
  return (
    <div className="crm-seg">
      {item('board', 'Board', KanbanSquare)}
      {item('list', 'List', List)}
    </div>
  )
}
