// POST /api/contact-focus { rows: [{ table, id }], focus: ['Health' | 'Pharma'] }
// Marks a person as relevant for World Health AI, World Pharma AI or both,
// on every record they have (lib/contactFocus): the rows given, and, with
// an email, every other record carrying it. The focus is kept as a tag
// in each record's own tags; other tags stay as they are.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { FOCUSES, focusOf, withFocus, type Focus } from '@/lib/contactFocus'

export const dynamic = 'force-dynamic'

const TABLES = new Set(['sponsors', 'speakers', 'delegates', 'partners', 'leads'])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const focus = (Array.isArray(body?.focus) ? body.focus : []).filter((f: unknown): f is Focus => FOCUSES.includes(f as Focus))
  const rows = (Array.isArray(body?.rows) ? body.rows : [])
    .filter((r: any) => r && TABLES.has(r.table) && typeof r.id === 'string' && r.id)
    .slice(0, 200) as { table: string; id: string }[]
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!rows.length) return NextResponse.json({ error: 'No records given' }, { status: 400 })
  try {
    if (email.includes('@')) {
      const esc = email.replace(/[\\%_]/g, '\\$&')
      for (const [table, col] of [['speakers', 'email'], ['delegates', 'email'], ['sponsors', 'contactEmail'], ['partners', 'contactEmail'], ['leads', 'email']]) {
        const { data, error } = await supabase.from(table).select('id').ilike(col, esc).limit(50)
        if (error) throw error
        for (const r of (data ?? []) as { id: string }[]) rows.push({ table, id: r.id })
      }
    }
    const byTable = new Map<string, string[]>()
    for (const r of rows) byTable.set(r.table, [...(byTable.get(r.table) ?? []), r.id])
    let changed = 0
    for (const [table, ids] of byTable) {
      const { data, error } = await supabase.from(table).select('id, tags').in('id', [...new Set(ids)])
      if (error) throw error
      for (const r of (data ?? []) as { id: string; tags: string | null }[]) {
        if (focusOf(r.tags).join() === focus.join()) continue
        const { error: e } = await supabase.from(table).update({ tags: withFocus(r.tags, focus) }).eq('id', r.id)
        if (e) throw e
        changed++
      }
    }
    return NextResponse.json({ ok: true, focus, changed })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save' }, { status: 500 })
  }
}
