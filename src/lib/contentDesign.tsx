// "Design": a richer card for a post now and then, beyond the everyday
// layouts (lib/contentCard): event photos from the group's gallery, a
// photo mosaic, a magazine cover, an editorial frame, or a geometric
// spotlight. Each press of Design moves to the next one with fresh photos,
// stored on the post as source.design, so the image route, the download
// and Approve and post all draw the same thing. Same brand, same Inter,
// same accent: richer, not off-brand.

import { BRANDS, brandFor, type Brand, type BrandKey } from '@/lib/contentBrand'
import { Mark, alpha, remoteImage, type Assets } from '@/lib/contentCard'
import { NEXUS_URL } from '@/lib/marketingSource'
import type { ContentPost } from '@/lib/contentStudio'

export type DesignStyle = 'cinematic' | 'mosaic' | 'framed' | 'magazine' | 'spotlight'
export const DESIGN_STYLES: { value: DesignStyle; label: string; photos: number }[] = [
  { value: 'cinematic', label: 'Cinematic photo', photos: 1 },
  { value: 'mosaic', label: 'Photo mosaic', photos: 3 },
  { value: 'magazine', label: 'Magazine cover', photos: 1 },
  { value: 'framed', label: 'Editorial frame', photos: 1 },
  { value: 'spotlight', label: 'Spotlight', photos: 0 },
]
export interface Design { style: DesignStyle; photos: string[] }

type Post = Pick<ContentPost, 'series' | 'kicker' | 'headline' | 'subline' | 'source'>

export const designOf = (post: Post): Design | null => {
  const d = (post.source as { design?: Design } | null)?.design
  return d && DESIGN_STYLES.some((s) => s.value === d.style) ? { style: d.style, photos: Array.isArray(d.photos) ? d.photos : [] } : null
}

// ── Choosing the next design ───────────────────────────────────────────────

async function galleryPhotos(brand: BrandKey): Promise<string[]> {
  try {
    const r = await fetch(`${NEXUS_URL}/api/public/gallery?site=${brand === 'nexus' ? 'all' : brand}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const j = (await r.json()) as { photos?: { image_url?: string }[] }
    return (j.photos ?? []).map((p) => p.image_url || '').filter(Boolean)
  } catch {
    return []
  }
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// The design after the current one (or after the given style), with photos
// it has not just used. Without photos only the spotlight is possible.
export async function nextDesign(post: Post, wanted?: DesignStyle | null): Promise<Design> {
  const cur = designOf(post)
  const photos = await galleryPhotos(brandFor(post.series))
  const usable = DESIGN_STYLES.filter((s) => s.photos <= photos.length)
  const style =
    (wanted && usable.find((s) => s.value === wanted)?.value) ||
    usable[(usable.findIndex((s) => s.value === cur?.style) + 1) % usable.length]?.value ||
    'spotlight'
  const fresh = photos.filter((p) => !cur?.photos.includes(p))
  const pool = shuffle(fresh.length >= 3 ? fresh : photos)
  return { style, photos: pool.slice(0, DESIGN_STYLES.find((s) => s.value === style)!.photos) }
}

// ── Drawing ────────────────────────────────────────────────────────────────

const MUTED = '#C7CBD6'
const FAINT = '#8A93A6'
const PAD = 80
const W = 1080 // the card's size (contentCard's CARD_SIZE; not imported, as that module imports this one)

const full = (extra: React.CSSProperties = {}): React.CSSProperties => ({ position: 'absolute', top: 0, left: 0, width: W, height: W, ...extra })

function size(text: string, max: number): number {
  const n = text.length
  if (n <= 32) return max
  if (n <= 48) return Math.round(max * 0.86)
  if (n <= 66) return Math.round(max * 0.74)
  return Math.round(max * 0.64)
}

const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()

function KickerBar({ text, brand }: { text: string; brand: Brand }) {
  if (!text) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 26 }}>
      <div style={{ width: 44, height: 6, background: brand.accent, marginRight: 18 }} />
      <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: brand.accent }}>{text}</span>
    </div>
  )
}

function Img({ src, w, h, style }: { src: string; w: number; h: number; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={w} height={h} style={{ width: w, height: h, objectFit: 'cover', ...style }} />
}

// A full-bleed event photo, tinted towards the brand and fading into the
// night, a fine frame inside the edge, the headline large at the foot.
function Cinematic({ post, brand, a, photos }: DrawProps) {
  return (
    <div style={{ width: W, height: W, display: 'flex', position: 'relative', background: brand.night, fontFamily: 'Inter', color: '#fff' }}>
      <Img src={photos[0]} w={W} h={W} style={{ position: 'absolute', top: 0, left: 0 }} />
      <div style={full({ background: brand.night, opacity: 0.42 })} />
      <div style={full({ background: `linear-gradient(200deg, ${alpha(brand.accent, 0.38)} 0%, ${alpha(brand.accent, 0)} 45%)` })} />
      <div style={full({ background: `linear-gradient(to bottom, ${alpha(brand.night, 0)} 25%, ${alpha(brand.night, 0.92)} 68%, ${brand.night} 100%)` })} />
      <div style={{ position: 'absolute', top: 36, left: 36, width: W - 72, height: W - 72, border: `1px solid ${alpha('#FFFFFF', 0.28)}` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: W, display: 'flex', flexDirection: 'column', padding: `${PAD}px ${PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Mark brand={brand} assets={a} size={0.9} />
          <span style={{ fontSize: 20, letterSpacing: 3, color: MUTED, fontWeight: 600 }}>{today()}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 92, width: W - PAD * 2 }}>
          <KickerBar text={post.kicker} brand={brand} />
          <span style={{ fontSize: size(post.headline, 92), fontWeight: 600, lineHeight: 1.04, letterSpacing: -2.5 }}>{post.headline}</span>
          {post.subline ? <span style={{ fontSize: 30, lineHeight: 1.35, color: MUTED, marginTop: 26, maxWidth: W - PAD * 2 - 80 }}>{post.subline}</span> : null}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: W - 14, width: W, height: 14, background: brand.accent }} />
    </div>
  )
}

// Three event photos as a mosaic above, the words on the night below.
function Mosaic({ post, brand, a, photos }: DrawProps) {
  const top = 560
  const gap = 10
  const bigW = 640
  const smallW = W - bigW - gap
  const smallH = (top - gap) / 2
  return (
    <div style={{ width: W, height: W, display: 'flex', flexDirection: 'column', position: 'relative', background: brand.night, fontFamily: 'Inter', color: '#fff' }}>
      <div style={{ display: 'flex', width: W, height: top }}>
        <Img src={photos[0]} w={bigW} h={top} />
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: gap }}>
          <Img src={photos[1] ?? photos[0]} w={smallW} h={smallH} />
          <Img src={photos[2] ?? photos[0]} w={smallW} h={smallH} style={{ marginTop: gap }} />
        </div>
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: top, background: `linear-gradient(to bottom, ${alpha(brand.night, 0)} 55%, ${alpha(brand.night, 0.85)} 100%)` }} />
      <div style={{ position: 'absolute', top: top - 64, left: PAD, display: 'flex', alignItems: 'center', background: brand.accent, padding: '14px 22px' }}>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: brand.onAccent }}>{post.kicker || brand.name}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: `52px ${PAD}px 0`, width: W }}>
        <span style={{ fontSize: size(post.headline, 76), fontWeight: 600, lineHeight: 1.06, letterSpacing: -2, maxWidth: W - PAD * 2 }}>{post.headline}</span>
        {post.subline ? <span style={{ fontSize: 28, lineHeight: 1.38, color: MUTED, marginTop: 22, maxWidth: W - PAD * 2 - 80 }}>{post.subline}</span> : null}
        <div style={{ display: 'flex', flexGrow: 1, alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 54 }}>
          <Mark brand={brand} assets={a} size={0.7} />
          <span style={{ fontSize: 22, color: FAINT }}>{brand.site}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: W - 14, width: W, height: 14, background: brand.accent }} />
    </div>
  )
}

// A magazine cover: the masthead large across the top, the issue line, a
// band of photo, and the headline as the cover line.
function Magazine({ post, brand, a, photos }: DrawProps) {
  const bandTop = 330
  const bandH = 400
  return (
    <div style={{ width: W, height: W, display: 'flex', flexDirection: 'column', position: 'relative', background: brand.night, fontFamily: 'Inter', color: '#fff' }}>
      <div style={full({ background: `linear-gradient(160deg, ${alpha(brand.accent, 0.3)} 0%, ${alpha(brand.accent, 0)} 40%)` })} />
      <div style={{ display: 'flex', flexDirection: 'column', padding: `${PAD - 10}px ${PAD}px 0`, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Mark brand={brand} assets={a} size={0.7} />
          <span style={{ fontSize: 20, letterSpacing: 3, color: MUTED, fontWeight: 600 }}>{today()}</span>
        </div>
        <span style={{ fontSize: 168, fontWeight: 600, letterSpacing: -8, lineHeight: 1, color: brand.accent, marginTop: 18 }}>Insights</span>
      </div>
      <div style={{ position: 'absolute', top: bandTop, left: 0, width: W, height: bandH, display: 'flex' }}>
        <Img src={photos[0]} w={W} h={bandH} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: bandH, background: brand.night, opacity: 0.25 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: bandH, background: `linear-gradient(to bottom, ${alpha(brand.night, 0)} 50%, ${brand.night} 100%)` }} />
      </div>
      <div style={{ position: 'absolute', top: bandTop + bandH - 70, left: PAD, width: W - PAD * 2, display: 'flex', flexDirection: 'column' }}>
        <KickerBar text={post.kicker} brand={brand} />
        <span style={{ fontSize: size(post.headline, 64), fontWeight: 600, lineHeight: 1.06, letterSpacing: -1.8 }}>{post.headline}</span>
        {post.subline ? <span style={{ fontSize: 26, lineHeight: 1.35, color: MUTED, marginTop: 18, maxWidth: W - PAD * 2 - 80 }}>{post.subline}</span> : null}
      </div>
      <div style={{ position: 'absolute', left: PAD, top: W - 66, display: 'flex', fontSize: 22, color: FAINT }}>{brand.site}</div>
      <div style={{ position: 'absolute', left: 0, top: W - 14, width: W, height: 14, background: brand.accent }} />
    </div>
  )
}

// An editorial frame: the photo set in on the right over a block of the
// brand colour, offset like a print layout; the words down the left.
function Framed({ post, brand, a, photos }: DrawProps) {
  const pw = 430
  const ph = 640
  const px = W - pw - 70
  const py = 210
  return (
    <div style={{ width: W, height: W, display: 'flex', position: 'relative', background: brand.night, fontFamily: 'Inter', color: '#fff' }}>
      <div style={full({ background: `radial-gradient(circle at 85% 60%, ${alpha(brand.accent, 0.22)} 0%, ${alpha(brand.accent, 0)} 55%)` })} />
      <div style={{ position: 'absolute', top: py + 36, left: px + 36, width: pw, height: ph, background: brand.accent }} />
      <Img src={photos[0]} w={pw} h={ph} style={{ position: 'absolute', top: py, left: px }} />
      <div style={{ position: 'absolute', top: py, left: px, width: pw, height: ph, background: `linear-gradient(to bottom, ${alpha(brand.night, 0)} 60%, ${alpha(brand.night, 0.45)} 100%)` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: W, display: 'flex', flexDirection: 'column', padding: `${PAD}px 0 0 ${PAD}px` }}>
        <Mark brand={brand} assets={a} size={0.85} />
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: px - PAD - 50 }}>
          <KickerBar text={post.kicker} brand={brand} />
          <span style={{ fontSize: size(post.headline, 66), fontWeight: 600, lineHeight: 1.06, letterSpacing: -1.8 }}>{post.headline}</span>
          {post.subline ? <span style={{ fontSize: 26, lineHeight: 1.4, color: MUTED, marginTop: 24 }}>{post.subline}</span> : null}
        </div>
        <span style={{ fontSize: 22, color: FAINT, paddingBottom: 56 }}>{brand.site}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, top: W - 14, width: W, height: 14, background: brand.accent }} />
    </div>
  )
}

// No photo: concentric rings of the brand colour off the corner, the
// kicker (or the figure) set huge and faint behind, the headline over it.
function Spotlight({ post, brand, a }: DrawProps) {
  const figure = String(post.source?.figure ?? '').trim()
  const ghost = (figure || post.kicker || brand.name).toUpperCase()
  const rings = [980, 760, 540, 320]
  return (
    <div style={{ width: W, height: W, display: 'flex', position: 'relative', background: brand.night, fontFamily: 'Inter', color: '#fff', overflow: 'hidden' }}>
      <div style={full({ background: `radial-gradient(circle at 92% 92%, ${alpha(brand.accent, 0.35)} 0%, ${alpha(brand.accent, 0)} 60%)` })} />
      {rings.map((d, i) => (
        <div key={d} style={{ position: 'absolute', left: W - d / 2 - 60, top: W - d / 2 - 60, width: d, height: d, borderRadius: d, border: `${i === rings.length - 1 ? 3 : 1}px solid ${alpha(brand.accent, 0.18 + i * 0.12)}` }} />
      ))}
      <span style={{ position: 'absolute', left: PAD - 10, top: 150, fontSize: ghost.length <= 6 ? 300 : 170, fontWeight: 600, letterSpacing: -10, lineHeight: 1, color: alpha(brand.accent, 0.12), width: W, whiteSpace: 'nowrap' }}>{ghost}</span>
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: W, display: 'flex', flexDirection: 'column', padding: `${PAD}px ${PAD}px 0` }}>
        <Mark brand={brand} assets={a} size={0.9} />
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: W - PAD * 2 - 60, paddingTop: 60 }}>
          <KickerBar text={post.kicker} brand={brand} />
          <span style={{ fontSize: size(post.headline, 84), fontWeight: 600, lineHeight: 1.05, letterSpacing: -2.2 }}>{post.headline}</span>
          {post.subline ? <span style={{ fontSize: 30, lineHeight: 1.35, color: MUTED, marginTop: 28, maxWidth: W - PAD * 2 - 160 }}>{post.subline}</span> : null}
        </div>
        <span style={{ fontSize: 22, color: FAINT, paddingBottom: 56 }}>{brand.site}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, top: W - 14, width: W, height: 14, background: brand.accent }} />
    </div>
  )
}

interface DrawProps { post: Post; brand: Brand; a: Assets; photos: string[] }

// The designed card as JSX, its photos fetched; the spotlight when the
// photos cannot be had.
export async function designedCard(post: Post, a: Assets, design: Design): Promise<React.ReactElement> {
  const brand = BRANDS[brandFor(post.series)]
  const need = DESIGN_STYLES.find((s) => s.value === design.style)!.photos
  const photos = (await Promise.all(design.photos.slice(0, need).map((p) => remoteImage(p)))).filter((p): p is string => Boolean(p))
  const style: DesignStyle = photos.length >= Math.min(need, 1) && (need < 3 || photos.length >= 1) ? design.style : 'spotlight'
  const props: DrawProps = { post, brand, a, photos }
  return style === 'cinematic' ? <Cinematic {...props} />
    : style === 'mosaic' ? <Mosaic {...props} />
    : style === 'magazine' ? <Magazine {...props} />
    : style === 'framed' ? <Framed {...props} />
    : <Spotlight {...props} />
}
