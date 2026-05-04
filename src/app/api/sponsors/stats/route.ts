import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sponsors')
      .select('status')

    if (error) throw error

    const byStatus: Record<string, number> = {}
    for (const row of data ?? []) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
    }

    return NextResponse.json({ byStatus })
  } catch (error) {
    console.error('Sponsors stats error:', error)
    return NextResponse.json({ byStatus: {} })
  }
}
