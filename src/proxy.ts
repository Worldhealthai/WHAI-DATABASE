import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AUTH_COOKIE, getPassword, tokenFor } from '@/lib/auth'

// Gate the entire app (pages AND data APIs) behind the shared password.
// Everything except the login page, the auth endpoints, and static assets
// requires a valid session cookie.
export async function proxy(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value
  const expected = await tokenFor(getPassword())

  if (cookie && cookie === expected) {
    // The session cookie is SameSite=None so it works inside the admin-panel
    // iframe. That means browsers would also attach it to requests forged by
    // other websites — so for data-changing API calls, require the request to
    // originate from the CRM itself. (The iframe's own fetches pass this:
    // the embedded document's origin IS the CRM's origin.)
    if (req.nextUrl.pathname.startsWith('/api/') && req.method !== 'GET') {
      const origin = req.headers.get('origin')
      if (origin) {
        try {
          if (new URL(origin).host !== req.nextUrl.host) {
            return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
          }
        } catch {
          return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
        }
      }
    }
    return NextResponse.next()
  }

  // API calls get a clean 401 rather than an HTML redirect — unless they
  // carry the shared webhook secret. That's how server-to-server automation
  // authenticates (website registration webhooks, the Nexus admin's
  // "Add to CRM" staging) — those callers have no browser session.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // Control Room and its agents read through a key of their own
    // (AGENT_READ_TOKEN), so they never hold the shared secret. It opens two
    // read-only things, GET only: the event status, and a post's finished
    // design (so Control Room can show it). Nothing else.
    const agentKey = (process.env.AGENT_READ_TOKEN || '').trim()
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const readable =
      req.nextUrl.pathname === '/api/routine/event' || /^\/api\/marketing\/content\/[A-Za-z0-9_-]+\/image$/.test(req.nextUrl.pathname)
    if (agentKey && bearer && bearer === agentKey && req.method === 'GET' && readable) {
      return NextResponse.next()
    }
    const secret = (process.env.WEBHOOK_SECRET || '').trim()
    const provided = (req.headers.get('x-webhook-secret') || '').trim()
    if (secret && provided && provided === secret) {
      return NextResponse.next()
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  const from = req.nextUrl.pathname + req.nextUrl.search
  if (from && from !== '/') url.searchParams.set('from', from)
  return NextResponse.redirect(url)
}

export const config = {
  // Protect all routes except: the login page, the auth endpoints, Next.js
  // internals, and common static asset extensions.
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)',
  ],
}
