// GET /api/linkedin/callback?code&state → where LinkedIn sends the browser
// back after "Connect LinkedIn". Stores the connection and says so.
import { NextRequest, NextResponse } from 'next/server'
import { connect } from '@/lib/linkedin'

export const dynamic = 'force-dynamic'

const page = (title: string, body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 20px;color:#1f2937">` +
      `<h1 style="font-size:20px">${title}</h1><p style="line-height:1.55">${body}</p></body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  if (q.get('error')) return page('LinkedIn was not connected', esc(q.get('error_description') || q.get('error') || 'The sign-in was cancelled.'), 400)
  const state = q.get('state')
  if (!state || state !== req.cookies.get('li_state')?.value) return page('LinkedIn was not connected', 'The sign-in could not be matched to this browser. Start again from the Content tab.', 400)
  const code = q.get('code')
  if (!code) return page('LinkedIn was not connected', 'LinkedIn sent no code back. Start again from the Content tab.', 400)
  try {
    const conn = await connect(code, req.nextUrl.origin)
    const res = page(
      'LinkedIn connected',
      conn.pages.length
        ? `The CRM can post to ${conn.pages.map((p) => esc(p.name)).join(', ')}. Close this tab and check, at the top of the Content tab, which page each brand posts to.`
        : `Connected, but no company pages came back${conn.pages_error ? ` (${esc(conn.pages_error)})` : ''}. The signed-in person must be an admin of the pages, and the app needs the Community Management API approved.`,
    )
    res.cookies.delete({ name: 'li_state', path: '/api/linkedin' })
    return res
  } catch (e) {
    return page('LinkedIn was not connected', esc(e instanceof Error ? e.message : String(e)), 500)
  }
}
