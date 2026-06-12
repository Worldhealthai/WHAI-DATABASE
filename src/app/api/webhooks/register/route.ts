import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Public registration webhook.
// Your website posts here whenever someone registers as a delegate or speaker.
//
// POST /api/webhooks/register
// Headers: x-webhook-secret: <WEBHOOK_SECRET env var>
// Body: {
//   "type": "delegate" | "speaker",
//   "firstName": "...", "lastName": "...", "email": "...",
//   "phone": "...", "organization": "...", "jobTitle": "...",
//   "country": "...", "city": "...", "event": "UK Forum" | "US Forum",
//   "subType": "End User" | "Solution Provider",
//   "linkedinUrl": "...", "notes": "..."
// }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Health check — open this URL in a browser to verify the deployment is live
// and the env vars are configured. Reports presence only, never values.
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: 'POST /api/webhooks/register',
      secretConfigured: Boolean(process.env.WEBHOOK_SECRET?.trim()),
      supabaseConfigured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      ),
    },
    { headers: CORS_HEADERS },
  )
}

export async function POST(req: NextRequest) {
  try {
    // Auth: require the shared secret when one is configured.
    // Both sides are trimmed so a stray space/newline pasted into Vercel
    // can't cause a mismatch.
    const secret = process.env.WEBHOOK_SECRET?.trim()
    if (secret && req.headers.get('x-webhook-secret')?.trim() !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const body = await req.json()
    const type = body.type === 'speaker' ? 'speaker' : 'delegate'

    if (!body.email && !(body.firstName && body.lastName)) {
      return NextResponse.json(
        { error: 'email or firstName + lastName required' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const common = {
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      organization: body.organization ?? null,
      jobTitle: body.jobTitle ?? null,
      country: body.country ?? null,
      city: body.city ?? null,
      event: body.event ?? null,
      subType: body.subType ?? null,
      linkedinUrl: body.linkedinUrl ?? null,
      notes: body.notes ?? null,
    }

    const table = type === 'speaker' ? 'speakers' : 'delegates'
    const record = type === 'speaker'
      ? { ...common, status: 'Not Contacted', tags: 'Website Registration' }
      : { ...common, status: 'Registered', source: 'Website', tags: 'Website Registration' }

    // Skip if this email already exists in the table (idempotent)
    if (body.email) {
      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq('email', body.email)
        .limit(1)
      if (existing?.length) {
        return NextResponse.json(
          { ok: true, duplicate: true, id: existing[0].id, message: 'Already registered — skipped.' },
          { status: 200, headers: CORS_HEADERS },
        )
      }
    }

    const { data, error } = await supabase.from(table).insert(record).select('id').single()
    if (error) throw error

    return NextResponse.json({ ok: true, id: data.id }, { status: 201, headers: CORS_HEADERS })
  } catch (error: any) {
    if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
      return NextResponse.json(
        { ok: true, duplicate: true, message: 'Already registered — skipped.' },
        { status: 200, headers: CORS_HEADERS },
      )
    }
    console.error('Registration webhook error:', error)
    // Include a short detail so the calling site's logs show the root cause
    // (e.g. a missing column) instead of an opaque 500.
    const detail = (error?.message || String(error)).slice(0, 300)
    return NextResponse.json({ error: 'Internal server error', detail }, { status: 500, headers: CORS_HEADERS })
  }
}
