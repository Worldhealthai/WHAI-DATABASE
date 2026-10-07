// The daily content routine's door (lib/contentRoutine). Reached from Nexus
// (api/admin/insights/content) with the shared webhook secret, which the
// proxy checks before anything here runs.
//   GET  ?brand=health|pharma|nexus[&ref=<slug>]
//        Today's briefing for that page: its full text, the voice, the last
//        posts (not to echo) and the draft's shape; or status "nothing".
//   POST { brand, ref, draft }
//        Checks the draft against the briefing and files it as a carousel,
//        a two-page post or a single card, whichever the checks allow.
import { NextRequest, NextResponse } from 'next/server'
import { setupHint } from '@/lib/supabase'
import { ContentError } from '@/lib/contentStudio'
import { isRoutineBrand, routineBrief, saveRoutinePost, type RoutineDraft } from '@/lib/contentRoutine'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function failed(error: unknown) {
  if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status })
  const hint = setupHint('marketing_content', error as Parameters<typeof setupHint>[1])
  if (hint) return NextResponse.json({ error: hint, migration: true }, { status: 400 })
  console.error('Content routine error:', error)
  return NextResponse.json({ error: error instanceof Error ? error.message : 'The content routine step failed' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get('brand')
  if (!isRoutineBrand(brand)) return NextResponse.json({ error: 'brand must be health, pharma or nexus' }, { status: 400 })
  try {
    return NextResponse.json(await routineBrief(brand, req.nextUrl.searchParams.get('ref')))
  } catch (e) {
    return failed(e)
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { brand?: unknown; ref?: unknown; draft?: unknown }
  if (!isRoutineBrand(body.brand)) return NextResponse.json({ error: 'brand must be health, pharma or nexus' }, { status: 400 })
  const ref = typeof body.ref === 'string' ? body.ref.trim() : ''
  if (!ref) return NextResponse.json({ error: 'ref (the briefing slug from the brief) is required' }, { status: 400 })
  if (!body.draft || typeof body.draft !== 'object') return NextResponse.json({ error: 'draft is required' }, { status: 400 })
  try {
    const { post, format, slides, dropped } = await saveRoutinePost(body.brand, ref, body.draft as RoutineDraft)
    return NextResponse.json({ status: 'saved', format, slides, dropped, id: post.id, edition: post.edition, headline: post.headline }, { status: 201 })
  } catch (e) {
    return failed(e)
  }
}
