// A LinkedIn carousel drawn from an Insights briefing: a few portrait slides
// (1080 by 1350, the size LinkedIn shows largest in the feed), each one
// kind of thing from the piece: the news, one statistic, the data, a quote,
// and a last slide pointing to the full briefing. LinkedIn takes a carousel
// as a PDF document, one page per slide, so the slides are also bound into
// a PDF here. The same styles as the single cards (lib/contentCard): the
// cover slide takes the style (a photo, the brand colour, a frame, bands,
// a mosaic), and the slides after it follow in the night; the light style
// keeps every slide on white. No dates on the slides.

import { ImageResponse } from 'next/og'
import { PDFDocument } from 'pdf-lib'
import { BRANDS, brandFor, photosOf, styleOf, type Brand, type CardStyle } from '@/lib/contentBrand'
import { BandsGround, BlockGround, FONTS, FrameGround, Kicker, LightGround, Mark, MosaicGround, PhotoGround, Wash, alpha, loadAssets, remoteImage, skinFor, type Assets, type Skin } from '@/lib/contentCard'

export const SLIDE_W = 1080
export const SLIDE_H = 1350
const PAD = 88
const WIDTH = SLIDE_W - PAD * 2

export type Slide =
  | { kind: 'news'; kicker: string; headline: string; summary: string; date?: string | null }
  | { kind: 'statistic'; figure: string; label: string; context: string; source?: string | null }
  | { kind: 'data'; title: string; points: { figure: string; label: string }[]; source?: string | null }
  | { kind: 'quote'; text: string; speaker: string; role: string; source?: string | null }
  | { kind: 'end'; headline: string; link: string }

export interface CarouselPost {
  series: string
  source: { slides?: Slide[] } & Record<string, unknown>
}

export const slidesOf = (post: CarouselPost): Slide[] => (Array.isArray(post.source?.slides) ? (post.source.slides as Slide[]) : [])

// The headline shrinks as it lengthens.
function sized(text: string, max: number): number {
  const n = text.length
  if (n <= 30) return max
  if (n <= 50) return Math.round(max * 0.86)
  if (n <= 75) return Math.round(max * 0.74)
  if (n <= 110) return Math.round(max * 0.64)
  return Math.round(max * 0.56)
}

// The cover's ground in its style.
const MOSAIC = { top: 520, gap: 10, bigW: 640 }
const FRAME = { w: 430, h: 560, x: SLIDE_W - 430 - 70, y: 230 }
function Cover({ brand, s, photos }: { brand: Brand; s: Skin; photos: string[] }) {
  switch (s.style) {
    case 'photo': return <PhotoGround brand={brand} src={photos[0]} w={SLIDE_W} h={SLIDE_H} fade={0.72} />
    case 'light': return <LightGround brand={brand} w={SLIDE_W} h={SLIDE_H} />
    case 'block': return <BlockGround brand={brand} w={SLIDE_W} h={SLIDE_H} />
    case 'bands': return <BandsGround brand={brand} w={SLIDE_W} h={SLIDE_H} />
    case 'frame': return <FrameGround brand={brand} image={photos[0]} w={SLIDE_W} h={SLIDE_H} f={FRAME} />
    case 'mosaic':
      return (
        <>
          <MosaicGround brand={brand} photos={photos} w={SLIDE_W} m={MOSAIC} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_W, height: 220, background: `linear-gradient(to bottom, ${alpha(brand.night, 0.75)} 0%, ${alpha(brand.night, 0)} 100%)` }} />
        </>
      )
    default: return null
  }
}

function Frame({ brand, a, s, n, total, children, corner = 'top', cover = null }: { brand: Brand; a: Assets; s: Skin; n: number; total: number; children: React.ReactNode; corner?: 'top' | 'bottom'; cover?: string[] | null }) {
  const full: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: SLIDE_W, height: SLIDE_H }
  const light = s.style === 'light'
  const block = s.style === 'block'
  // The words sit at the foot under a photo or beside a frame, in the clear
  // left of the bands, under the mosaic, else in the middle.
  const justify = cover && (s.style === 'photo' || s.style === 'frame') ? 'flex-end' : 'center'
  const width = cover && s.style === 'bands' ? 560 : WIDTH
  const top = cover && s.style === 'mosaic' ? MOSAIC.top + 40 : PAD
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, display: 'flex', background: s.bg, color: s.ink, fontFamily: 'Outfit', position: 'relative', overflow: 'hidden' }}>
      {cover ? <Cover brand={brand} s={s} photos={cover} /> : light ? <LightGround brand={brand} w={SLIDE_W} h={SLIDE_H} /> : <Wash brand={brand} corner={corner} w={SLIDE_W} h={SLIDE_H} />}
      {light || block ? null : <div style={{ position: 'absolute', left: 0, top: SLIDE_H - 14, width: SLIDE_W, height: 14, background: s.shape }} />}
      <div style={{ ...full, display: 'flex', flexDirection: 'column', padding: `${PAD}px ${PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: WIDTH }}>
          <Mark brand={brand} assets={a} size={0.86} on={s.on} />
          <span style={{ fontSize: 24, color: cover && s.style === 'mosaic' ? '#C7CBD6' : s.faint, fontVariantNumeric: 'tabular-nums' }}>{`${n} / ${total}`}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: justify, width, paddingTop: top - PAD, paddingBottom: justify === 'flex-end' ? 70 : 40 }}>{children}</div>
        {/* On the brand colour the cue keeps to the left, clear of the night disc in the corner. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: block ? 'flex-start' : 'space-between', width: WIDTH, fontSize: 24, paddingBottom: 60, color: s.faint }}>
          <span>{brand.site}</span>
          {n < total ? <span style={{ color: s.accent, fontWeight: 600, marginLeft: block ? 40 : 0 }}>Swipe →</span> : <span />}
        </div>
      </div>
    </div>
  )
}

function Body({ slide, s, width = WIDTH }: { slide: Slide; s: Skin; width?: number }) {
  const bar = s.style === 'light' || s.style === 'block'
  switch (slide.kind) {
    case 'news':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width }}>
          <Kicker text={slide.kicker} s={s} size={24} bar={bar} />
          <span style={{ fontSize: sized(slide.headline, width < 700 ? 72 : 92), fontWeight: 600, lineHeight: 1.06, letterSpacing: -2.5, maxWidth: width, color: s.ink }}>{slide.headline}</span>
          {slide.summary ? <span style={{ fontSize: width < 700 ? 30 : 34, lineHeight: 1.4, color: s.muted, marginTop: 40, maxWidth: width - 40 }}>{slide.summary}</span> : null}
        </div>
      )
    case 'statistic': {
      const len = slide.figure.length
      const size = len <= 3 ? 330 : len <= 5 ? 270 : len <= 8 ? 200 : 150
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width }}>
          <Kicker text="The number" s={s} size={24} bar={bar} />
          <span style={{ fontSize: size, fontWeight: 600, lineHeight: 0.95, letterSpacing: -8, color: s.accent, fontVariantNumeric: 'tabular-nums' }}>{slide.figure}</span>
          <span style={{ fontSize: sized(slide.label, 58), fontWeight: 600, lineHeight: 1.12, letterSpacing: -1.5, marginTop: 36, maxWidth: width, color: s.ink }}>{slide.label}</span>
          {slide.context ? <span style={{ fontSize: 32, lineHeight: 1.4, color: s.muted, marginTop: 26, maxWidth: width - 40 }}>{slide.context}</span> : null}
        </div>
      )
    }
    case 'data':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width }}>
          <Kicker text="The data" s={s} size={24} bar={bar} />
          <span style={{ fontSize: sized(slide.title, 58), fontWeight: 600, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: width, marginBottom: 34, color: s.ink }}>{slide.title}</span>
          <div style={{ display: 'flex', flexDirection: 'column', width }}>
            {slide.points.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', borderTop: `1px solid ${s.line}`, padding: '26px 0' }}>
                <span style={{ width: 330, flexShrink: 0, fontSize: p.figure.length > 8 ? 56 : 72, fontWeight: 600, letterSpacing: -2.5, color: s.accent, fontVariantNumeric: 'tabular-nums' }}>{p.figure}</span>
                <span style={{ flex: 1, fontSize: 30, lineHeight: 1.3, color: s.ink }}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )
    case 'quote': {
      const size = slide.text.length <= 80 ? 64 : slide.text.length <= 140 ? 54 : slide.text.length <= 200 ? 46 : 40
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width }}>
          <Kicker text="In their words" s={s} size={24} bar={bar} />
          <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `10px solid ${s.shape}`, paddingLeft: 44 }}>
            <span style={{ fontSize: size, fontWeight: 600, lineHeight: 1.2, letterSpacing: -1.5, maxWidth: width - 60, color: s.ink }}>{`“${slide.text}”`}</span>
            <span style={{ fontSize: 32, fontWeight: 600, marginTop: 40, color: s.ink }}>{slide.speaker}</span>
            {slide.role ? <span style={{ fontSize: 28, color: s.muted, marginTop: 8, maxWidth: width - 60 }}>{slide.role}</span> : null}
          </div>
        </div>
      )
    }
    case 'end':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width }}>
          <Kicker text="Read the briefing" s={s} size={24} bar={bar} />
          <span style={{ fontSize: sized(slide.headline, 80), fontWeight: 600, lineHeight: 1.08, letterSpacing: -2, maxWidth: width, color: s.ink }}>{slide.headline}</span>
          <span style={{ fontSize: 32, color: s.accent, fontWeight: 600, marginTop: 44, maxWidth: width }}>{slide.link.replace(/^https?:\/\/(www\.)?/, '')}</span>
          <span style={{ fontSize: 30, color: s.muted, marginTop: 20 }}>Every figure here is referenced in the full briefing.</span>
        </div>
      )
  }
}

// What the cover needs for the post's style, fetched; a style without its
// photos is drawn as the night.
async function coverFor(post: CarouselPost, style: CardStyle): Promise<{ style: CardStyle; photos: string[] }> {
  const need = style === 'mosaic' ? 3 : style === 'photo' || style === 'frame' ? 1 : 0
  const photos = (await Promise.all(photosOf(post.source).slice(0, need).map((p) => remoteImage(p)))).filter((p): p is string => Boolean(p))
  return photos.length < need ? { style: 'night', photos: [] } : { style, photos }
}

// One slide as a PNG. The cover slide takes the style; the slides after it
// follow in the night (or on white, for the light style).
export async function renderSlide(post: CarouselPost, index: number): Promise<ImageResponse> {
  const brand = BRANDS[brandFor(post.series)]
  const a = await loadAssets()
  const slides = slidesOf(post)
  const i = Math.min(Math.max(0, index), Math.max(0, slides.length - 1))
  const slide = slides[i] ?? { kind: 'end', headline: 'No slides yet', link: brand.url }
  const asked = styleOf(post.source)
  const cover = i === 0 ? await coverFor(post, asked) : null
  const style: CardStyle = cover ? cover.style : asked === 'light' ? 'light' : 'night'
  const s = skinFor(brand, style)
  const width = cover && style === 'bands' ? 560 : WIDTH
  return new ImageResponse(
    (
      <Frame brand={brand} a={a} s={s} n={i + 1} total={Math.max(1, slides.length)} corner={slide.kind === 'statistic' || slide.kind === 'quote' ? 'bottom' : 'top'} cover={cover && style !== 'night' ? cover.photos : null}>
        <Body slide={slide} s={s} width={width} />
      </Frame>
    ),
    { width: SLIDE_W, height: SLIDE_H, fonts: FONTS(a) },
  )
}

// Every slide as a PNG, in order.
export async function renderSlidePngs(post: CarouselPost): Promise<Uint8Array[]> {
  const out: Uint8Array[] = []
  const n = slidesOf(post).length
  for (let i = 0; i < n; i++) out.push(new Uint8Array(await (await renderSlide(post, i)).arrayBuffer()))
  return out
}

// Every slide bound into one PDF, a page each, at the slides' own size:
// what LinkedIn's "Add a document" takes as a carousel.
export async function renderCarouselPdf(post: CarouselPost, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  doc.setCreator('World Nexus Group CRM')
  for (const png of await renderSlidePngs(post)) {
    const img = await doc.embedPng(png)
    const page = doc.addPage([SLIDE_W, SLIDE_H])
    page.drawImage(img, { x: 0, y: 0, width: SLIDE_W, height: SLIDE_H })
  }
  return doc.save()
}

// The name each slide's file takes, by what it is.
export const slideFileName = (slide: Slide, i: number) =>
  `${String(i + 1).padStart(2, '0')} ${({ news: 'The news', statistic: 'The number', data: 'The data', quote: 'The quote', end: 'Read the briefing' } as Record<string, string>)[slide.kind] ?? slide.kind}.png`
