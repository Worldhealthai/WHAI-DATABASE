// GET /api/segments?events=<label>&events=… — the edition in two layers
// (or ?scope=all: every event, for the directory)
// (lib/segments): companies with their firmographic, people with their
// event tags, and the Solution Provider hit list. Read only.
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
    return NextResponse.json({
      accounts,
      people,
      hitList: hitList(accounts, 50),
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
  } catch (error: any) {
    console.error('segments error:', error)
    return NextResponse.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 })
  }
}
