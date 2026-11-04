// GET /api/intel/company?key=…&name=… — a company's intelligence record,
// read through crm.intel_company(key) (supabase/migrations/017). The key is
// the CRM's companyKey; the name is tried as well when the key finds
// nothing. { company: null } when the intelligence layer has nothing on it.
import { NextRequest, NextResponse } from 'next/server'
import { readIntelCompany } from '@/lib/intelServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  const name = req.nextUrl.searchParams.get('name')
  if (!key && !name) return NextResponse.json({ error: 'key or name is needed' }, { status: 400 })
  try {
    const company = await readIntelCompany(key, name)
    return NextResponse.json({ company })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load the company intelligence' }, { status: 500 })
  }
}
