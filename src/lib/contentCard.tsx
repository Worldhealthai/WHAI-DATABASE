// The image for a LinkedIn post: a 1080 by 1080 card in the brand's own
// look, as the event sites set it. World Health AI on its night blue with
// the heart-pulse mark, World Pharma AI on its night with its logo; the
// kicker in the brand colour, the headline large, the subline under it,
// and the city, date and site along the foot. Flat surfaces, one accent,
// sharp corners, Inter: nothing that reads as generated.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import type { ContentPost } from '@/lib/contentStudio'

export const CARD_SIZE = 1080

// Bootstrap Icons' "heart-pulse" (MIT), the mark World Health AI shows beside its name.
const HEART_PULSE = [
  'm8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053.918 3.995.78 5.323 1.508 7H.43c-2.128-5.697 4.165-8.83 7.394-5.857q.09.083.176.171a3 3 0 0 1 .176-.17c3.23-2.974 9.522.159 7.394 5.856h-1.078c.728-1.677.59-3.005.108-3.947C13.486.878 10.4.28 8.717 2.01zM2.212 10h1.315C4.593 11.183 6.05 12.458 8 13.795c1.949-1.337 3.407-2.612 4.473-3.795h1.315c-1.265 1.566-3.14 3.25-5.788 5-2.648-1.75-4.523-3.434-5.788-5',
  'M10.464 3.314a.5.5 0 0 0-.945.049L7.921 8.956 6.464 5.314a.5.5 0 0 0-.88-.091L3.732 8H.5a.5.5 0 0 0 0 1H4a.5.5 0 0 0 .416-.223l1.473-2.209 1.647 4.118a.5.5 0 0 0 .945-.049l1.598-5.593 1.457 3.642A.5.5 0 0 0 12 9h3.5a.5.5 0 0 0 0-1h-3.162z',
]

interface Brand { key: 'health' | 'pharma'; name: string; night: string; accent: string; site: string }
const BRANDS: Record<Brand['key'], Brand> = {
  health: { key: 'health', name: 'World Health AI', night: '#0A0F1D', accent: '#6A8DFF', site: 'worldhealth.ai' },
  pharma: { key: 'pharma', name: 'World Pharma AI', night: '#070B16', accent: '#2CC7B4', site: 'worldpharma.ai' },
}
const brandFor = (series: string): Brand => (/pharma/i.test(series) ? BRANDS.pharma : BRANDS.health)

const ASSETS = join(process.cwd(), 'src/assets')
let assets: { regular: Buffer; semibold: Buffer; logo: string } | null = null
async function loadAssets() {
  if (assets) return assets
  const [regular, semibold, logo] = await Promise.all([
    readFile(join(ASSETS, 'fonts/Inter-Regular.ttf')),
    readFile(join(ASSETS, 'fonts/Inter-SemiBold.ttf')),
    readFile(join(ASSETS, 'wpai-logo.png')),
  ])
  assets = { regular, semibold, logo: `data:image/png;base64,${logo.toString('base64')}` }
  return assets
}

// The headline shrinks as it lengthens so it stays on three lines or fewer.
function headlineSize(text: string): number {
  const n = text.length
  if (n <= 36) return 82
  if (n <= 52) return 70
  if (n <= 70) return 60
  return 52
}

export async function renderCard(post: Pick<ContentPost, 'series' | 'kicker' | 'headline' | 'subline' | 'source'>): Promise<ImageResponse> {
  const brand = brandFor(post.series)
  const { regular, semibold, logo } = await loadAssets()
  const city = String(post.source?.city ?? '').trim()
  const date = String(post.source?.date ?? '').trim()
  const pad = 88

  return new ImageResponse(
    (
      <div
        style={{
          width: CARD_SIZE,
          height: CARD_SIZE,
          display: 'flex',
          flexDirection: 'column',
          background: brand.night,
          color: '#ffffff',
          fontFamily: 'Inter',
          padding: `${pad}px ${pad}px 0`,
          position: 'relative',
        }}
      >
        {/* The mark and the name */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {brand.key === 'pharma' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" width={344} height={56} style={{ width: 344, height: 56 }} />
          ) : (
            <>
              <svg width={48} height={48} viewBox="0 0 16 16" fill={brand.accent} style={{ marginRight: 18 }}>
                {HEART_PULSE.map((d) => (
                  <path key={d.slice(0, 10)} d={d} />
                ))}
              </svg>
              <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>{brand.name}</span>
            </>
          )}
        </div>

        {/* The words */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
          {post.kicker ? (
            <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: brand.accent, marginBottom: 28 }}>{post.kicker}</span>
          ) : null}
          <span style={{ fontSize: headlineSize(post.headline), fontWeight: 600, lineHeight: 1.08, letterSpacing: -2, maxWidth: CARD_SIZE - pad * 2 }}>{post.headline}</span>
          {post.subline ? (
            <span style={{ fontSize: 30, lineHeight: 1.35, color: '#C7CBD6', marginTop: 30, maxWidth: CARD_SIZE - pad * 2 - 60 }}>{post.subline}</span>
          ) : null}
        </div>

        {/* The foot: city and date, the site, a rule in the brand colour */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 56, fontSize: 24 }}>
          <span style={{ display: 'flex', gap: 14, color: '#C7CBD6' }}>
            {city ? <span style={{ color: '#ffffff', fontWeight: 600 }}>{city}</span> : null}
            {city && date ? <span>·</span> : null}
            {date ? <span style={{ color: brand.accent, fontWeight: 600 }}>{date}</span> : null}
          </span>
          <span style={{ color: '#8A93A6' }}>{brand.site}</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, background: brand.accent }} />
      </div>
    ),
    {
      width: CARD_SIZE,
      height: CARD_SIZE,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: semibold, weight: 600, style: 'normal' },
      ],
    }
  )
}
