// GET /api/db-status → { ok, configured, schema, project, key, problem }
//
// Whether the CRM can read every one of its tables, and if not, what to do
// about it. The app shows `problem` in a notice at the top of every screen,
// so a database that is not set up (for example the crm schema not yet
// exposed in the Nexus project) is explained rather than showing empty lists.
import { NextResponse } from 'next/server'
import { checkDatabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await checkDatabase(), { headers: { 'Cache-Control': 'no-store' } })
}
