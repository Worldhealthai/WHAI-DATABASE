'use client'

import { cn } from '@/lib/utils'

const DELEGATE_STATUS_COLORS: Record<string, string> = {
  'Registered':  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Confirmed':   'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'Attended':    'bg-green-500/15 text-green-400 border-green-500/30',
  'Cancelled':   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'No-show':     'bg-slate-500/15 text-slate-400 border-slate-500/30',
  'Waitlisted':  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Rejected':    'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

const SPEAKER_STATUS_COLORS: Record<string, string> = {
  'Not Contacted':      'bg-slate-500/15 text-slate-400 border-slate-500/30',
  'Invited':            'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Discussing':         'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Speaking Confirmed': 'bg-green-500/15 text-green-400 border-green-500/30',
  'Cancelled':          'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'Speaking Rejected':  'bg-rose-500/15 text-rose-400 border-rose-500/30',
  'Rejected':           'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

const SPONSOR_STATUS_COLORS: Record<string, string> = {
  'Not Contacted': 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  'Emailed':       'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'In Discussion': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Confirmed':     'bg-green-500/15 text-green-400 border-green-500/30',
  'Rejected':      'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

const SPONSOR_TIER_COLORS: Record<string, string> = {
  'Exhibitor':              'bg-slate-500/15 text-slate-300 border-slate-500/30',
  'Event Partner':          'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Drinks Sponsor':         'bg-teal-500/15 text-teal-400 border-teal-500/30',
  'Badge & Lanyard Sponsor':'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  'Wifi Sponsor':           'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'Silver Sponsor':         'bg-slate-400/15 text-slate-300 border-slate-400/30',
  'Gold Sponsor':           'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'Platinum Sponsor':       'bg-slate-300/15 text-slate-200 border-slate-300/30',
  'Media Partner':          'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Association Partner':    'bg-orange-500/15 text-orange-400 border-orange-500/30',
}

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  'Not Started': 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  'Sent':        'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Signed':      'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Executed':    'bg-green-500/15 text-green-400 border-green-500/30',
}

const FEE_STATUS_COLORS: Record<string, string> = {
  'Not Set':    'bg-slate-500/15 text-slate-400 border-slate-500/30',
  'Negotiating':'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Agreed':     'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Invoiced':   'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Paid':       'bg-green-500/15 text-green-400 border-green-500/30',
  'Waived':     'bg-teal-500/15 text-teal-400 border-teal-500/30',
}

const TICKET_TYPE_COLORS: Record<string, string> = {
  'Standard':      'bg-slate-500/15 text-slate-400 border-slate-500/30',
  'VIP':           'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Speaker':       'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Sponsor':       'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Press':         'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'Complimentary': 'bg-green-500/15 text-green-400 border-green-500/30',
  'Virtual':       'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
}

type BadgeVariant = 'delegate_status' | 'speaker_status' | 'sponsor_status' | 'sponsor_tier' | 'contract_status' | 'fee_status' | 'ticket_type'

const COLOR_MAPS: Record<BadgeVariant, Record<string, string>> = {
  delegate_status: DELEGATE_STATUS_COLORS,
  speaker_status:  SPEAKER_STATUS_COLORS,
  sponsor_status:  SPONSOR_STATUS_COLORS,
  sponsor_tier:    SPONSOR_TIER_COLORS,
  contract_status: CONTRACT_STATUS_COLORS,
  fee_status:      FEE_STATUS_COLORS,
  ticket_type:     TICKET_TYPE_COLORS,
}

interface StatusBadgeProps {
  value: string
  variant: BadgeVariant
  className?: string
}

export function StatusBadge({ value, variant, className }: StatusBadgeProps) {
  const colorClass = COLOR_MAPS[variant]?.[value] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', colorClass, className)}>
      {value}
    </span>
  )
}
