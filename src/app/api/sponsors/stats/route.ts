import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sponsors')
      .select('status, event')
      .is('companyId', null)

    if (error) throw error

    const byStatus: Record<string, number> = {}
    const byEvent: Record<string, number> = {}
    for (const row of data ?? []) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
      if (row.event) byEvent[row.event] = (byEvent[row.event] ?? 0) + 1
    }

    return NextResponse.json({ total: data?.length ?? 0, byStatus, byEvent })
  } catch (error) {
    console.error('Sponsors stats error:', error)
    return NextResponse.json({ total: 0, byStatus: {}, byEvent: {} })
  }
}
