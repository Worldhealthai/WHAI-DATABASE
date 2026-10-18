// POST /api/marketing/content/<id>/revise { instruction, picture?, where? } → { post, notes, changed, reply }
//      the team's instruction for a written post, from the chat on it:
//      Claude rewrites it as asked (its words, its look or its photos) and
//      it is drawn again (lib/contentStudio revisePost). picture is the
//      slide or card as the team saw it, a JPEG data URL with the spot they
//      clicked ringed; where names the slide.
// POST /api/marketing/content/<id>/revise { undo: true } → { post }
//      back to the words before the last revision.
import { NextRequest, NextResponse } from 'next/server'
import { ContentError, revisePost, undoRevision } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { instruction?: unknown; undo?: unknown; picture?: unknown; where?: unknown }
  try {
    if (body.undo === true) return NextResponse.json({ post: await undoRevision(id), notes: [] })
    const instruction = typeof body.instruction === 'string' ? body.instruction : ''
    if (instruction.length > 2000) return NextResponse.json({ error: 'Keep the instruction under 2,000 characters.' }, { status: 400 })
    const jpeg = typeof body.picture === 'string' ? body.picture.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/)?.[1] ?? null : null
    if (body.picture && !jpeg) return NextResponse.json({ error: 'The picture must be a JPEG.' }, { status: 400 })
    if (jpeg && jpeg.length > 4_000_000) return NextResponse.json({ error: 'The picture is too large.' }, { status: 400 })
    const where = typeof body.where === 'string' ? body.where.slice(0, 120) : null
    return NextResponse.json(await revisePost(id, instruction, { picture: jpeg, where }))
  } catch (error) {
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Content revise error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The post could not be revised' }, { status: 500 })
  }
}
