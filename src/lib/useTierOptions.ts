'use client'

// Sponsor tier options including custom packages created on the sites'
// Sponsor Packages pages. Starts with (and falls back to) the built-in list.

import { useQuery } from '@tanstack/react-query'
import { SPONSOR_TIER_OPTIONS } from '@/types'

export function useTierOptions(): string[] {
  const { data } = useQuery({
    queryKey: ['tier-options'],
    queryFn: async () => {
      const res = await fetch('/api/tier-options')
      if (!res.ok) throw new Error('Failed to load tier options')
      const j = await res.json()
      return Array.isArray(j?.tiers) && j.tiers.length ? (j.tiers as string[]) : SPONSOR_TIER_OPTIONS
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  return data ?? SPONSOR_TIER_OPTIONS
}
