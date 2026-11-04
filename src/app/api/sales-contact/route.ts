// POST /api/sales-contact { company, event, firstName, lastName, jobTitle,
// email, phone } — a Solution Provider's person into Sales for the edition,
// from Companies or Contacts (lib/salesContact).
import { NextRequest, NextResponse } from 'next/server'
import { addToSales } from '@/lib/salesContact'

export const dynamic = 'force-dynamic'

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null)
  const company = str(b?.company), event = str(b?.event)
  if (!company || !event) return NextResponse.json({ error: 'Company and event are needed' }, { status: 400 })
  try {
    const r = await addToSales({
      company, event, tags: 'Added from Companies',
      person: { firstName: str(b?.firstName), lastName: str(b?.lastName), jobTitle: str(b?.jobTitle), email: str(b?.email), phone: str(b?.phone) },
    })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not add them' }, { status: 500 })
  }
}
