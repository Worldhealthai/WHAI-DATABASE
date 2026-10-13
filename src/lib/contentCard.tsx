// The image for a LinkedIn post: a 1080 by 1080 card in the page's own look.
// Eleven styles (contentBrand): an event photo or headshot across the card
// (photo), the brand colour washed over the night (night), ink on white
// (light), the whole card in the brand colour (block), a photo, headshot
// or logo set in a frame beside the words (frame), four graphic looks in
// the brand colour over the night (bands, rings, bars, arcs, wedge), and
// three event photos above the words (mosaic).
// Each kind of post has its own composition in each style: a briefing is
// its words; a speaker carries the headshot, name and role; a session its
// speakers; a sponsor its logo; a theme its question; a countdown its
// figure. Flat surfaces, one accent, sharp corners, Outfit (the typeface
// of the logos): nothing that reads as generated, and no dates on the card
// beyond the event's own date on a post about the event.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { BRANDS, brandFor, photosOf, styleOf, type Brand, type CardStyle } from '@/lib/contentBrand'
import type { ContentPost } from '@/lib/contentStudio'

export const CARD_SIZE = 1080
const W = CARD_SIZE
const PAD = 88

const ASSETS = join(process.cwd(), 'src/assets')
// The brand logos: silver letters for the night and for photos (`whai`,
// `wpai`), ink letters for white (`whaiLight`, `wpaiLight`), one colour for
// a block of the brand colour (`whaiInk` white, `wpaiInk` black), and the
// group's gold wordmark and emblem.
export type Assets = {
  regular: Buffer
  semibold: Buffer
  regularExt: Buffer
  semiboldExt: Buffer
  whai: string
  wpai: string
  whaiLight: string
  wpaiLight: string
  whaiInk: string
  wpaiInk: string
  wng: string
  wngEmblem: string
}
let assets: Assets | null = null
export async function loadAssets(): Promise<Assets> {
  if (assets) return assets
  const png = async (file: string) => `data:image/png;base64,${(await readFile(join(ASSETS, file))).toString('base64')}`
  const [regular, semibold, regularExt, semiboldExt, whai, wpai, whaiLight, wpaiLight, whaiInk, wpaiInk, wng, wngEmblem] = await Promise.all([
    readFile(join(ASSETS, 'fonts/Outfit-400.woff')),
    readFile(join(ASSETS, 'fonts/Outfit-600.woff')),
    readFile(join(ASSETS, 'fonts/Outfit-ext-400.woff')),
    readFile(join(ASSETS, 'fonts/Outfit-ext-600.woff')),
    png('whai-logo.png'),
    png('wpai-logo.png'),
    png('whai-logo-light.png'),
    png('wpai-logo-light.png'),
    png('whai-logo-white.png'),
    png('wpai-logo-black.png'),
    png('wng-gold.png'),
    png('wng-emblem-gold.png'),
  ])
  assets = { regular, semibold, regularExt, semiboldExt, whai, wpai, whaiLight, wpaiLight, whaiInk, wpaiInk, wng, wngEmblem }
  return assets
}

// Outfit's Latin files, and its Latin Extended files under a name of their
// own: the renderer keeps one file per name and weight, and takes a glyph
// the first family lacks (an accented name) from the other families loaded.
export const FONTS = (a: Assets) => [
  { name: 'Outfit', data: a.regular, weight: 400 as const, style: 'normal' as const },
  { name: 'Outfit', data: a.semibold, weight: 600 as const, style: 'normal' as const },
  { name: 'Outfit Ext', data: a.regularExt, weight: 400 as const, style: 'normal' as const },
  { name: 'Outfit Ext', data: a.semiboldExt, weight: 600 as const, style: 'normal' as const },
]

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

export const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`

// The headline shrinks as it lengthens so it stays on three lines or fewer.
export function headlineSize(text: string, max = 82): number {
  const n = text.length
  if (n <= 36) return max
  if (n <= 52) return Math.round(max * 0.85)
  if (n <= 70) return Math.round(max * 0.73)
  return Math.round(max * 0.63)
}

// ── The skin: what each style draws with ───────────────────────────────────

export interface Skin {
  style: CardStyle
  bg: string
  ink: string
  muted: string
  faint: string
  /** The kicker, the figure: the brand colour as this style can carry it */
  accent: string
  /** The brand colour for shapes (the band at the foot, a list's dots) */
  shape: string
  line: string
  plate: string
  /** Which logo goes on this ground */
  on: 'night' | 'light' | 'accent'
}

export function skinFor(brand: Brand, style: CardStyle): Skin {
  if (style === 'light') {
    return { style, bg: '#FFFFFF', ink: '#0B0C10', muted: '#4F5866', faint: '#8A93A6', accent: brand.accentInk, shape: brand.accent, line: alpha('#0B0C10', 0.12), plate: '#F4F6FA', on: 'light' }
  }
  if (style === 'block') {
    const ink = brand.onAccent
    return { style, bg: brand.accent, ink, muted: alpha(ink, 0.82), faint: alpha(ink, 0.7), accent: ink, shape: brand.night, line: alpha(ink, 0.28), plate: '#FFFFFF', on: 'accent' }
  }
  return { style, bg: brand.night, ink: '#FFFFFF', muted: '#C7CBD6', faint: '#8A93A6', accent: brand.accent, shape: brand.accent, line: alpha('#FFFFFF', 0.16), plate: '#F4F6FA', on: 'night' }
}

// The logo files are 1200 by 215.
const LOGO_W = 380
const LOGO_H = 68

export function Mark({ brand, assets: a, size = 1, on = 'night' }: { brand: Brand; assets: Assets; size?: number; on?: 'night' | 'light' | 'accent' }) {
  if (brand.key === 'nexus') {
    if (on === 'night') {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={a.wng} alt="" width={224 * size} height={60 * size} style={{ width: 224 * size, height: 60 * size }} />
    }
    const ink = on === 'light' ? '#0B0C10' : brand.onAccent
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.wngEmblem} alt="" width={60 * size} height={60 * size} style={{ width: 60 * size, height: 60 * size, marginRight: 18 * size }} />
        <span style={{ fontSize: 38 * size, fontWeight: 600, letterSpacing: -0.8, color: ink }}>{brand.name}</span>
      </div>
    )
  }
  const src = brand.key === 'pharma' ? (on === 'light' ? a.wpaiLight : on === 'accent' ? a.wpaiInk : a.wpai) : on === 'light' ? a.whaiLight : on === 'accent' ? a.whaiInk : a.whai
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={LOGO_W * size} height={LOGO_H * size} style={{ width: LOGO_W * size, height: LOGO_H * size }} />
}

// ── The pieces every card is built from ─────────────────────────────────────

export const Kicker = ({ text, s, bar = false, size = 22 }: { text: string; s: Skin; bar?: boolean; size?: number }) =>
  text ? (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
      {bar ? <div style={{ width: 44, height: 6, background: s.style === 'block' ? s.ink : s.shape, marginRight: 18 }} /> : null}
      <span style={{ fontSize: size, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: s.accent }}>{text}</span>
    </div>
  ) : null

export function Words({ post, s, max = 82, width = W - PAD * 2, bar = false, align = 'left' }: { post: Post; s: Skin; max?: number; width?: number; bar?: boolean; align?: 'left' | 'center' }) {
  const centre = align === 'center'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: width, alignItems: centre ? 'center' : 'flex-start' }}>
      <Kicker text={post.kicker} s={s} bar={bar && !centre} />
      <span style={{ fontSize: headlineSize(post.headline, max), fontWeight: 600, lineHeight: 1.08, letterSpacing: -2, color: s.ink, textAlign: centre ? 'center' : 'left' }}>{post.headline}</span>
      {post.subline ? <span style={{ fontSize: width < 600 ? 27 : 30, lineHeight: 1.35, color: s.muted, marginTop: 28, maxWidth: Math.max(width - 60, 360), textAlign: centre ? 'center' : 'left' }}>{post.subline}</span> : null}
    </div>
  )
}

const box = (w: number, h: number): React.CSSProperties => ({ position: 'absolute', top: 0, left: 0, width: w, height: h })

// A soft wash of the brand colour fading into the night from one corner,
// and a fainter one from the opposite corner, so the ground is not flat.
export function Wash({ brand, corner = 'top', w = W, h = W }: { brand: Brand; corner?: 'top' | 'bottom'; w?: number; h?: number }) {
  const from = corner === 'top' ? '160deg' : '340deg'
  return (
    <>
      <div style={{ ...box(w, h), background: `linear-gradient(${from}, ${alpha(brand.accent, 0.42)} 0%, ${alpha(brand.accent, 0.14)} 36%, ${alpha(brand.accent, 0)} 64%)` }} />
      <div style={{ ...box(w, h), background: `radial-gradient(circle at ${corner === 'top' ? '100% 100%' : '0% 0%'}, ${alpha(brand.accent, 0.16)} 0%, ${alpha(brand.accent, 0)} 48%)` }} />
    </>
  )
}

// A photo across the whole card under a flat scrim of the night, fading
// to the night where the words sit.
export function PhotoGround({ brand, src, w = W, h = W, fade = 0.76 }: { brand: Brand; src: string; w?: number; h?: number; fade?: number }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={w} height={h} style={{ ...box(w, h), objectFit: 'cover' }} />
      <div style={{ ...box(w, h), background: brand.night, opacity: 0.5 }} />
      <div style={{ position: 'absolute', left: 0, top: h - Math.round(h * fade), width: w, height: Math.round(h * fade), background: `linear-gradient(to bottom, ${alpha(brand.night, 0)} 0%, ${alpha(brand.night, 0.9)} 55%, ${brand.night} 100%)` }} />
    </>
  )
}

// The light style's ground: white, a great ring of the brand colour off
// the corner, faint, and the brand colour as a band along the top.
export function LightGround({ brand, w = W, h = W }: { brand: Brand; w?: number; h?: number }) {
  return (
    <>
      <div style={{ position: 'absolute', left: w - 420, top: h - 420, width: 900, height: 900, borderRadius: 900, border: `110px solid ${alpha(brand.accent, 0.07)}` }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: 14, background: brand.accent }} />
    </>
  )
}

// The block style's ground: a great disc of the night rising from the
// corner of the brand colour, with a ring inside it.
export function BlockGround({ brand, w = W, h = W, disc = true }: { brand: Brand; w?: number; h?: number; disc?: boolean }) {
  if (!disc) return <div style={{ position: 'absolute', left: 0, top: h - 14, width: w, height: 14, background: brand.night }} />
  return (
    <>
      <div style={{ position: 'absolute', left: w - 430, top: h - 430, width: 860, height: 860, borderRadius: 860, background: brand.night }} />
      <div style={{ position: 'absolute', left: w - 300, top: h - 300, width: 600, height: 600, borderRadius: 600, border: `2px solid ${alpha(brand.accent, 0.55)}` }} />
      <div style={{ position: 'absolute', left: w - 175, top: h - 175, width: 350, height: 350, borderRadius: 350, border: `2px solid ${alpha(brand.accent, 0.35)}` }} />
    </>
  )
}

// Bands of the brand colour cutting across the right of the card at an
// angle, from full strength to faint, the night kept clear on the left.
export function BandsGround({ brand, w = W, h = W }: { brand: Brand; w?: number; h?: number }) {
  const bands = [0.95, 0.6, 0.35, 0.2, 0.1]
  return (
    <>
      {bands.map((o, i) => (
        <div key={i} style={{ position: 'absolute', left: Math.round(w * 0.59) + i * 96, top: -Math.round(h * 0.3), width: 64, height: Math.round(h * 1.6), background: alpha(brand.accent, o), transform: 'rotate(24deg)', transformOrigin: 'center' }} />
      ))}
      <div style={{ ...box(w, h), background: `linear-gradient(90deg, ${brand.night} 0%, ${brand.night} 46%, ${alpha(brand.night, 0)} 72%)` }} />
    </>
  )
}

// Rings of the brand colour off the bottom-right corner, the widest faint
// and the smallest strong, over a glow in the corner.
export function RingsGround({ brand, w = W, h = W }: { brand: Brand; w?: number; h?: number }) {
  const rings = [980, 760, 540, 320]
  return (
    <>
      <div style={{ ...box(w, h), background: `radial-gradient(circle at 92% 92%, ${alpha(brand.accent, 0.42)} 0%, ${alpha(brand.accent, 0)} 60%)` }} />
      {rings.map((d, i) => (
        <div key={d} style={{ position: 'absolute', left: w - d / 2 - 60, top: h - d / 2 - 60, width: d, height: d, borderRadius: d, border: `${i === rings.length - 1 ? 4 : 2}px solid ${alpha(brand.accent, 0.26 + i * 0.16)}` }} />
      ))}
    </>
  )
}

// A number from a text, so a pattern is the same each time the same post
// is drawn but differs from post to post.
export function seedOf(text: string): number {
  let h = 2166136261
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return h
}

// A row of bars along the base of the card, in the brand colour at
// different strengths, one of them full: the market's motif. The words
// and the foot sit above them (BARS_H is the strip they take).
export const BARS_H = 236
export function BarsGround({ brand, seed, w = W, h = W }: { brand: Brand; seed: number; w?: number; h?: number }) {
  const n = 18
  const bw = 34
  const gap = (w - PAD * 2 - n * bw) / (n - 1)
  const heights = Array.from({ length: n }, (_, i) => 36 + (((seed >>> (i % 24)) ^ (i * 2654435761)) >>> 0) % 130)
  const peak = seed % n
  heights[peak] = BARS_H - 40
  return (
    <>
      <div style={{ ...box(w, h), background: `linear-gradient(180deg, ${alpha(brand.accent, 0.16)} 0%, ${alpha(brand.accent, 0)} 45%)` }} />
      {heights.map((bh, i) => (
        <div key={i} style={{ position: 'absolute', left: PAD + i * (bw + gap), top: h - 14 - 24 - bh, width: bw, height: bh, background: i === peak ? brand.accent : alpha(brand.accent, 0.14 + ((i * 7) % 5) * 0.06) }} />
      ))}
    </>
  )
}

// Arcs of the brand colour sweeping in from the right edge, the innermost
// strong, the words in the clear left.
export function ArcsGround({ brand, w = W, h = W }: { brand: Brand; w?: number; h?: number }) {
  const arcs = [720, 580, 440, 300]
  const widths = [1, 2, 3, 6]
  const alphas = [0.28, 0.42, 0.6, 1]
  return (
    <>
      <div style={{ ...box(w, h), background: `linear-gradient(270deg, ${alpha(brand.accent, 0.28)} 0%, ${alpha(brand.accent, 0)} 45%)` }} />
      {arcs.map((d, i) => (
        <div key={d} style={{ position: 'absolute', left: w + 240 - d, top: h / 2 - d / 2, width: d, height: d, borderRadius: d, border: `${widths[i]}px solid ${alpha(brand.accent, alphas[i])}` }} />
      ))}
    </>
  )
}

// A wedge of the brand colour cutting the top-right corner, a fine line
// of it running alongside; the words in the clear below and left of it.
export function WedgeGround({ brand, w = W, h = W }: { brand: Brand; w?: number; h?: number }) {
  // The wedge's edge runs from (x0, 0) down to the right edge at y1.
  const x0 = Math.round(w * 0.48)
  const y1 = Math.round(h * 0.68)
  const dx = w - x0
  // A parallel line 34px further out, drawn past the card so it meets the edges.
  const lx = x0 - 34
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', top: 0, left: 0 }}>
      <polygon points={`${x0},0 ${w},0 ${w},${y1}`} fill={brand.accent} />
      <line x1={lx - dx} y1={-y1} x2={lx + dx * 2} y2={y1 * 2} stroke={alpha(brand.accent, 0.55)} strokeWidth="3" />
    </svg>
  )
}

// The frame style's ground: a photo (or a logo on a white plate) set in on
// the right over a block of the brand colour, offset like a print layout.
const FRAME = { w: 430, h: 640, x: W - 430 - 70, y: 210 }
export function FrameGround({ brand, image, plate, w = W, h = W, f = FRAME }: { brand: Brand; image?: string | null; plate?: string | null; w?: number; h?: number; f?: { w: number; h: number; x: number; y: number } }) {
  return (
    <>
      <div style={{ ...box(w, h), background: `radial-gradient(circle at 85% 60%, ${alpha(brand.accent, 0.22)} 0%, ${alpha(brand.accent, 0)} 55%)` }} />
      <div style={{ position: 'absolute', top: f.y + 36, left: f.x + 36, width: f.w, height: f.h, background: brand.accent }} />
      {plate ? (
        <div style={{ position: 'absolute', top: f.y, left: f.x, width: f.w, height: f.h, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={plate} alt="" width={f.w - 80} height={240} style={{ width: f.w - 80, height: 240, objectFit: 'contain' }} />
        </div>
      ) : image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" width={f.w} height={f.h} style={{ position: 'absolute', top: f.y, left: f.x, width: f.w, height: f.h, objectFit: 'cover' }} />
          <div style={{ position: 'absolute', top: f.y, left: f.x, width: f.w, height: f.h, background: `linear-gradient(to bottom, ${alpha(brand.night, 0)} 60%, ${alpha(brand.night, 0.45)} 100%)` }} />
        </>
      ) : null}
    </>
  )
}

// The mosaic's ground: three photos above (the big one may be a headshot,
// or a logo on a white plate), fading into the night where the words begin.
const MOSAIC = { top: 500, gap: 10, bigW: 640 }
export function MosaicGround({ brand, photos, big, plate, w = W, m = MOSAIC }: { brand: Brand; photos: string[]; big?: string | null; plate?: string | null; w?: number; m?: { top: number; gap: number; bigW: number } }) {
  const smallW = w - m.bigW - m.gap
  const smallH = (m.top - m.gap) / 2
  const img = (src: string, iw: number, ih: number, style: React.CSSProperties = {}) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={iw} height={ih} style={{ width: iw, height: ih, objectFit: 'cover', ...style }} />
  const p0 = photos[0]
  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, display: 'flex', width: w, height: m.top }}>
        {plate ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: m.bigW, height: m.top, background: '#FFFFFF' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={plate} alt="" width={460} height={220} style={{ width: 460, height: 220, objectFit: 'contain' }} />
          </div>
        ) : img(big ?? p0, m.bigW, m.top)}
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: m.gap }}>
          {img(photos[big || plate ? 0 : 1] ?? p0, smallW, smallH)}
          {img(photos[big || plate ? 1 : 2] ?? photos[0], smallW, smallH, { marginTop: m.gap })}
        </div>
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, width: w, height: m.top, background: `linear-gradient(to bottom, ${alpha(brand.night, 0)} 55%, ${alpha(brand.night, 0.85)} 100%)` }} />
    </>
  )
}

function Foot({ s, city, date, site, width = W - PAD * 2, mark }: { s: Skin; city: string; date: string; site: string; width?: number; mark?: React.ReactNode }) {
  if (s.style === 'block') {
    // Everything on the left, clear of the night disc in the corner.
    return (
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, paddingBottom: 56, width, color: s.muted }}>
        {city ? <span style={{ color: s.ink, fontWeight: 600 }}>{city}</span> : null}
        {city && date ? <span style={{ margin: '0 14px' }}>·</span> : null}
        {date ? <span style={{ color: s.ink, fontWeight: 600 }}>{date}</span> : null}
        {site ? <span style={{ marginLeft: city || date ? 28 : 0 }}>{site}</span> : null}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24, paddingBottom: 56, width }}>
      {mark ?? (
        <span style={{ display: 'flex', color: s.muted }}>
          {city ? <span style={{ color: s.ink, fontWeight: 600 }}>{city}</span> : null}
          {city && date ? <span style={{ margin: '0 14px' }}>·</span> : null}
          {date ? <span style={{ color: s.accent, fontWeight: 600 }}>{date}</span> : null}
        </span>
      )}
      <span style={{ display: 'flex', color: s.faint }}>
        {mark && city ? <span style={{ color: s.ink, fontWeight: 600, marginRight: 28 }}>{[city, date].filter(Boolean).join(' · ')}</span> : null}
        <span>{site}</span>
      </span>
    </div>
  )
}

// The width the words have in a style: the frame, the bands and the arcs
// keep the right of the card for themselves, the block and the rings their
// corner, the wedge the top.
const bodyWidth = (style: CardStyle) =>
  style === 'frame' ? FRAME.x - PAD - 50 : style === 'bands' || style === 'arcs' ? 540 : style === 'block' || style === 'rings' ? W - PAD * 2 - 140 : style === 'wedge' ? 760 : W - PAD * 2
// Where the words sit: at the foot under a photo or a wedge, else in the middle.
const justifyFor = (style: CardStyle): 'center' | 'flex-end' => (style === 'photo' || style === 'wedge' ? 'flex-end' : 'center')
// The looks drawn with shapes alone, with room for a square headshot above the words.
const graphic = (style: CardStyle) => style === 'bands' || style === 'rings' || style === 'bars' || style === 'arcs' || style === 'wedge'

// The card's frame in a style: the ground, the logo at the head (at the
// foot for the mosaic), the foot, and the band of the brand colour along
// the bottom; the body between them.
function Card({ brand, a, s, ground, city, date, children, justify = 'center', width }: { brand: Brand; a: Assets; s: Skin; ground: React.ReactNode; city: string; date: string; children: React.ReactNode; justify?: 'center' | 'flex-end'; width?: number }) {
  const mosaic = s.style === 'mosaic'
  const w = width ?? bodyWidth(s.style)
  // The words and the foot sit above the bars along the base.
  const bottom = s.style === 'bars' ? BARS_H : 0
  return (
    <div style={{ width: W, height: W, display: 'flex', position: 'relative', background: s.bg, color: s.ink, fontFamily: 'Outfit', overflow: 'hidden' }}>
      {ground}
      <div style={{ ...box(W, W), display: 'flex', flexDirection: 'column', padding: mosaic ? `${MOSAIC.top + 44}px ${PAD}px ${bottom}px` : `${PAD}px ${PAD}px ${bottom}px` }}>
        {mosaic ? null : <Mark brand={brand} assets={a} on={s.on} />}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: mosaic ? 'flex-start' : justify, paddingBottom: justify === 'flex-end' ? 44 : 36, width: w }}>{children}</div>
        <Foot s={s} city={city} date={date} site={brand.site} mark={mosaic ? <Mark brand={brand} assets={a} size={0.7} on={s.on} /> : undefined} />
      </div>
      {s.style === 'light' || s.style === 'block' ? null : <div style={{ position: 'absolute', left: 0, top: W - 14, width: W, height: 14, background: s.shape }} />}
    </div>
  )
}

// ── The kinds ───────────────────────────────────────────────────────────────

type Post = Pick<ContentPost, 'series' | 'kicker' | 'headline' | 'subline' | 'source'> & { kind?: string }
interface Images { photos: string[]; headshot: string | null; logo: string | null }
interface DrawProps { post: Post; brand: Brand; a: Assets; s: Skin; images: Images; city: string; date: string }

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

// The ground a style draws under the words when the kind has nothing of
// its own to put there.
function groundFor({ brand, s, images, post }: DrawProps, extra: { image?: string | null; plate?: string | null } = {}): React.ReactNode {
  switch (s.style) {
    case 'photo': return <PhotoGround brand={brand} src={extra.image ?? images.photos[0]} />
    case 'light': return <LightGround brand={brand} />
    case 'block': return <BlockGround brand={brand} />
    case 'bands': return <BandsGround brand={brand} />
    case 'rings': return <RingsGround brand={brand} />
    case 'bars': return <BarsGround brand={brand} seed={seedOf(post.headline)} />
    case 'arcs': return <ArcsGround brand={brand} />
    case 'wedge': return <WedgeGround brand={brand} />
    case 'frame': return <FrameGround brand={brand} image={extra.plate ? null : extra.image ?? images.photos[0]} plate={extra.plate} />
    case 'mosaic': return <MosaicGround brand={brand} photos={images.photos} big={extra.image} plate={extra.plate} />
    default: return <Wash brand={brand} />
  }
}

// A briefing, a theme, a market signal: the words.
function Plain(p: DrawProps) {
  const { post, brand, a, s, city, date } = p
  const theme = post.kind === 'theme'
  const max = s.style === 'photo' ? 76 : s.style === 'frame' ? 64 : s.style === 'bands' || s.style === 'arcs' ? 72 : s.style === 'mosaic' || s.style === 'wedge' ? 72 : 82
  return (
    <Card brand={brand} a={a} s={s} ground={groundFor(p)} city={city} date={date} justify={justifyFor(s.style)}>
      {theme && (s.style === 'night' || graphic(s.style)) ? (
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `10px solid ${s.shape}`, paddingLeft: 40 }}>
          <Words post={post} s={s} max={max} width={bodyWidth(s.style) - 50} />
        </div>
      ) : (
        <Words post={post} s={s} max={max} width={bodyWidth(s.style)} bar={s.style === 'light' || s.style === 'block'} align={theme && s.style === 'light' ? 'center' : 'left'} />
      )}
    </Card>
  )
}

// The name, role and organisation under a speaker's words.
function who(post: Post, s: Skin, size: number) {
  const name = str(post.source?.name)
  const role = [str(post.source?.role), str(post.source?.org)].filter(Boolean).join(', ')
  return name ? (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 34 }}>
      <span style={{ fontSize: size, fontWeight: 600, color: s.ink }}>{name}</span>
      {role ? <span style={{ fontSize: Math.round(size * 0.78), lineHeight: 1.35, color: s.muted, marginTop: 8, maxWidth: 760 }}>{role}</span> : null}
    </div>
  ) : null
}

// A speaker: the headshot with the name, role and organisation.
function Speaker(p: DrawProps) {
  const { post, brand, a, s, images, city, date } = p
  const headshot = images.headshot
  if (!headshot) {
    // No headshot: the words, and the name and role under them.
    return (
      <Card brand={brand} a={a} s={s} ground={groundFor(p)} city={city} date={date} justify={justifyFor(s.style)}>
        <Words post={post} s={s} max={s.style === 'frame' ? 60 : s.style === 'bands' ? 66 : 76} width={bodyWidth(s.style)} bar={s.style === 'light' || s.style === 'block'} />
        {who(post, s, 32)}
      </Card>
    )
  }

  if (s.style === 'photo') {
    // The headshot across the whole card, the words at the foot.
    return (
      <Card brand={brand} a={a} s={s} ground={<PhotoGround brand={brand} src={headshot} />} city={city} date={date} justify="flex-end">
        <Words post={post} s={s} max={70} />
        {who(post, s, 34)}
      </Card>
    )
  }
  if (s.style === 'frame' || s.style === 'mosaic') {
    // The headshot takes the frame, or the mosaic's big photo.
    return (
      <Card brand={brand} a={a} s={s} ground={groundFor(p, { image: headshot })} city={city} date={date}>
        <Words post={post} s={s} max={s.style === 'frame' ? 58 : 64} width={bodyWidth(s.style)} />
        {who(post, s, 30)}
      </Card>
    )
  }
  if (graphic(s.style)) {
    // A square headshot above the words, in the clear part of the card
    // (smaller over the bars, which take the base).
    const hs = s.style === 'bars' ? 210 : 250
    return (
      <Card brand={brand} a={a} s={s} ground={groundFor(p)} city={city} date={date} justify={justifyFor(s.style)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={headshot} alt="" width={hs} height={hs} style={{ width: hs, height: hs, objectFit: 'cover', marginBottom: 32 }} />
        <Words post={post} s={s} max={s.style === 'bars' ? 54 : 58} width={bodyWidth(s.style)} />
        {who(post, s, 28)}
      </Card>
    )
  }
  if (s.style === 'light') {
    // The headshot set in on the left with a block of the brand colour
    // behind it, offset like a print layout; the words down the right.
    const pw = 400
    const ph = 520
    return (
      <div style={{ width: W, height: W, display: 'flex', position: 'relative', background: s.bg, color: s.ink, fontFamily: 'Outfit', overflow: 'hidden' }}>
        <LightGround brand={brand} />
        <div style={{ position: 'absolute', left: PAD + 28, top: 268, width: pw, height: ph, background: brand.accent }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={headshot} alt="" width={pw} height={ph} style={{ position: 'absolute', left: PAD, top: 240, width: pw, height: ph, objectFit: 'cover' }} />
        <div style={{ ...box(W, W), display: 'flex', flexDirection: 'column', padding: `${PAD}px ${PAD}px 0` }}>
          <Mark brand={brand} assets={a} on="light" />
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', paddingLeft: pw + 72, paddingBottom: 36 }}>
            <Words post={post} s={s} max={58} width={W - PAD * 2 - pw - 72} bar />
            {who(post, s, 30)}
          </div>
          <Foot s={s} city={city} date={date} site={brand.site} />
        </div>
      </div>
    )
  }
  // Night and block: the headshot down the right, the words on the left.
  const cw = 440
  const block = s.style === 'block'
  return (
    <div style={{ width: W, height: W, display: 'flex', position: 'relative', background: s.bg, color: s.ink, fontFamily: 'Outfit', overflow: 'hidden' }}>
      {block ? null : <Wash brand={brand} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={headshot} alt="" width={cw} height={W - 14} style={{ position: 'absolute', right: 0, top: 0, width: cw, height: W - 14, objectFit: 'cover' }} />
      <div style={{ position: 'absolute', right: cw - 1, top: 0, width: 1, height: W - 14, background: alpha(block ? brand.night : brand.accent, 0.6) }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: W - cw, height: W, display: 'flex', flexDirection: 'column', padding: `${PAD}px 0 0 ${PAD}px` }}>
        <Mark brand={brand} assets={a} size={0.85} on={s.on} />
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', paddingBottom: 36 }}>
          <Words post={post} s={s} max={62} width={W - cw - PAD - 48} bar={block} />
          {who(post, s, 30)}
        </div>
        {/* The narrow column has room for the city and the date; the site goes without. */}
        <Foot s={s} city={city} date={date} site="" width={W - cw - PAD - 48} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: W - 14, width: W, height: 14, background: s.shape }} />
    </div>
  )
}

// A session: the words, then who is on it. In a narrow column (the frame,
// the bands) each person takes two lines; under the mosaic only two fit.
function Session(p: DrawProps) {
  const { post, brand, a, s, city, date } = p
  const narrow = s.style === 'frame' || s.style === 'bands' || s.style === 'arcs'
  const people = (Array.isArray(post.source?.speakers) ? (post.source!.speakers as { name?: string; org?: string; moderator?: boolean }[]) : [])
    .filter((x) => str(x.name))
    .slice(0, s.style === 'photo' || s.style === 'mosaic' ? 2 : 3)
  const width = bodyWidth(s.style)
  const list = people.length ? (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: s.style === 'mosaic' ? 26 : 36, width: Math.min(width, W - PAD * 2 - 40), ...(s.style === 'light' ? { background: s.plate, padding: '6px 32px' } : {}) }}>
      {people.map((x, i) => (
        <div key={i} style={{ display: 'flex', alignItems: narrow ? 'flex-start' : 'center', justifyContent: 'space-between', width: '100%', borderTop: i ? `1px solid ${s.line}` : 'none', padding: narrow ? '14px 0' : '16px 0' }}>
          <div style={{ display: 'flex', alignItems: narrow ? 'flex-start' : 'center' }}>
            <div style={{ width: 10, height: 10, background: s.shape, marginRight: 22, marginTop: narrow ? 12 : 0, flexShrink: 0 }} />
            {narrow ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 26, fontWeight: 600, color: s.ink }}>{str(x.name)}{x.moderator ? ', chair' : ''}</span>
                {str(x.org) ? <span style={{ fontSize: 23, color: s.muted, marginTop: 4 }}>{str(x.org)}</span> : null}
              </div>
            ) : (
              <>
                <span style={{ fontSize: 27, fontWeight: 600, color: s.ink }}>{str(x.name)}</span>
                {str(x.org) ? <span style={{ fontSize: 25, color: s.muted, marginLeft: 16 }}>{str(x.org)}</span> : null}
              </>
            )}
          </div>
          {/* The chair's label at the far end of the row, clear of the name. */}
          {!narrow && x.moderator ? <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: s.accent, marginLeft: 24, flexShrink: 0 }}>Chair</span> : null}
        </div>
      ))}
    </div>
  ) : null
  const max = people.length ? (narrow ? 50 : s.style === 'mosaic' ? 58 : 66) : s.style === 'frame' ? 64 : 80
  return (
    <Card brand={brand} a={a} s={s} ground={groundFor(p)} city={city} date={date} justify={justifyFor(s.style)}>
      <Words post={post} s={s} max={max} width={width} bar={s.style === 'light' || s.style === 'block'} />
      {list}
    </Card>
  )
}

// A sponsor: the logo, on a light plate on the night, on the white itself,
// in the frame, or in the mosaic's big square.
function Sponsor(p: DrawProps) {
  const { post, brand, a, s, images, city, date } = p
  const logo = images.logo
  if (!logo) return <Plain {...p} />
  if (s.style === 'frame' || s.style === 'mosaic') {
    return (
      <Card brand={brand} a={a} s={s} ground={groundFor(p, { plate: logo })} city={city} date={date}>
        <Words post={post} s={s} max={s.style === 'frame' ? 58 : 64} width={bodyWidth(s.style)} />
      </Card>
    )
  }
  const width = bodyWidth(s.style)
  const plateH = s.style === 'photo' ? 250 : graphic(s.style) ? 230 : 300
  const plate = s.style === 'light' ? { border: `1px solid ${s.line}`, background: '#FFFFFF' } : { background: s.plate }
  return (
    <Card brand={brand} a={a} s={s} ground={groundFor(p)} city={city} date={date} justify={justifyFor(s.style)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width, height: plateH, marginBottom: 44, ...plate }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={Math.min(640, width - 100)} height={plateH - 80} style={{ width: Math.min(640, width - 100), height: plateH - 80, objectFit: 'contain' }} />
      </div>
      <Words post={post} s={s} max={width < 700 ? 52 : 60} width={width} bar={s.style === 'light' || s.style === 'block'} />
    </Card>
  )
}

// A countdown or a figure from the platform: one large number, its label
// as the headline. The figure is sized to the room it has.
function Figure(p: DrawProps) {
  const { post, brand, a, s, city, date } = p
  const figure = str(post.source?.figure) || str(post.source?.daysToGo)
  if (!figure) return <Plain {...p} />
  const width = bodyWidth(s.style)
  const big = figure.length <= 2 ? 360 : figure.length <= 4 ? 300 : figure.length <= 6 ? 240 : 180
  const size = Math.min(s.style === 'photo' || s.style === 'mosaic' ? Math.round(big * 0.72) : big, Math.floor(width / (0.62 * figure.length)))
  return (
    <Card brand={brand} a={a} s={s} ground={groundFor(p)} city={city} date={date} justify={justifyFor(s.style)}>
      <Kicker text={post.kicker} s={s} bar={s.style === 'light' || s.style === 'block'} />
      <span style={{ fontSize: size, fontWeight: 600, lineHeight: 0.95, letterSpacing: -10, color: s.accent, fontVariantNumeric: 'tabular-nums' }}>{figure}</span>
      <span style={{ fontSize: headlineSize(post.headline, width < 600 ? 46 : 56), fontWeight: 600, lineHeight: 1.1, letterSpacing: -1.5, marginTop: 28, maxWidth: width, color: s.ink }}>{post.headline}</span>
      {post.subline ? <span style={{ fontSize: 28, lineHeight: 1.35, color: s.muted, marginTop: 22, maxWidth: Math.max(width - 60, 360) }}>{post.subline}</span> : null}
    </Card>
  )
}

// ── Drawing a post ──────────────────────────────────────────────────────────

// What the card needs for its style, fetched: the photos for the photo,
// frame and mosaic styles, the headshot and the logo for the kinds that
// carry them.
async function imagesFor(post: Post, style: CardStyle): Promise<Images> {
  const src = post.source ?? {}
  const need = style === 'mosaic' ? 3 : style === 'photo' || style === 'frame' ? 1 : 0
  const [photos, headshot, logo] = await Promise.all([
    Promise.all(photosOf(src).slice(0, need).map((p) => remoteImage(p))),
    post.kind === 'speaker' ? remoteImage(str(src.image) || null) : Promise.resolve(null),
    post.kind === 'sponsor' ? remoteImage(str(src.logo) || null) : Promise.resolve(null),
  ])
  return { photos: photos.filter((p): p is string => Boolean(p)), headshot, logo }
}

// The card as JSX. A style without the photos it needs is drawn as the
// night, so a post is never left without its image.
export async function cardElement(post: Post, a: Assets, styleOverride?: CardStyle): Promise<React.ReactElement> {
  const brand = BRANDS[brandFor(post.series)]
  let style = styleOverride ?? styleOf(post.source)
  const images = await imagesFor(post, style)
  const own = (post.kind === 'speaker' && images.headshot) || (post.kind === 'sponsor' && images.logo && style === 'frame')
  if ((style === 'photo' || style === 'frame') && !images.photos[0] && !own) style = 'night'
  if (style === 'mosaic' && images.photos.length < (post.kind === 'speaker' && images.headshot ? 2 : post.kind === 'sponsor' && images.logo ? 2 : 3)) style = 'night'
  const s = skinFor(brand, style)
  // The city and the date belong to posts about the event, not to a briefing.
  const eventPost = ['speaker', 'session', 'sponsor', 'countdown', 'theme', 'event'].includes(post.kind ?? '')
  const city = eventPost ? str(post.source?.city) : ''
  const date = eventPost ? str(post.source?.date) : ''
  const props: DrawProps = { post, brand, a, s, images, city, date }
  switch (post.kind) {
    case 'speaker': return <Speaker {...props} />
    case 'session': return <Session {...props} />
    case 'sponsor': return <Sponsor {...props} />
    case 'countdown': return <Figure {...props} />
    case 'platform': return str(post.source?.figure) ? <Figure {...props} /> : <Plain {...props} />
    default: return <Plain {...props} />
  }
}

export async function renderCard(post: Post, styleOverride?: CardStyle): Promise<ImageResponse> {
  const a = await loadAssets()
  return new ImageResponse(await cardElement(post, a, styleOverride), { width: W, height: W, fonts: FONTS(a) })
}
