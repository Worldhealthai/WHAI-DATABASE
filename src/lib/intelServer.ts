// Server-side helpers for the intelligence routes (/api/intel/*): reading a
// company's document through crm.intel_company, and who is reviewing.
import type { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { companyKey } from '@/lib/segments'
import type { IntelCompany } from '@/lib/intel'

/** The company's document by its CRM key, then by the key of its name; null when the layer has nothing. */
export async function readIntelCompany(key: string | null, name: string | null): Promise<IntelCompany | null> {
  const tried = new Set<string>()
  for (const k of [key, companyKey(name)]) {
    const want = (k ?? '').trim()
    if (!want || tried.has(want)) continue
    tried.add(want)
    const { data, error } = await supabase.rpc('intel_company', { p_key: want })
    if (error) throw new Error(error.message)
    if (data) {
      const company = data as IntelCompany
      // Its news and its latest figures, read apart (migration 020). Where
      // that is not installed the page falls back to the latest signals.
      const more = await supabase.rpc('intel_signals', { p_key: want })
      const doc = more.error ? null : (more.data as { news?: unknown; figures?: unknown; activity?: unknown; total?: unknown } | null)
      if (doc && Array.isArray(doc.news) && Array.isArray(doc.figures)) {
        company.news = doc.news as IntelCompany['news']
        company.figures = doc.figures as IntelCompany['figures']
        if (Array.isArray(doc.activity)) company.activity = doc.activity as IntelCompany['activity']
        company.signalsTotal = Number(doc.total) || 0
      }
      return company
    }
  }
  return null
}

/** The person using the CRM, as far as the app knows: a name header or cookie set by a future sign-in, else "CRM user". */
export function reviewerOf(req: NextRequest): string {
  const fromHeader = req.headers.get('x-crm-user')?.trim()
  const fromCookie = req.cookies.get('whai_user')?.value?.trim()
  return (fromHeader || fromCookie || 'CRM user').slice(0, 80)
}
