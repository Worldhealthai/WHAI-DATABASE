import { NextResponse } from 'next/server'
import { AUTH_COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ success: true })
  // Attributes must match the login cookie for the browser to clear it,
  // including in the embedded (iframe) context.
  const secure = process.env.NODE_ENV === 'production'
  res.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
