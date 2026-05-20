import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST() {
  const results: Record<string, { updated: number; error?: string }> = {}

  for (const table of ['sponsors', 'delegates', 'speakers'] as const) {
    const { data, error } = await supabase
      .from(table)
      .update({ status: 'Not Contacted' })
      .eq('status', 'Prospecting')
      .select('id')

    if (error) {
      results[table] = { updated: 0, error: error.message }
    } else {
      results[table] = { updated: data?.length ?? 0 }
    }
  }

  return NextResponse.json({ results })
}
