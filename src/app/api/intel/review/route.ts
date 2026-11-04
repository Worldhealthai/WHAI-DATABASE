// POST /api/intel/review — a person's verdict on the intelligence layer,
// through crm.intel_review(action, payload):
//   { action: 'verify_description', payload: { key } }
//   { action: 'competitor', payload: { key, other_key, verdict: 'confirmed' | 'rejected' } }
//   { action: 'deployment', payload: { id, verdict: 'verified' | 'rejected' } }
// Who decided is recorded as the signed-in user when the app knows one
// (the CRM has one shared password, so today that is "CRM user").
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { reviewerOf } from '@/lib/intelServer'

export const dynamic = 'force-dynamic'

const ACTIONS = new Set(['verify_description', 'competitor', 'deployment'])

export async function POST(req: NextRequest) {
  let body: { action?: string; payload?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'A JSON body is needed' }, { status: 400 })
  }
  const action = String(body.action ?? '')
  if (!ACTIONS.has(action)) return NextResponse.json({ error: `action must be one of ${[...ACTIONS].join(', ')}` }, { status: 400 })
  const payload = { ...(body.payload ?? {}), by: reviewerOf(req) }
  const { data, error } = await supabase.rpc('intel_review', { p_action: action, p_payload: payload })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result = (data ?? {}) as { ok?: boolean; error?: string }
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'The review was not saved' }, { status: 400 })
  return NextResponse.json(result)
}
