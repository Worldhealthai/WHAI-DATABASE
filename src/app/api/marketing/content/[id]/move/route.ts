// POST /api/marketing/content/<id>/move { to: health|pharma|nexus, keep?, note? } → { post, removed, notes, edition }
//      the post rewritten for another page and filed under that page's
//      next edition (lib/contentTransfer); the original draft goes unless
//      keep is true.
import { NextRequest, NextResponse } from 'next/server'
import { setupHint } from '@/lib/supabase'
import { ContentError } from '@/lib/contentStudio'
import { isRoutineBrand } from '@/lib/contentRoutine'
import { movePost } from '@/lib/contentTransfer'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { to?: unknown; keep?: unknown; note?: unknown }
  if (!isRoutineBrand(body.to)) return NextResponse.json({ error: 'to must be health, pharma or nexus' }, { status: 400 })
  const note = typeof body.note === 'string' ? body.note : null
  if (note && note.length > 2000) return NextResponse.json({ error: 'Keep the note under 2,000 characters.' }, { status: 400 })
  try {
    const { post, removed, notes } = await movePost(id, body.to, { keep: body.keep === true, note })
    return NextResponse.json({ post, removed, notes, edition: post.edition }, { status: 201 })
  } catch (error) {
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status })
    const hint = setupHint('marketing_content', error as Parameters<typeof setupHint>[1])
    if (hint) return NextResponse.json({ error: hint, migration: true }, { status: 400 })
    console.error('Content move error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The post could not be moved' }, { status: 500 })
  }
}
