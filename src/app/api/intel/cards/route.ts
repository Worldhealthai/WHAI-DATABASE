// GET /api/intel/cards?keys=a,b,c — the intelligence layer's light row for
// each CRM companyKey asked for (crm.v_intel_cards), and the categories a
// company carries (crm.v_intel_categories: id, name and how many companies)
// for the Companies tab's dropdown. The tab asks for the keys on the page it shows, so a request
// carries at most 200 keys. Without keys, only the categories come back.
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { cardFromRow, type IntelCard, type IntelCategory } from '@/lib/intel'

export const dynamic = 'force-dynamic'

const MAX_KEYS = 200

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('keys') ?? ''
  const keys = Array.from(new Set(raw.split(',').map((k) => k.trim()).filter(Boolean))).slice(0, MAX_KEYS)
  const wantCategories = !keys.length || req.nextUrl.searchParams.get('categories') === '1'
  try {
    const [cardsRes, catsRes] = await Promise.all([
      keys.length ? supabase.from('v_intel_cards').select('*').in('crm_key', keys) : Promise.resolve({ data: [], error: null }),
      wantCategories ? supabase.from('v_intel_categories').select('id, name, companies').order('name') : Promise.resolve({ data: null, error: null }),
    ])
    if (cardsRes.error) throw new Error(cardsRes.error.message)
    if (catsRes.error) throw new Error(catsRes.error.message)
    // One row per CRM key: a company linked under a key and again under its
    // own key is still one card.
    const seen = new Set<string>()
    const cards: IntelCard[] = []
    for (const r of (cardsRes.data ?? []) as Record<string, unknown>[]) {
      const c = cardFromRow(r)
      if (seen.has(c.crmKey)) continue
      seen.add(c.crmKey)
      cards.push(c)
    }
    const body: { cards: IntelCard[]; categories?: IntelCategory[] } = { cards }
    if (catsRes.data) {
      body.categories = (catsRes.data as { id: string; name: string; companies: number }[])
        .filter((c) => c.id && Number(c.companies) > 0)
        .map((c) => ({ id: c.id, name: c.name || c.id, companies: Number(c.companies) }))
    }
    return NextResponse.json(body)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load the intelligence cards' }, { status: 500 })
  }
}
