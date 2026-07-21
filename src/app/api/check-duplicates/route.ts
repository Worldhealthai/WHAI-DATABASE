import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST body: { emails: string[], names: { first: string, last: string }[], companyNames?: string[] }
// Returns: { duplicates: { key: string, match: string, table: string }[] }
export async function POST(req: NextRequest) {
  try {
    const { emails, names, companyNames } = await req.json()

    const found: { key: string; match: string; table: string }[] = []

    // Email check across all entity tables
    const cleanEmails = (emails as string[]).filter(Boolean).map((e) => e.toLowerCase().trim())

    if (cleanEmails.length) {
      const tables = [
        { name: 'delegates', col: 'email' },
        { name: 'speakers', col: 'email' },
        { name: 'sponsors', col: 'contactEmail' },
      ]

      for (const { name, col } of tables) {
        const { data } = await supabase
          .from(name)
          .select(col)
          .in(col, cleanEmails)

        if (data?.length) {
          data.forEach((row: any) => {
            const email = row[col]?.toLowerCase()
            if (email) found.push({ key: email, match: 'email', table: name })
          })
        }
      }
    }

    // Name check (first + last) for people without email
    const cleanNames = ((names as { first: string; last: string }[]) ?? [])
      .filter((n) => n.first && n.last)
      .map((n) => ({ first: n.first.trim().toLowerCase(), last: n.last.trim().toLowerCase() }))

    if (cleanNames.length) {
      const tables = ['delegates', 'speakers']
      for (const table of tables) {
        const { data } = await supabase
          .from(table)
          .select('firstName,lastName')

        if (data) {
          data.forEach((row: any) => {
            const f = row.firstName?.toLowerCase()
            const l = row.lastName?.toLowerCase()
            if (f && l && cleanNames.some((n) => n.first === f && n.last === l)) {
              found.push({ key: `${f} ${l}`, match: 'name', table })
            }
          })
        }
      }
    }

    // Company name check for sponsor imports
    const cleanCompanyNames = ((companyNames as string[]) ?? [])
      .filter(Boolean)
      .map((n) => n.trim().toLowerCase())

    if (cleanCompanyNames.length) {
      // Fetch all existing company-level sponsor records
      const { data } = await supabase
        .from('sponsors')
        .select('companyName')
        .is('companyId', null)

      if (data) {
        data.forEach((row: any) => {
          const name = row.companyName?.toLowerCase()
          if (name && cleanCompanyNames.includes(name)) {
            found.push({ key: name, match: 'company', table: 'sponsors' })
          }
        })
      }
    }

    // Rich company lookup — does this organisation exist ANYWHERE in the CRM
    // (sponsor records by company name, delegates/speakers by organisation)?
    // Loose containment match either way ("Pfizer" ↔ "Pfizer Ltd"), ignoring
    // very short strings that would match everything.
    const companies: {
      query: string
      matches: { table: string; name: string; count: number; statuses: string[] }[]
    }[] = []

    if (cleanCompanyNames.length) {
      const looseMatch = (a: string, b: string) =>
        a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))

      const [sponsorRows, delegateRows, speakerRows] = await Promise.all([
        supabase.from('sponsors').select('companyName,status'),
        supabase.from('delegates').select('organization,status'),
        supabase.from('speakers').select('organization,status'),
      ])

      const sources: { table: string; rows: { name: string | null; status: string | null }[] }[] = [
        { table: 'sponsors', rows: (sponsorRows.data ?? []).map((r: any) => ({ name: r.companyName, status: r.status })) },
        { table: 'delegates', rows: (delegateRows.data ?? []).map((r: any) => ({ name: r.organization, status: r.status })) },
        { table: 'speakers', rows: (speakerRows.data ?? []).map((r: any) => ({ name: r.organization, status: r.status })) },
      ]

      for (const q of cleanCompanyNames) {
        const matches: { table: string; name: string; count: number; statuses: string[] }[] = []
        for (const { table, rows } of sources) {
          // Group matching rows by their stored name so "Pfizer" and
          // "Pfizer Ltd" show as separate entries with their own counts.
          const byName = new Map<string, { count: number; statuses: Set<string> }>()
          for (const r of rows) {
            const name = (r.name ?? '').trim()
            if (!name || !looseMatch(name.toLowerCase(), q)) continue
            const e = byName.get(name) ?? { count: 0, statuses: new Set<string>() }
            e.count++
            if (r.status) e.statuses.add(r.status)
            byName.set(name, e)
          }
          byName.forEach((e, name) => {
            matches.push({ table, name, count: e.count, statuses: Array.from(e.statuses) })
          })
        }
        if (matches.length) companies.push({ query: q, matches })
      }
    }

    return NextResponse.json({ duplicates: found, companies })
  } catch (error) {
    console.error('Check duplicates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
