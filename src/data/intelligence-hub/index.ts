import marketPulse from './2025-market-pulse-collection.json'
import deepDives from './2025-deep-dives-collection.json'
import dataSnapshots from './2025-data-snapshots-collection.json'
import q1Report from './q1-2025-healthcare-ai-market-pulse.json'

export interface HubArticle {
  id?: string
  title: string
  slug: string
  excerpt: string
  content: string
  content_type: string
  category?: string
  date?: string
  author?: string
  keywords?: string
  status?: string
  tags?: string[]
  image?: string
  thumbnail_url?: string
  newsletter_featured?: boolean
  report_quarter?: string
}

function toArray(data: unknown): HubArticle[] {
  return (Array.isArray(data) ? data : [data]) as HubArticle[]
}

export const ALL_HUB_ARTICLES: HubArticle[] = [
  ...toArray(marketPulse),
  ...toArray(deepDives),
  ...toArray(dataSnapshots),
  ...toArray(q1Report),
].filter((i) => !i.status || i.status === 'published')

export function getHubArticle(slug: string): HubArticle | undefined {
  return ALL_HUB_ARTICLES.find((a) => a.slug === slug)
}
