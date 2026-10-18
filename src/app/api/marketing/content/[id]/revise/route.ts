// POST /api/marketing/content/<id>/revise { instruction } → { post, notes }
//      the team's instruction for a written post: Claude rewrites it as
//      asked and the image is drawn again from the new words
//      (lib/contentStudio revisePost); notes say what the checks changed.
// POST /api/marketing/content/<id>/revise { undo: true } → { post }
//      back to the words before the last revision.
import { NextRequest, NextResponse } from 'next/server'
import { ContentError, revisePost, undoRevision } from '@/lib/contentStudio'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { instruction?: unknown; undo?: unknown }
  try {
    if (body.undo === true) return NextResponse.json({ post: await undoRevision(id), notes: [] })
    const instruction = typeof body.instruction === 'string' ? body.instruction : ''
    if (instruction.length > 2000) return NextResponse.json({ error: 'Keep the instruction under 2,000 characters.' }, { status: 400 })
    return NextResponse.json(await revisePost(id, instruction))
  } catch (error) {
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Content revise error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The post could not be revised' }, { status: 500 })
  }
}
