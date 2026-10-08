// GET /api/linkedin/connect → LinkedIn's sign-in, to let the CRM post to the
// company pages. Opened in its own tab (LinkedIn will not show inside the
// admin panel's frame); the callback closes the loop.
import { NextRequest, NextResponse } from 'next/server'
import { authUrl, linkedinConfigured } from '@/lib/linkedin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!linkedinConfigured()) {
    return new NextResponse('LinkedIn is not set up yet: add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to the CRM in Vercel, then redeploy.', { status: 400 })
  }
  const state = crypto.randomUUID()
  const res = NextResponse.redirect(authUrl(state, req.nextUrl.origin))
  res.cookies.set('li_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/linkedin', maxAge: 600 })
  return res
}
