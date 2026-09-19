// The four kinds of record the workspaces show, and what the UI needs to know
// about each: where its API lives, its stages, where a row opens.

import {
  DELEGATE_STATUS_OPTIONS, PARTNER_STATUS_OPTIONS, SPEAKER_STATUS_OPTIONS, SPONSOR_STATUS_OPTIONS,
  delegateStatusLabel,
} from '@/types'

export type RecordKind = 'sponsor' | 'partner' | 'speaker' | 'delegate'

export interface Stage {
  status: string
  label: string
  hex: string
  /** Terminal negative stage — shown apart from the progression */
  negative?: boolean
}

export interface KindDef {
  kind: RecordKind
  label: string
  plural: string
  api: string
  detailPath: string
  /** Query params always sent (the sponsors list must exclude partner tiers) */
  fixedParams: Record<string, string[]>
  stages: Stage[]
  statusLabel: (s: string) => string
  badgeVariant: 'sponsor_status' | 'speaker_status' | 'delegate_status'
  activityType: 'sponsor' | 'partner' | 'speaker' | 'delegate'
  /** Whether rows carry a money value (sponsors and partners do) */
  hasValue: boolean
}

const PARTNER_TIERS = ['Media Partner', 'Association Partner']

const SPONSOR_STAGES: Stage[] = [
  { status: 'Not Contacted', label: 'Not contacted', hex: '#94a3b8' },
  { status: 'Emailed', label: 'Emailed', hex: '#3b82f6' },
  { status: 'In Discussion', label: 'In discussion', hex: '#8b5cf6' },
  { status: 'Confirmed', label: 'Confirmed', hex: '#10b981' },
  { status: 'Rejected', label: 'Rejected', hex: '#ef4444', negative: true },
]

const SPEAKER_STAGES: Stage[] = [
  { status: 'Not Contacted', label: 'Not contacted', hex: '#94a3b8' },
  { status: 'Invited', label: 'Invited', hex: '#3b82f6' },
  { status: 'Discussing', label: 'Discussing', hex: '#8b5cf6' },
  { status: 'Speaking Confirmed', label: 'Confirmed', hex: '#10b981' },
  { status: 'Cancelled', label: 'Cancelled', hex: '#f59e0b', negative: true },
  { status: 'Rejected', label: 'Rejected', hex: '#ef4444', negative: true },
]

const DELEGATE_STAGES: Stage[] = [
  { status: 'Registered', label: 'Registered', hex: '#3b82f6' },
  { status: 'Confirmed', label: 'Invited', hex: '#0ea5e9' },
  { status: 'Cancelled', label: 'Cancelled', hex: '#f59e0b', negative: true },
  { status: 'No-show', label: 'No-show', hex: '#94a3b8', negative: true },
  { status: 'Rejected', label: 'Rejected', hex: '#ef4444', negative: true },
]

export const KINDS: Record<RecordKind, KindDef> = {
  sponsor: {
    kind: 'sponsor',
    label: 'Sponsor',
    plural: 'Sponsors',
    api: '/api/sponsors',
    detailPath: '/sponsors',
    fixedParams: { excludeTiers: PARTNER_TIERS },
    stages: SPONSOR_STAGES,
    statusLabel: (s) => s,
    badgeVariant: 'sponsor_status',
    activityType: 'sponsor',
    hasValue: true,
  },
  partner: {
    kind: 'partner',
    label: 'Partner',
    plural: 'Partners & media',
    api: '/api/partners',
    detailPath: '/partners',
    fixedParams: {},
    stages: SPONSOR_STAGES,
    statusLabel: (s) => s,
    badgeVariant: 'sponsor_status',
    activityType: 'partner',
    hasValue: true,
  },
  speaker: {
    kind: 'speaker',
    label: 'Speaker',
    plural: 'Speakers',
    api: '/api/speakers',
    detailPath: '/speakers',
    fixedParams: {},
    stages: SPEAKER_STAGES,
    statusLabel: (s) => SPEAKER_STAGES.find((x) => x.status === s)?.label ?? s,
    badgeVariant: 'speaker_status',
    activityType: 'speaker',
    hasValue: false,
  },
  delegate: {
    kind: 'delegate',
    label: 'Delegate',
    plural: 'Delegates',
    api: '/api/delegates',
    detailPath: '/delegates',
    fixedParams: {},
    stages: DELEGATE_STAGES,
    statusLabel: (s) => delegateStatusLabel(s),
    badgeVariant: 'delegate_status',
    activityType: 'delegate',
    hasValue: false,
  },
}

export const STATUS_OPTIONS: Record<RecordKind, string[]> = {
  sponsor: SPONSOR_STATUS_OPTIONS,
  partner: PARTNER_STATUS_OPTIONS,
  speaker: SPEAKER_STATUS_OPTIONS,
  delegate: DELEGATE_STATUS_OPTIONS,
}

export function stageOf(kind: RecordKind, status: string): Stage {
  return KINDS[kind].stages.find((s) => s.status === status) ?? { status, label: status, hex: '#94a3b8' }
}

// A record's display name, whatever its shape.
export function recordName(kind: RecordKind, r: Record<string, unknown>): string {
  if (kind === 'sponsor' || kind === 'partner') return String(r.companyName ?? '')
  return `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()
}

export function recordSubtitle(kind: RecordKind, r: Record<string, unknown>): string {
  if (kind === 'sponsor' || kind === 'partner') {
    const person = `${r.contactFirstName ?? ''} ${r.contactLastName ?? ''}`.trim()
    return [person, r.contactJobTitle].filter(Boolean).join(' · ')
  }
  return [r.jobTitle, r.organization].filter(Boolean).join(' · ')
}

// Query string for a list call scoped to an edition.
export function listParams(
  kind: RecordKind,
  labels: string[],
  extra: Record<string, string | string[] | undefined> = {}
): URLSearchParams {
  const p = new URLSearchParams()
  for (const l of labels) p.append('events', l)
  for (const [k, v] of Object.entries(KINDS[kind].fixedParams)) v.forEach((x) => p.append(k, x))
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x))
    else p.set(k, v)
  }
  return p
}

// Log a stage change against the record so the profile's activity feed
// shows it — best-effort, never blocks the move itself.
export async function logStageChange(kind: RecordKind, id: string, from: string, to: string) {
  try {
    await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: KINDS[kind].activityType,
        entityId: id,
        type: 'status_change',
        content: `Moved from ${KINDS[kind].statusLabel(from)} to ${KINDS[kind].statusLabel(to)}`,
        metadata: { from, to },
        createdBy: 'CRM',
      }),
    })
  } catch {
    /* the move already happened; the feed entry is a nicety */
  }
}

export async function changeStage(kind: RecordKind, id: string, from: string, to: string): Promise<boolean> {
  const res = await fetch(`${KINDS[kind].api}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: to }),
  })
  if (res.ok && from !== to) void logStageChange(kind, id, from, to)
  return res.ok
}
