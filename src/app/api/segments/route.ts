// GET /api/segments?events=<label>&events=… — the edition in two layers
// (or ?scope=all: every event, for the directory)
// (lib/segments): companies with their firmographic, people with their
// event tags, and the Solution Provider hit list. Read only.
import { gzipSync } from 'zlib'
import { NextRequest, NextResponse } from 'next/server'
import { consolidate, hitList } from '@/lib/segments'
import { loadContacts } from '@/lib/segmentData'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const events = req.nextUrl.searchParams.getAll('events').map((e) => e.trim()).filter(Boolean)
  try {
    const contacts = await loadContacts(req.nextUrl.searchParams.get('scope') === 'all' ? null : events)
    const { people, accounts } = consolidate(contacts)
    accounts.sort((a, b) => a.name.localeCompare(b.name))
    people.sort((a, b) => a.name.localeCompare(b.name))
    // ?view=accounts|people|hit sends only what that view reads; with the
    // leads lists the whole runs to megabytes. Sent compressed: the
    // platform caps a response at 4.5 MB.
    const view = req.nextUrl.searchParams.get('view')
    const body = JSON.stringify({
      accounts: view === 'people' || view === 'hit' ? [] : accounts,
      people: view === 'accounts' || view === 'hit' ? [] : people,
      hitList: view === 'people' || view === 'accounts' ? [] : hitList(accounts, 50),
      totals: {
        rows: contacts.length,
        accounts: accounts.length,
        people: people.length,
        solutionProviders: accounts.filter((a) => a.firmographic === 'Solution Provider').length,
        endUsers: accounts.filter((a) => a.firmographic === 'End User').length,
        conflicts: accounts.filter((a) => a.conflict).length,
        multiTag: people.filter((p) => p.tags.length > 1).length,
      },
    })
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    if (/\bgzip\b/.test(req.headers.get('accept-encoding') || '')) {
      headers['Content-Encoding'] = 'gzip'
      return new Response(new Uint8Array(gzipSync(body)), { headers })
    }
    return new Response(body, { headers })
  } catch (error: any) {
    console.error('segments error:', error)
    return NextResponse.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 })
  }
}
