import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST body: { emails: string[], names: { first: string, last: string }[] }
// Returns: { duplicates: { email?: string, name?: string, table: string }[] }
export async function POST(req: NextRequest) {
  try {
    const { emails, names } = await req.json()

    const found: { key: string; match: string; table: string }[] = []

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

    // Name check (first + last) for rows without email
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

    return NextResponse.json({ duplicates: found })
  } catch (error) {
    console.error('Check duplicates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
