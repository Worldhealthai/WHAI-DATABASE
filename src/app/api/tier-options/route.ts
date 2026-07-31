// Sponsor tier options for dropdowns — the built-in list plus any custom
// packages created on the sites' Sponsor Packages pages.
//
// worldhealth.ai serves its package list openly; worldnexusgroup.com requires
// the shared webhook secret (the same WEBHOOK_SECRET the sites use to call
// this CRM). Both lookups are best-effort with short timeouts — if a site is
// unreachable the dropdown still shows the built-in tiers.

import { NextResponse } from 'next/server'
import { SPONSOR_TIER_OPTIONS } from '@/types'

export const dynamic = 'force-dynamic'

const WHA_URL = (process.env.WHA_SITE_URL || 'https://www.worldhealth.ai').replace(/\/+$/, '')
const NEXUS_URL = (process.env.NEXUS_SITE_URL || 'https://www.worldnexusgroup.com').replace(/\/+$/, '')

async function fetchCustomTiers(url: string, headers: Record<string, string>): Promise<string[]> {
  try {
    const res = await fetch(`${url}/api/sponsor-packages`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const j = await res.json()
    return ((j?.tiers ?? []) as { tier?: string; custom?: boolean }[])
      .filter((t) => t.custom && t.tier)
      .map((t) => String(t.tier))
  } catch {
    return []
  }
}

export async function GET() {
  const secret = process.env.WEBHOOK_SECRET?.trim()
  const [whaCustom, nexusCustom] = await Promise.all([
    fetchCustomTiers(WHA_URL, {}),
    secret ? fetchCustomTiers(NEXUS_URL, { 'x-webhook-secret': secret }) : Promise.resolve([]),
  ])

  // Built-ins keep their order; customs follow, deduped case-insensitively.
  const seen = new Set(SPONSOR_TIER_OPTIONS.map((t) => t.toLowerCase()))
  const customs: string[] = []
  for (const t of [...whaCustom, ...nexusCustom]) {
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    customs.push(t)
  }
  customs.sort((a, b) => a.localeCompare(b))

  return NextResponse.json({ tiers: [...SPONSOR_TIER_OPTIONS, ...customs] })
}
