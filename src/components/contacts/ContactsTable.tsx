'use client'

import Link from 'next/link'
import { ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, Mail, ExternalLink } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { SENIORITY_LABELS, DEPARTMENT_LABELS } from '@/types'
import type { SeniorityLevel, Department } from '@/types'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  job_title: string
  seniority_level: SeniorityLevel | null
  department: Department | null
  country: string | null
  city: string | null
  is_verified: boolean
  last_verified_at: string | null
  engagement_score: number
  company: {
    id: string
    name: string
    company_type: string
    logo_url: string | null
  } | null
  job_function: { name: string } | null
}

interface SortConfig {
  sortBy: string
  sortDir: 'asc' | 'desc'
}

interface ContactsTableProps {
  contacts: Contact[]
  sort: SortConfig
  onSort: (col: string) => void
}

const SENIORITY_COLORS: Record<string, string> = {
  C_SUITE: 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
  VP: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  DIRECTOR: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  MANAGER: 'text-green-400 bg-green-400/10 border-green-400/20',
  INDIVIDUAL_CONTRIBUTOR: 'text-slate-300 bg-slate-700/50 border-slate-600',
  BOARD: 'text-red-400 bg-red-400/10 border-red-400/20',
}

function SortableHeader({
  label, col, sort, onSort,
}: {
  label: string; col: string; sort: SortConfig; onSort: (col: string) => void
}) {
  const active = sort.sortBy === col
  return (
    <th
      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-white select-none whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          sort.sortDir === 'asc'
            ? <ArrowUp className="w-3 h-3 text-[#00B4D8]" />
            : <ArrowDown className="w-3 h-3 text-[#00B4D8]" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-600" />
        )}
      </div>
    </th>
  )
}

export function ContactsTable({ contacts, sort, onSort }: ContactsTableProps) {
  if (contacts.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p className="text-sm">No contacts match your filters.</p>
        <p className="text-xs mt-1">Try adjusting your search criteria.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <SortableHeader label="Name" col="last_name" sort={sort} onSort={onSort} />
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Job Title
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Company
            </th>
            <SortableHeader label="Seniority" col="seniority_level" sort={sort} onSort={onSort} />
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Dept
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Location
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Email
            </th>
            <SortableHeader label="Score" col="engagement_score" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contacts.map((contact) => (
            <tr
              key={contact.id}
              className="hover:bg-[#112850]/50 transition-colors group"
            >
              {/* Name */}
              <td className="px-3 py-2.5 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#1a3a5c] flex items-center justify-center text-xs font-semibold text-[#00B4D8] shrink-0">
                    {contact.first_name[0]}{contact.last_name[0]}
                  </div>
                  <div>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium text-white hover:text-[#00B4D8] transition-colors"
                    >
                      {contact.first_name} {contact.last_name}
                    </Link>
                    {contact.is_verified && (
                      <CheckCircle2 className="inline-block ml-1 w-3 h-3 text-[#10B981]" />
                    )}
                  </div>
                </div>
              </td>

              {/* Job Title */}
              <td className="px-3 py-2.5 max-w-[200px]">
                <span className="text-slate-300 truncate block">{contact.job_title}</span>
                {contact.job_function && (
                  <span className="text-xs text-slate-500">{contact.job_function.name}</span>
                )}
              </td>

              {/* Company */}
              <td className="px-3 py-2.5 whitespace-nowrap">
                {contact.company ? (
                  <Link
                    href={`/companies/${contact.company.id}`}
                    className="text-slate-300 hover:text-[#00B4D8] transition-colors"
                  >
                    {contact.company.name}
                  </Link>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </td>

              {/* Seniority */}
              <td className="px-3 py-2.5 whitespace-nowrap">
                {contact.seniority_level ? (
                  <span className={cn(
                    'whai-badge border',
                    SENIORITY_COLORS[contact.seniority_level] ?? 'text-slate-300 bg-slate-700/50 border-slate-600',
                  )}>
                    {SENIORITY_LABELS[contact.seniority_level as SeniorityLevel]}
                  </span>
                ) : <span className="text-slate-500">—</span>}
              </td>

              {/* Department */}
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="text-xs text-slate-400">
                  {contact.department ? DEPARTMENT_LABELS[contact.department as Department] : '—'}
                </span>
              </td>

              {/* Location */}
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="text-xs text-slate-400">
                  {[contact.city, contact.country].filter(Boolean).join(', ') || '—'}
                </span>
              </td>

              {/* Email */}
              <td className="px-3 py-2.5 whitespace-nowrap">
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1 text-xs text-[#00B4D8] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Mail className="w-3 h-3" />
                    <span className="truncate max-w-[140px]">{contact.email}</span>
                  </a>
                ) : (
                  <span className="text-xs text-slate-600">—</span>
                )}
              </td>

              {/* Engagement Score */}
              <td className="px-3 py-2.5 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-[#1a3a5c] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#00B4D8]"
                      style={{ width: `${contact.engagement_score}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-6 text-right">
                    {contact.engagement_score}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
