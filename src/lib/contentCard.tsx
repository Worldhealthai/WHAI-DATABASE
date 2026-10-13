// The image for a LinkedIn post: a 1080 by 1080 card in the page's own look.
// Three styles (contentBrand): an event photo or headshot across the card
// (photo), the brand colour washed over the night (night), and ink on white
// with the brand colour as the accent (light). Each kind of post has its own
// composition in each style: a briefing is its words; a speaker carries the
// headshot, name and role; a session its speakers; a sponsor its logo; a
// theme its question; a countdown its figure. Flat surfaces, one accent,
// sharp corners, Outfit (the typeface of the logos): nothing that reads as
// generated, and no dates on the card.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { BRANDS, brandFor, styleOf, type Brand, type CardStyle } from '@/lib/contentBrand'
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
  const [regular, semibold, whai, wpai, whaiLight, wpaiLight, whaiInk, wpaiInk, wng, wngEmblem] = await Promise.all([
    readFile(join(ASSETS, 'fonts/Outfit-400.woff')),
    readFile(join(ASSETS, 'fonts/Outfit-600.woff')),
    png('whai-logo.png'),
    png('wpai-logo.png'),
    png('whai-logo-light.png'),
    png('wpai-logo-light.png'),
    png('whai-logo-white.png'),
    png('wpai-logo-black.png'),
    png('wng-gold.png'),
    png('wng-emblem-gold.png'),
  ])
  assets = { regular, semibold, whai, wpai, whaiLight, wpaiLight, whaiInk, wpaiInk, wng, wngEmblem }
  return assets
}

export const FONTS = (a: Assets) => [
  { name: 'Outfit', data: a.regular, weight: 400 as const, style: 'normal' as const },
  { name: 'Outfit', data: a.semibold, weight: 600 as const, style: 'normal' as const },
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
  /** The kicker, the figure, the rules: the brand colour as this style can carry it */
  accent: string
  /** The brand colour for shapes (the band at the foot, a plate's edge) */
  shape: string
  line: string
  plate: string
}

export function skinFor(brand: Brand, style: CardStyle): Skin {
  if (style === 'light') {
    return { style, bg: '#FFFFFF', ink: '#0B0C10', muted: '#4F5866', faint: '#8A93A6', accent: brand.accentInk, shape: brand.accent, line: alpha('#0B0C10', 0.12), plate: '#F4F6FA' }
  }
  return { style, bg: brand.night, ink: '#FFFFFF', muted: '#C7CBD6', faint: '#8A93A6', accent: brand.accent, shape: brand.accent, line: alpha('#FFFFFF', 0.16), plate: '#F4F6FA' }
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
      {bar ? <div style={{ width: 44, height: 6, background: s.shape, marginRight: 18 }} /> : null}
      <span style={{ fontSize: size, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: s.accent }}>{text}</span>
    </div>
  ) : null

export function Words({ post, s, max = 82, width = W - PAD * 2, bar = false, align = 'left' }: { post: Post; s: Skin; max?: number; width?: number; bar?: boolean; align?: 'left' | 'center' }) {
  const centre = align === 'center'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: width, alignItems: centre ? 'center' : 'flex-start' }}>
      <Kicker text={post.kicker} s={s} bar={bar && !centre} />
      <span style={{ fontSize: headlineSize(post.headline, max), fontWeight: 600, lineHeight: 1.08, letterSpacing: -2, color: s.ink, textAlign: centre ? 'center' : 'left' }}>{post.headline}</span>
      {post.subline ? <span style={{ fontSize: 30, lineHeight: 1.35, color: s.muted, marginTop: 28, maxWidth: width - 60, textAlign: centre ? 'center' : 'left' }}>{post.subline}</span> : null}
    </div>
  )
}

// A soft wash of the brand colour fading into the night from one corner,
// and a fainter one from the opposite corner, so the ground is not flat.
export function Wash({ brand, corner = 'top', w = W, h = W }: { brand: Brand; corner?: 'top' | 'bottom'; w?: number; h?: number }) {
  const from = corner === 'top' ? '160deg' : '340deg'
  const box: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: w, height: h }
  return (
    <>
      <div style={{ ...box, background: `linear-gradient(${from}, ${alpha(brand.accent, 0.42)} 0%, ${alpha(brand.accent, 0.14)} 36%, ${alpha(brand.accent, 0)} 64%)` }} />
      <div style={{ ...box, background: `radial-gradient(circle at ${corner === 'top' ? '100% 100%' : '0% 0%'}, ${alpha(brand.accent, 0.16)} 0%, ${alpha(brand.accent, 0)} 48%)` }} />
    </>
  )
}

// A photo across the whole card under a flat scrim of the night, fading
// to the night where the words sit.
export function PhotoGround({ brand, src, w = W, h = W, fade = 0.76 }: { brand: Brand; src: string; w?: number; h?: number; fade?: number }) {
  const box: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: w, height: h }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={w} height={h} style={{ ...box, objectFit: 'cover' }} />
      <div style={{ ...box, background: brand.night, opacity: 0.5 }} />
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

// The brand colour as a band along the foot of a night card or a photo.
const Band = ({ s, w = W, h = W }: { s: Skin; w?: number; h?: number }) => <div style={{ position: 'absolute', left: 0, top: h - 14, width: w, height: 14, background: s.shape }} />

function Foot({ s, city, date, site, width = W - PAD * 2 }: { s: Skin; city: string; date: string; site: string; width?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24, paddingBottom: 56, width }}>
      <span style={{ display: 'flex', color: s.muted }}>
        {city ? <span style={{ color: s.ink, fontWeight: 600 }}>{city}</span> : null}
        {city && date ? <span style={{ margin: '0 14px' }}>·</span> : null}
        {date ? <span style={{ color: s.accent, fontWeight: 600 }}>{date}</span> : null}
      </span>
      <span style={{ color: s.faint }}>{site}</span>
    </div>
  )
}

// The card's frame in a style: the ground, the logo at the head, the foot,
// and the band of the brand colour; the body between them.
function Frame({ brand, a, s, photo, city, date, children, justify = 'center', corner = 'top' }: { brand: Brand; a: Assets; s: Skin; photo: string | null; city: string; date: string; children: React.ReactNode; justify?: 'center' | 'flex-end'; corner?: 'top' | 'bottom' }) {
  const onPhoto = s.style === 'photo' && photo
  return (
    <div style={{ width: W, height: W, display: 'flex', position: 'relative', background: s.bg, color: s.ink, fontFamily: 'Outfit', overflow: 'hidden' }}>
      {onPhoto ? <PhotoGround brand={brand} src={photo} /> : s.style === 'light' ? <LightGround brand={brand} /> : <Wash brand={brand} corner={corner} />}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: W, display: 'flex', flexDirection: 'column', padding: `${PAD}px ${PAD}px 0` }}>
        <Mark brand={brand} assets={a} on={s.style === 'light' ? 'light' : 'night'} />
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: onPhoto ? 'flex-end' : justify, paddingBottom: onPhoto ? 44 : 36, width: W - PAD * 2 }}>{children}</div>
        <Foot s={s} city={city} date={date} site={brand.site} />
      </div>
      {s.style !== 'light' ? <Band s={s} /> : null}
    </div>
  )
}

// ── The kinds ───────────────────────────────────────────────────────────────

type Post = Pick<ContentPost, 'series' | 'kicker' | 'headline' | 'subline' | 'source'> & { kind?: string }
interface Images { photo: string | null; headshot: string | null; logo: string | null }
interface DrawProps { post: Post; brand: Brand; a: Assets; s: Skin; images: Images; city: string; date: string }

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

// A briefing, a theme, a market signal: the words.
function Plain({ post, brand, a, s, images, city, date }: DrawProps) {
  const theme = post.kind === 'theme'
  if (s.style === 'light') {
    return (
      <Frame brand={brand} a={a} s={s} photo={null} city={city} date={date}>
        <Words post={post} s={s} max={84} bar align={theme ? 'center' : 'left'} />
      </Frame>
    )
  }
  return (
    <Frame brand={brand} a={a} s={s} photo={images.photo} city={city} date={date} corner={theme ? 'bottom' : 'top'}>
      {theme && s.style === 'night' ? (
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `10px solid ${s.shape}`, paddingLeft: 40 }}>
          <Words post={post} s={s} max={78} width={W - PAD * 2 - 50} />
        </div>
      ) : (
        <Words post={post} s={s} max={s.style === 'photo' ? 76 : 82} />
      )}
    </Frame>
  )
}

// A speaker: the headshot with the name, role and organisation.
function Speaker({ post, brand, a, s, images, city, date }: DrawProps) {
  const name = str(post.source?.name)
  const role = [str(post.source?.role), str(post.source?.org)].filter(Boolean).join(', ')
  const who = (size: number) =>
    name ? (
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 34 }}>
        <span style={{ fontSize: size, fontWeight: 600, color: s.ink }}>{name}</span>
        {role ? <span style={{ fontSize: Math.round(size * 0.78), lineHeight: 1.35, color: s.muted, marginTop: 8, maxWidth: 760 }}>{role}</span> : null}
      </div>
    ) : null
  const headshot = images.headshot
  if (!headshot) return <Plain post={post} brand={brand} a={a} s={s} images={images} city={city} date={date} />

  if (s.style === 'photo') {
    // The headshot across the whole card, the words at the foot.
    return (
      <Frame brand={brand} a={a} s={s} photo={headshot} city={city} date={date}>
        <Words post={post} s={s} max={70} />
        {who(34)}
      </Frame>
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
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: W, display: 'flex', flexDirection: 'column', padding: `${PAD}px ${PAD}px 0` }}>
          <Mark brand={brand} assets={a} on="light" />
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', paddingLeft: pw + 72, paddingBottom: 36 }}>
            <Words post={post} s={s} max={58} width={W - PAD * 2 - pw - 72} bar />
            {who(30)}
          </div>
          <Foot s={s} city={city} date={date} site={brand.site} />
        </div>
      </div>
    )
  }
  // Night: the headshot down the right, the words on the left.
  const cw = 440
  return (
    <div style={{ width: W, height: W, display: 'flex', position: 'relative', background: s.bg, color: s.ink, fontFamily: 'Outfit', overflow: 'hidden' }}>
      <Wash brand={brand} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={headshot} alt="" width={cw} height={W - 14} style={{ position: 'absolute', right: 0, top: 0, width: cw, height: W - 14, objectFit: 'cover' }} />
      <div style={{ position: 'absolute', right: cw - 1, top: 0, width: 1, height: W - 14, background: alpha(brand.accent, 0.6) }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: W - cw, height: W, display: 'flex', flexDirection: 'column', padding: `${PAD}px 0 0 ${PAD}px` }}>
        <Mark brand={brand} assets={a} size={0.85} />
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', paddingBottom: 36 }}>
          <Words post={post} s={s} max={62} width={W - cw - PAD - 48} />
          {who(30)}
        </div>
        {/* The narrow column has room for the city and the date; the site goes without. */}
        <Foot s={s} city={city} date={date} site="" width={W - cw - PAD - 48} />
      </div>
      <Band s={s} />
    </div>
  )
}

// A session: the words, then who is on it.
function Session({ post, brand, a, s, images, city, date }: DrawProps) {
  const people = (Array.isArray(post.source?.speakers) ? (post.source!.speakers as { name?: string; org?: string; role?: string; moderator?: boolean }[]) : [])
    .filter((p) => str(p.name))
    .slice(0, s.style === 'photo' ? 2 : 3)
  const list = people.length ? (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, width: W - PAD * 2 - 40, ...(s.style === 'light' ? { background: s.plate, padding: '6px 32px' } : {}) }}>
      {people.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', borderTop: i ? `1px solid ${s.line}` : 'none', padding: '16px 0' }}>
          <div style={{ width: 10, height: 10, background: s.shape, marginRight: 22, flexShrink: 0 }} />
          <span style={{ fontSize: 27, fontWeight: 600, color: s.ink }}>{str(p.name)}</span>
          {str(p.org) ? <span style={{ fontSize: 25, color: s.muted, marginLeft: 16 }}>{str(p.org)}</span> : null}
          {p.moderator ? <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: s.accent, marginLeft: 'auto' }}>Chair</span> : null}
        </div>
      ))}
    </div>
  ) : null
  return (
    <Frame brand={brand} a={a} s={s} photo={images.photo} city={city} date={date}>
      <Words post={post} s={s} max={people.length ? 66 : 80} bar={s.style === 'light'} />
      {list}
    </Frame>
  )
}

// A sponsor: the logo, on a light plate on the night, on the white itself.
function Sponsor({ post, brand, a, s, images, city, date }: DrawProps) {
  const logo = images.logo
  if (!logo) return <Plain post={post} brand={brand} a={a} s={s} images={images} city={city} date={date} />
  const plate = s.style === 'light' ? { border: `1px solid ${s.line}`, background: '#FFFFFF' } : { background: s.plate }
  return (
    <Frame brand={brand} a={a} s={s} photo={images.photo} city={city} date={date}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: W - PAD * 2, height: s.style === 'photo' ? 250 : 300, marginBottom: 44, ...plate }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={640} height={200} style={{ width: 640, height: s.style === 'photo' ? 170 : 200, objectFit: 'contain' }} />
      </div>
      <Words post={post} s={s} max={60} bar={s.style === 'light'} />
    </Frame>
  )
}

// A countdown or a figure from the platform: one large number, its label
// as the headline.
function Figure({ post, brand, a, s, images, city, date }: DrawProps) {
  const figure = str(post.source?.figure) || str(post.source?.daysToGo)
  if (!figure) return <Plain post={post} brand={brand} a={a} s={s} images={images} city={city} date={date} />
  const big = figure.length <= 2 ? 360 : figure.length <= 4 ? 300 : figure.length <= 6 ? 240 : 180
  const size = s.style === 'photo' ? Math.round(big * 0.8) : big
  return (
    <Frame brand={brand} a={a} s={s} photo={images.photo} city={city} date={date} corner="bottom">
      <Kicker text={post.kicker} s={s} bar={s.style === 'light'} />
      <span style={{ fontSize: size, fontWeight: 600, lineHeight: 0.95, letterSpacing: -10, color: s.accent, fontVariantNumeric: 'tabular-nums' }}>{figure}</span>
      <span style={{ fontSize: headlineSize(post.headline, 56), fontWeight: 600, lineHeight: 1.1, letterSpacing: -1.5, marginTop: 28, maxWidth: W - PAD * 2, color: s.ink }}>{post.headline}</span>
      {post.subline ? <span style={{ fontSize: 28, lineHeight: 1.35, color: s.muted, marginTop: 22, maxWidth: W - PAD * 2 - 60 }}>{post.subline}</span> : null}
    </Frame>
  )
}

// ── Drawing a post ──────────────────────────────────────────────────────────

// What the card needs for its style, fetched: the photo for the photo
// style (the headshot for a speaker), the headshot and the logo for the
// kinds that carry them.
async function imagesFor(post: Post, style: CardStyle): Promise<Images> {
  const src = post.source ?? {}
  const [photo, headshot, logo] = await Promise.all([
    style === 'photo' ? remoteImage(str(src.photo) || null) : Promise.resolve(null),
    post.kind === 'speaker' ? remoteImage(str(src.image) || null) : Promise.resolve(null),
    post.kind === 'sponsor' ? remoteImage(str(src.logo) || null) : Promise.resolve(null),
  ])
  return { photo, headshot, logo }
}

// The card as JSX. The photo style without a photo to show is drawn as the
// night, so a post is never left without its image.
export async function cardElement(post: Post, a: Assets, styleOverride?: CardStyle): Promise<React.ReactElement> {
  const brand = BRANDS[brandFor(post.series)]
  let style = styleOverride ?? styleOf(post.source)
  const images = await imagesFor(post, style)
  if (style === 'photo' && !images.photo && !(post.kind === 'speaker' && images.headshot)) style = 'night'
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
