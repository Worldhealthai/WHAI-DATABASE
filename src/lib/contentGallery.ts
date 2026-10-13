// The event photos the card styles with photos draw from: the public
// gallery on worldnexusgroup.com, one brand's or all of them. Kept for a
// few minutes so a page of previews does not ask for it once per card.
import { brandFor } from '@/lib/contentBrand'
import { NEXUS_URL } from '@/lib/marketingSource'

const TTL = 5 * 60 * 1000
const cache = new Map<string, { at: number; photos: string[] }>()

export async function galleryPhotos(series: string): Promise<string[]> {
  const brand = brandFor(series)
  const site = brand === 'nexus' ? 'all' : brand
  const hit = cache.get(site)
  if (hit && Date.now() - hit.at < TTL) return hit.photos
  try {
    const r = await fetch(`${NEXUS_URL}/api/public/gallery?site=${site}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!r.ok) return hit?.photos ?? []
    const j = (await r.json()) as { photos?: { image_url?: string }[] }
    const photos = [...new Set((j.photos ?? []).map((p) => p.image_url || '').filter(Boolean))]
    cache.set(site, { at: Date.now(), photos })
    return photos
  } catch {
    return hit?.photos ?? []
  }
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
