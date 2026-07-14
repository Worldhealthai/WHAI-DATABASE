import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AUTH_COOKIE, getPassword, tokenFor } from '@/lib/auth'

// Gate the entire app (pages AND data APIs) behind the shared password.
// Everything except the login page, the auth endpoints, and static assets
// requires a valid session cookie.
export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value
  const expected = await tokenFor(getPassword())

  if (cookie && cookie === expected) {
    return NextResponse.next()
  }

  // API calls get a clean 401 rather than an HTML redirect.
  if (req.nextUrl.pathname.startsWith('/api/')) {
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
