import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, getPassword, tokenFor } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    if (typeof password !== 'string' || password !== getPassword()) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    const token = await tokenFor(getPassword())
    const res = NextResponse.json({ success: true })
    // SameSite=None so the session cookie also works when the CRM is embedded
    // in an iframe (e.g. inside the admin panel). None requires Secure, so we
    // fall back to Lax in local http dev where Secure cookies are rejected.
    const secure = process.env.NODE_ENV === 'production'
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
