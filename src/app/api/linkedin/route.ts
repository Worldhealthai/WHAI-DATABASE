// The LinkedIn connection the Content tab posts with (lib/linkedin).
//   GET    → whether it is set up and connected, its pages, and which page
//            each brand posts to (never the tokens)
//   PATCH  { pageFor: { health?, pharma?, nexus? } } → choose the pages
//   POST   { action: "refresh-pages" } → read the pages again
//   DELETE → forget the connection
import { NextRequest, NextResponse } from 'next/server'
import { LinkedInError, disconnect, refreshPages, setPageFor, status } from '@/lib/linkedin'

export const dynamic = 'force-dynamic'

const failed = (e: unknown) =>
  e instanceof LinkedInError
    ? NextResponse.json({ error: e.message, reconnect: e.reconnect }, { status: e.status })
    : NextResponse.json({ error: e instanceof Error ? e.message : 'LinkedIn step failed' }, { status: 500 })

export async function GET(req: NextRequest) {
  return NextResponse.json(await status(req.nextUrl.origin))
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { pageFor?: Record<string, string> }
  try {
    await setPageFor(body.pageFor ?? {})
    return NextResponse.json(await status(req.nextUrl.origin))
  } catch (e) {
    return failed(e)
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { action?: string }
  if (body.action !== 'refresh-pages') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  try {
    await refreshPages()
    return NextResponse.json(await status(req.nextUrl.origin))
  } catch (e) {
    return failed(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await disconnect()
    return NextResponse.json(await status(req.nextUrl.origin))
  } catch (e) {
    return failed(e)
  }
}
