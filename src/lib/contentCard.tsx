// The image for a LinkedIn post: a 1080 by 1080 card in the page's own
// look, as the sites set it. World Health AI on its night blue with the
// heart-pulse mark, World Pharma AI on its night with its logo, World
// Nexus Group on black with the gold emblem. Six layouts (contentBrand):
// the words on the night colour; a block of the brand colour above; an
// event photo behind the words, under a flat scrim; a headshot beside
// them; one large figure; a logo on a light plate. Flat surfaces, one
// accent, sharp corners, Inter: nothing that reads as generated.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { BRANDS, brandFor, type Brand, type CardLayout } from '@/lib/contentBrand'
import type { ContentPost } from '@/lib/contentStudio'
import { designOf, designedCard } from '@/lib/contentDesign'

export const CARD_SIZE = 1080
const PAD = 88
const MUTED = '#C7CBD6'
const FAINT = '#8A93A6'

// Bootstrap Icons' "heart-pulse" (MIT), the mark World Health AI shows beside its name.
const HEART_PULSE = [
  'm8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053.918 3.995.78 5.323 1.508 7H.43c-2.128-5.697 4.165-8.83 7.394-5.857q.09.083.176.171a3 3 0 0 1 .176-.17c3.23-2.974 9.522.159 7.394 5.856h-1.078c.728-1.677.59-3.005.108-3.947C13.486.878 10.4.28 8.717 2.01zM2.212 10h1.315C4.593 11.183 6.05 12.458 8 13.795c1.949-1.337 3.407-2.612 4.473-3.795h1.315c-1.265 1.566-3.14 3.25-5.788 5-2.648-1.75-4.523-3.434-5.788-5',
  'M10.464 3.314a.5.5 0 0 0-.945.049L7.921 8.956 6.464 5.314a.5.5 0 0 0-.88-.091L3.732 8H.5a.5.5 0 0 0 0 1H4a.5.5 0 0 0 .416-.223l1.473-2.209 1.647 4.118a.5.5 0 0 0 .945-.049l1.598-5.593 1.457 3.642A.5.5 0 0 0 12 9h3.5a.5.5 0 0 0 0-1h-3.162z',
]

const ASSETS = join(process.cwd(), 'src/assets')
export type Assets = { regular: Buffer; semibold: Buffer; wpai: string; wng: string }
let assets: Assets | null = null
export async function loadAssets(): Promise<Assets> {
  if (assets) return assets
  const [regular, semibold, wpai, wng] = await Promise.all([
    readFile(join(ASSETS, 'fonts/Inter-Regular.ttf')),
    readFile(join(ASSETS, 'fonts/Inter-SemiBold.ttf')),
    readFile(join(ASSETS, 'wpai-logo.png')),
    readFile(join(ASSETS, 'wng-gold.png')),
  ])
  assets = { regular, semibold, wpai: `data:image/png;base64,${wpai.toString('base64')}`, wng: `data:image/png;base64,${wng.toString('base64')}` }
  return assets
}

// A photo, headshot or logo from the web, as a data URL the renderer can
// draw; null when it cannot be fetched in time, and the card is set
// without it.
export async function remoteImage(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:/i.test(url)) return null
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const type = r.headers.get('content-type') || ''
    if (!/^image\/(jpeg|png|webp)/.test(type)) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.byteLength > 12 * 1024 * 1024) return null
    return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

// The headline shrinks as it lengthens so it stays on three lines or fewer.
function headlineSize(text: string, max = 82): number {
  const n = text.length
  if (n <= 36) return max
  if (n <= 52) return Math.round(max * 0.85)
  if (n <= 70) return Math.round(max * 0.73)
  return Math.round(max * 0.63)
}

type Post = Pick<ContentPost, 'series' | 'kicker' | 'headline' | 'subline' | 'source'>

export function Mark({ brand, assets: a, size = 1 }: { brand: Brand; assets: Assets; size?: number }) {
  if (brand.key === 'pharma') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.wpai} alt="" width={344 * size} height={56 * size} style={{ width: 344 * size, height: 56 * size }} />
  }
  if (brand.key === 'nexus') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.wng} alt="" width={224 * size} height={60 * size} style={{ width: 224 * size, height: 60 * size }} />
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <svg width={48 * size} height={48 * size} viewBox="0 0 16 16" fill={brand.accent} style={{ marginRight: 18 * size }}>
        {HEART_PULSE.map((d) => (
          <path key={d.slice(0, 10)} d={d} />
        ))}
      </svg>
      <span style={{ fontSize: 44 * size, fontWeight: 600, letterSpacing: -1, color: '#fff' }}>{brand.name}</span>
    </div>
  )
}

function Foot({ brand, city, date, light = false, site = true }: { brand: Brand; city: string; date: string; light?: boolean; site?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24, paddingBottom: 56 }}>
      <span style={{ display: 'flex', color: light ? brand.onAccent : MUTED }}>
        {city ? <span style={{ color: light ? brand.onAccent : '#fff', fontWeight: 600 }}>{city}</span> : null}
        {city && date ? <span style={{ margin: '0 14px' }}>·</span> : null}
        {date ? <span style={{ color: light ? brand.onAccent : brand.accent, fontWeight: 600 }}>{date}</span> : null}
      </span>
      {site ? <span style={{ color: light ? brand.onAccent : FAINT }}>{brand.site}</span> : null}
    </div>
  )
}

const Rule = ({ brand }: { brand: Brand }) => <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, background: brand.accent }} />

const Kicker = ({ text, color }: { text: string; color: string }) =>
  text ? <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color, marginBottom: 28 }}>{text}</span> : null

function Words({ post, brand, max = 82, onAccent = false, width = CARD_SIZE - PAD * 2 }: { post: Post; brand: Brand; max?: number; onAccent?: boolean; width?: number }) {
  const ink = onAccent ? brand.onAccent : '#fff'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: width }}>
      <Kicker text={post.kicker} color={onAccent ? brand.onAccent : brand.accent} />
      <span style={{ fontSize: headlineSize(post.headline, max), fontWeight: 600, lineHeight: 1.08, letterSpacing: -2, color: ink }}>{post.headline}</span>
      {post.subline ? <span style={{ fontSize: 30, lineHeight: 1.35, color: onAccent ? brand.onAccent : MUTED, marginTop: 30, maxWidth: width - 60, opacity: onAccent ? 0.8 : 1 }}>{post.subline}</span> : null}
    </div>
  )
}

const page = (brand: Brand, extra: React.CSSProperties = {}): React.CSSProperties => ({
  width: CARD_SIZE, height: CARD_SIZE, display: 'flex', flexDirection: 'column', background: brand.night, color: '#fff', fontFamily: 'Inter', position: 'relative', ...extra,
})

// A soft wash of the brand colour fading into the night: from one corner,
// and a fainter one from the opposite corner, so the ground is not flat.
// The accent's own hex with an alpha, so each brand fades in its colour.
export const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`
// (On a padded page the renderer places an absolute child inside the
// padding, so the wash is pulled back by it to cover the whole card.)
function Wash({ brand, corner = 'top', pad = PAD }: { brand: Brand; corner?: 'top' | 'bottom'; pad?: number }) {
  const from = corner === 'top' ? '160deg' : '340deg'
  const box: React.CSSProperties = { position: 'absolute', top: -pad, left: -pad, width: CARD_SIZE, height: CARD_SIZE }
  return (
    <>
      <div style={{ ...box, background: `linear-gradient(${from}, ${alpha(brand.accent, 0.42)} 0%, ${alpha(brand.accent, 0.14)} 36%, ${alpha(brand.accent, 0)} 64%)` }} />
      <div style={{ ...box, background: `radial-gradient(circle at ${corner === 'top' ? '100% 100%' : '0% 0%'}, ${alpha(brand.accent, 0.16)} 0%, ${alpha(brand.accent, 0)} 48%)` }} />
    </>
  )
}

// ── The layouts ─────────────────────────────────────────────────────────────

function Headline({ post, brand, a, city, date }: LayoutProps) {
  return (
    <div style={page(brand, { padding: `${PAD}px ${PAD}px 0` })}>
      <Wash brand={brand} />
      <Mark brand={brand} assets={a} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
        <Words post={post} brand={brand} />
      </div>
      <Foot brand={brand} city={city} date={date} />
      <Rule brand={brand} />
    </div>
  )
}

// A block of the brand colour above, carrying the mark and the headline in
// the night ink; the subline and the foot on the night below.
function Split({ post, brand, a, city, date }: LayoutProps) {
  return (
    <div style={page(brand)}>
      <div style={{ display: 'flex', flexDirection: 'column', background: brand.accent, color: brand.onAccent, padding: `${PAD}px ${PAD}px 72px`, height: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', opacity: 0.9 }}>
          {brand.key === 'health' ? (
            <>
              <svg width={48} height={48} viewBox="0 0 16 16" fill={brand.onAccent} style={{ marginRight: 18 }}>
                {HEART_PULSE.map((d) => <path key={d.slice(0, 10)} d={d} />)}
              </svg>
              <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>{brand.name}</span>
            </>
          ) : (
            <span style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>{brand.name}</span>
          )}
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: CARD_SIZE - PAD * 2 }}>
            <Kicker text={post.kicker} color={brand.onAccent} />
            <span style={{ fontSize: headlineSize(post.headline, 78), fontWeight: 600, lineHeight: 1.06, letterSpacing: -2 }}>{post.headline}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: `56px ${PAD}px 0`, justifyContent: 'space-between' }}>
        {post.subline ? <span style={{ fontSize: 32, lineHeight: 1.35, color: MUTED, maxWidth: CARD_SIZE - PAD * 2 - 60 }}>{post.subline}</span> : <span />}
        <Foot brand={brand} city={city} date={date} />
      </div>
      <Rule brand={brand} />
    </div>
  )
}

// An event photo across the card under a flat scrim of the night colour,
// the words at the foot where the scrim is deepest.
function Photo({ post, brand, a, city, date, image }: LayoutProps) {
  return (
    <div style={page(brand)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image!} alt="" width={CARD_SIZE} height={CARD_SIZE} style={{ position: 'absolute', top: 0, left: 0, width: CARD_SIZE, height: CARD_SIZE, objectFit: 'cover' }} />
      {/* The scrim: a flat wash of the night, then a fade into it where the words sit (sized in full: the renderer ignores inset). */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: CARD_SIZE, height: CARD_SIZE, background: brand.night, opacity: 0.66 }} />
      <div style={{ position: 'absolute', left: 0, top: CARD_SIZE - 820, width: CARD_SIZE, height: 820, background: `linear-gradient(to bottom, rgba(0,0,0,0), ${brand.night})` }} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: `${PAD}px ${PAD}px 0`, position: 'relative' }}>
        <Mark brand={brand} assets={a} />
        <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', paddingBottom: 48 }}>
          <Words post={post} brand={brand} max={76} />
        </div>
        <Foot brand={brand} city={city} date={date} />
      </div>
      <Rule brand={brand} />
    </div>
  )
}

// A headshot down the right, the words on the left.
function Portrait({ post, brand, a, city, date, image }: LayoutProps) {
  const w = 440
  return (
    <div style={page(brand)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image!} alt="" width={w} height={CARD_SIZE - 14} style={{ position: 'absolute', right: 0, top: 0, width: w, height: CARD_SIZE - 14, objectFit: 'cover' }} />
      <div style={{ position: 'absolute', right: w - 1, top: 0, bottom: 14, width: 1, background: brand.accent, opacity: 0.6 }} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: `${PAD}px 0 0 ${PAD}px`, width: CARD_SIZE - w, position: 'relative' }}>
        <Mark brand={brand} assets={a} size={brand.key === 'health' ? 0.78 : 0.85} />
        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          <Words post={post} brand={brand} max={64} width={CARD_SIZE - w - PAD - 48} />
        </div>
        {/* The narrow column has room for the city and date; the site goes without. */}
        <div style={{ display: 'flex', paddingRight: 48 }}>
          <Foot brand={brand} city={city} date={date} site={false} />
        </div>
      </div>
      <Rule brand={brand} />
    </div>
  )
}

// One large figure in the brand colour, its label as the headline.
function Number_({ post, brand, a, city, date }: LayoutProps) {
  const figure = String(post.source?.figure ?? post.source?.daysToGo ?? '').trim()
  const size = figure.length <= 2 ? 360 : figure.length <= 4 ? 300 : figure.length <= 6 ? 240 : 180
  return (
    <div style={page(brand, { padding: `${PAD}px ${PAD}px 0` })}>
      <Wash brand={brand} corner="bottom" />
      <Mark brand={brand} assets={a} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', paddingBottom: 30 }}>
        <Kicker text={post.kicker} color={brand.accent} />
        <span style={{ fontSize: size, fontWeight: 600, lineHeight: 0.95, letterSpacing: -10, color: brand.accent, fontVariantNumeric: 'tabular-nums' }}>{figure}</span>
        <span style={{ fontSize: headlineSize(post.headline, 56), fontWeight: 600, lineHeight: 1.1, letterSpacing: -1.5, marginTop: 28, maxWidth: CARD_SIZE - PAD * 2 }}>{post.headline}</span>
        {post.subline ? <span style={{ fontSize: 28, lineHeight: 1.35, color: MUTED, marginTop: 22, maxWidth: CARD_SIZE - PAD * 2 - 60 }}>{post.subline}</span> : null}
      </div>
      <Foot brand={brand} city={city} date={date} />
      <Rule brand={brand} />
    </div>
  )
}

// A logo on a light plate, as the sites keep partner logos, the words below.
function Logo({ post, brand, a, city, date, image }: LayoutProps) {
  return (
    <div style={page(brand, { padding: `${PAD}px ${PAD}px 0` })}>
      <Wash brand={brand} />
      <Mark brand={brand} assets={a} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', paddingBottom: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: CARD_SIZE - PAD * 2, height: 300, background: '#F4F6FA', marginBottom: 48 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image!} alt="" width={640} height={200} style={{ width: 640, height: 200, objectFit: 'contain' }} />
        </div>
        <Words post={post} brand={brand} max={60} />
      </div>
      <Foot brand={brand} city={city} date={date} />
      <Rule brand={brand} />
    </div>
  )
}

// One line from the piece, set large between quotation marks in the brand
// colour; the headline beneath it, smaller, says what it is from.
function Quote({ post, brand, a, city, date }: LayoutProps) {
  const quote = String(post.source?.quote ?? '').trim()
  const size = quote.length <= 60 ? 64 : quote.length <= 90 ? 54 : 46
  return (
    <div style={page(brand, { padding: `${PAD}px ${PAD}px 0` })}>
      <Wash brand={brand} corner="bottom" />
      <Mark brand={brand} assets={a} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', paddingBottom: 30 }}>
        <Kicker text={post.kicker} color={brand.accent} />
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `10px solid ${brand.accent}`, paddingLeft: 40 }}>
          <span style={{ fontSize: size, fontWeight: 600, lineHeight: 1.18, letterSpacing: -1.5, color: '#fff', maxWidth: CARD_SIZE - PAD * 2 - 50 }}>{quote}</span>
          <span style={{ fontSize: 28, lineHeight: 1.35, color: MUTED, marginTop: 30, maxWidth: CARD_SIZE - PAD * 2 - 110 }}>{post.headline}</span>
        </div>
      </div>
      <Foot brand={brand} city={city} date={date} />
      <Rule brand={brand} />
    </div>
  )
}

interface LayoutProps { post: Post; brand: Brand; a: Assets; city: string; date: string; image: string | null }

// The layout the post asks for, or the one it can have: a photo, headshot
// or logo layout without its image falls back to the words alone.
export function layoutOf(post: Post): CardLayout {
  const asked = String(post.source?.layout ?? 'headline') as CardLayout
  return (['headline', 'split', 'photo', 'portrait', 'number', 'logo', 'quote'] as CardLayout[]).includes(asked) ? asked : 'headline'
}

export async function renderCard(post: Post, layoutOverride?: CardLayout): Promise<ImageResponse> {
  const brand = BRANDS[brandFor(post.series)]
  const a = await loadAssets()
  const city = String(post.source?.city ?? '').trim()
  const date = String(post.source?.date ?? '').trim()
  let layout = layoutOverride ?? layoutOf(post)
  const wants = layout === 'photo' ? post.source?.photo : layout === 'portrait' ? post.source?.image : layout === 'logo' ? post.source?.logo : null
  const image = await remoteImage(typeof wants === 'string' ? wants : null)
  if ((layout === 'photo' || layout === 'portrait' || layout === 'logo') && !image) layout = 'split'
  if (layout === 'number' && !String(post.source?.figure ?? post.source?.daysToGo ?? '').trim()) layout = 'headline'
  if (layout === 'quote' && !String(post.source?.quote ?? '').trim()) layout = 'headline'
  // A designed card (the Design button) replaces the layout until the
  // layout is chosen again.
  const design = layoutOverride ? null : designOf(post)
  if (design) {
    return new ImageResponse(await designedCard(post, a, design), {
      width: CARD_SIZE,
      height: CARD_SIZE,
      fonts: [
        { name: 'Inter', data: a.regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: a.semibold, weight: 600, style: 'normal' },
      ],
    })
  }
  const props: LayoutProps = { post, brand, a, city, date, image }
  const body =
    layout === 'quote' ? <Quote {...props} />
    : layout === 'split' ? <Split {...props} />
    : layout === 'photo' ? <Photo {...props} />
    : layout === 'portrait' ? <Portrait {...props} />
    : layout === 'number' ? <Number_ {...props} />
    : layout === 'logo' ? <Logo {...props} />
    : <Headline {...props} />

  return new ImageResponse(body, {
    width: CARD_SIZE,
    height: CARD_SIZE,
    fonts: [
      { name: 'Inter', data: a.regular, weight: 400, style: 'normal' },
      { name: 'Inter', data: a.semibold, weight: 600, style: 'normal' },
    ],
  })
}
