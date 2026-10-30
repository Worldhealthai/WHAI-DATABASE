// How a brand's LinkedIn page and its posts are doing, read live from
// LinkedIn (the Marketing area's Post analytics). LinkedIn keeps the
// figures, for the past 12 months: nothing is stored here.
//   - the page's followers (networkSizes) and new followers a day
//     (organizationalEntityFollowerStatistics; LinkedIn has these up to two
//     days ago)
//   - the page's impressions, clicks and engagement a day
//     (organizationalEntityShareStatistics with timeIntervals)
//   - the posts the page put up in the period (posts by author), each with
//     its lifetime figures (organizationalEntityShareStatistics by post),
//     and the Content tab draft it came from, when it went up from the CRM
// Organic only: sponsored activity is not counted. Needs the connection's
// rw_organization_admin and r_organization_social scopes, which "Connect
// LinkedIn" asks for.

import { supabase } from '@/lib/supabase'
import type { BrandKey } from '@/lib/contentBrand'
import { LinkedInError, api, liveToken, type LinkedInPage } from '@/lib/linkedin'

interface Totals { clickCount?: number; commentCount?: number; engagement?: number; impressionCount?: number; uniqueImpressionsCount?: number; likeCount?: number; shareCount?: number }

export interface DayFigures { day: string; impressions: number; clicks: number; reactions: number; comments: number; reposts: number; newFollowers: number | null }
export interface PostFigures {
  urn: string
  url: string
  text: string
  publishedAt: string | null
  impressions: number
  clicks: number
  reactions: number
  comments: number
  reposts: number
  engagementRate: number | null
  crm: { id: string; headline: string; kind: string } | null
}
export interface PageAnalytics {
  page: LinkedInPage
  days: number
  followers: number | null
  daily: DayFigures[]
  totals: { impressions: number; clicks: number; reactions: number; comments: number; reposts: number; engagementRate: number | null; newFollowers: number | null }
  posts: PostFigures[]
  read: string
}

const DAY = 86400000
const enc = encodeURIComponent
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const rate = (t: { impressions: number; clicks: number; reactions: number; comments: number; reposts: number }) =>
  t.impressions > 0 ? (t.clicks + t.reactions + t.comments + t.reposts) / t.impressions : null

// What a post's commentary reads as: LinkedIn's little text without its markup.
function plainText(little: string): string {
  return little
    .replace(/\{hashtag\|\\?#\|([^}]+)\}/g, '#$1')
    .replace(/@\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\\([\\|{}@[\]()<>#*_~])/g, '$1')
    .trim()
}

export async function pageAnalytics(brand: BrandKey, days: number): Promise<PageAnalytics> {
  const { token: t, conn } = await liveToken()
  const org = conn.page_for[brand]
  const page = conn.pages.find((p) => p.urn === org)
  if (!org || !page) throw new LinkedInError('Choose which LinkedIn page this brand posts to, at the top of the Content tab.', 409)
  const end = Math.floor(Date.now() / DAY) * DAY
  const start = end - days * DAY
  const window = `(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`
  const orgQ = `q=organizationalEntity&organizationalEntity=${enc(org)}`

  const [size, shareDays, followerDays, found] = await Promise.all([
    api<{ firstDegreeSize?: number }>(t, `/networkSizes/${enc(org)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`).then((r) => r.data.firstDegreeSize ?? null).catch(() => null),
    api<{ elements?: { timeRange?: { start: number }; totalShareStatistics?: Totals }[] }>(t, `/organizationalEntityShareStatistics?${orgQ}&timeIntervals=${window}`),
    api<{ elements?: { timeRange?: { start: number }; followerGains?: { organicFollowerGain?: number; paidFollowerGain?: number } }[] }>(t, `/organizationalEntityFollowerStatistics?${orgQ}&timeIntervals=${window}`)
      .then((r) => r.data.elements ?? [])
      .catch(() => null),
    api<{ elements?: { id: string; commentary?: string; publishedAt?: number; createdAt?: number; lifecycleState?: string }[] }>(
      t,
      `/posts?author=${enc(org)}&q=author&count=100&sortBy=CREATED`,
      { restliMethod: 'FINDER' },
    ),
  ])

  // A day for each day of the period, so a quiet day shows as a nought.
  const byDay = new Map<number, DayFigures>()
  for (let d = start; d < end; d += DAY) {
    byDay.set(d, { day: new Date(d).toISOString().slice(0, 10), impressions: 0, clicks: 0, reactions: 0, comments: 0, reposts: 0, newFollowers: followerDays ? 0 : null })
  }
  for (const e of shareDays.data.elements ?? []) {
    const row = e.timeRange && byDay.get(Math.floor(e.timeRange.start / DAY) * DAY)
    if (!row) continue
    const s = e.totalShareStatistics ?? {}
    Object.assign(row, { impressions: n(s.impressionCount), clicks: n(s.clickCount), reactions: Math.max(0, n(s.likeCount)), comments: n(s.commentCount), reposts: n(s.shareCount) })
  }
  // LinkedIn has new followers up to two days ago: later days stay unknown.
  const lastFollowerDay = end - 2 * DAY
  for (const row of byDay.values()) if (followerDays && Date.parse(row.day) >= lastFollowerDay) row.newFollowers = null
  for (const e of followerDays ?? []) {
    const row = e.timeRange && byDay.get(Math.floor(e.timeRange.start / DAY) * DAY)
    if (row) row.newFollowers = n(e.followerGains?.organicFollowerGain) + n(e.followerGains?.paidFollowerGain)
  }
  const daily = [...byDay.values()]

  // The posts put up in the period, newest first.
  const posts = (found.data.elements ?? [])
    .filter((p) => p.lifecycleState === 'PUBLISHED' && (p.publishedAt ?? p.createdAt ?? 0) >= start)
    .sort((a, b) => (b.publishedAt ?? b.createdAt ?? 0) - (a.publishedAt ?? a.createdAt ?? 0))

  // Each post's lifetime figures, twenty at a time. A post LinkedIn leaves
  // out has had no impressions yet.
  const stats = new Map<string, Totals>()
  for (let i = 0; i < posts.length; i += 20) {
    const batch = posts.slice(i, i + 20).map((p) => p.id)
    const shares = batch.filter((u) => u.startsWith('urn:li:share:'))
    const ugc = batch.filter((u) => u.startsWith('urn:li:ugcPost:'))
    const list = (us: string[]) => `List(${us.map(enc).join(',')})`
    const q = [shares.length ? `shares=${list(shares)}` : '', ugc.length ? `ugcPosts=${list(ugc)}` : ''].filter(Boolean).join('&')
    if (!q) continue
    const { data } = await api<{ elements?: { share?: string; ugcPost?: string; totalShareStatistics?: Totals }[] }>(t, `/organizationalEntityShareStatistics?${orgQ}&${q}`)
    for (const e of data.elements ?? []) stats.set(e.share || e.ugcPost || '', e.totalShareStatistics ?? {})
  }

  // The Content tab draft each post came from, when it went up from the CRM.
  const urns = posts.map((p) => p.id)
  const fromCrm = new Map<string, PostFigures['crm']>()
  if (urns.length) {
    const { data } = await supabase.from('marketing_content').select('id, headline, kind, source').in('source->linkedin->>urn', urns)
    for (const row of data ?? []) {
      const urn = (row.source as { linkedin?: { urn?: string } })?.linkedin?.urn
      if (urn) fromCrm.set(urn, { id: row.id, headline: row.headline, kind: row.kind })
    }
  }

  const figures: PostFigures[] = posts.map((p) => {
    const s = stats.get(p.id) ?? {}
    const f = { impressions: n(s.impressionCount), clicks: n(s.clickCount), reactions: Math.max(0, n(s.likeCount)), comments: n(s.commentCount), reposts: n(s.shareCount) }
    const at = p.publishedAt ?? p.createdAt
    return { urn: p.id, url: `https://www.linkedin.com/feed/update/${p.id}/`, text: plainText(p.commentary ?? ''), publishedAt: at ? new Date(at).toISOString() : null, ...f, engagementRate: rate(f), crm: fromCrm.get(p.id) ?? null }
  })

  const sum = (k: 'impressions' | 'clicks' | 'reactions' | 'comments' | 'reposts') => daily.reduce((a, d) => a + d[k], 0)
  const totals = { impressions: sum('impressions'), clicks: sum('clicks'), reactions: sum('reactions'), comments: sum('comments'), reposts: sum('reposts') }
  const gains = daily.filter((d) => d.newFollowers !== null)
  return {
    page,
    days,
    followers: size,
    daily,
    totals: { ...totals, engagementRate: rate(totals), newFollowers: followerDays ? gains.reduce((a, d) => a + (d.newFollowers ?? 0), 0) : null },
    posts: figures,
    read: new Date().toISOString(),
  }
}
