// A LinkedIn carousel drawn from an Insights briefing: a few portrait slides
// (1080 by 1350, the size LinkedIn shows largest in the feed), each one
// kind of thing from the piece: the news, one statistic, the data, a quote,
// and a last slide pointing to the full briefing. LinkedIn takes a carousel
// as a PDF document, one page per slide, so the slides are also bound into
// a PDF here. The same styles as the single cards (lib/contentCard): the
// cover slide takes the style (a photo, the brand colour, a frame, bands,
// a mosaic, a seam, a masthead...), and the slides after it follow in the
// night; the white styles keep every slide on white. No dates on the
// slides.

import { ImageResponse } from 'next/og'
import { PDFDocument } from 'pdf-lib'
import { BRANDS, brandFor, photosFor, photosOf, styleOf, type Brand, type CardStyle } from '@/lib/contentBrand'
import { ArcsGround, BARS_H, BandsGround, BarsGround, BlockGround, FONTS, FrameGround, InitialGround, Kicker, LightGround, Mark, MosaicGround, PhotoGround, RingsGround, SplitGround, TAPE_W, TapeGround, TicksGround, TintGround, Wash, WedgeGround, alpha, barred, clip, loadAssets, onWhite, remoteImage, seedOf, skinFor, tapeText, tickMark, type Assets, type Skin } from '@/lib/contentCard'

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
// Where the cover's words begin in each style, measured from the top of
// the slide: under the mosaic's photos, the still's strip, the masthead's
// picture, or hanging from the split's seam.
const SEAM = Math.round(SLIDE_H * 0.42)
const RULE_Y = Math.round(SLIDE_H * 0.48)
const STRIP = { y: 196, h: 400 }
const MAST = { pic: 480 }
const COL = { w: 600, line: 728, mx: 768, mw: 224, top: 220 }
const coverTop = (style: CardStyle) =>
  style === 'mosaic' ? MOSAIC.top + 40 : style === 'split' ? SEAM + 48 - 58 : style === 'still' ? STRIP.y + STRIP.h + 64 - 58 : style === 'masthead' ? 254 + MAST.pic + 46 - 58 : PAD

function Cover({ brand, s, photos, seed, slide }: { brand: Brand; s: Skin; photos: string[]; seed: number; slide: Slide }) {
  const kicker = slide.kind === 'news' ? slide.kicker : slide.kind === 'end' ? 'From our Insights desk' : ''
  const headline = slide.kind === 'news' || slide.kind === 'end' ? slide.headline : slide.kind === 'data' ? slide.title : slide.kind === 'statistic' ? slide.label : slide.text
  const summary = slide.kind === 'news' ? slide.summary : slide.kind === 'statistic' ? slide.context : ''
  const rule = alpha('#0B0C10', 0.12)
  switch (s.style) {
    case 'split':
      return (
        <>
          <SplitGround brand={brand} seam={SEAM} w={SLIDE_W} />
          {kicker ? (
            <div style={{ position: 'absolute', left: PAD, top: SEAM - 74, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 44, height: 6, background: brand.onAccent, marginRight: 18 }} />
              <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: brand.onAccent }}>{kicker}</span>
            </div>
          ) : null}
        </>
      )
    case 'masthead':
      return (
        <>
          <div style={{ position: 'absolute', left: PAD, top: 160, width: WIDTH, height: 8, background: s.ink }} />
          <div style={{ position: 'absolute', left: PAD, top: 174, width: WIDTH, height: 2, background: s.ink }} />
          <div style={{ position: 'absolute', left: PAD, top: 186, width: WIDTH, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: s.accent }}>{kicker}</span>
            <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: s.faint }}>{brand.site}</span>
          </div>
          <div style={{ position: 'absolute', left: PAD, top: 226, width: WIDTH, height: 1, background: rule }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0]} alt="" width={WIDTH} height={MAST.pic} style={{ position: 'absolute', left: PAD, top: 254, width: WIDTH, height: MAST.pic, objectFit: 'cover' }} />
        </>
      )
    case 'column':
      return (
        <>
          <div style={{ position: 'absolute', left: COL.line, top: COL.top, width: 1, height: SLIDE_H - COL.top, background: alpha('#0B0C10', 0.14) }} />
          <div style={{ position: 'absolute', left: COL.mx, top: COL.top, width: COL.mw, display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: COL.mw, height: 6, background: brand.accent }} />
            {kicker ? <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: s.accent, padding: '22px 0', lineHeight: 1.4 }}>{kicker}</span> : null}
            <span style={{ fontSize: 22, lineHeight: 1.45, color: s.faint, padding: '22px 0', borderTop: `1px solid ${alpha('#0B0C10', 0.14)}` }}>{brand.site}</span>
          </div>
        </>
      )
    case 'tape': {
      const run = tapeText(brand, '', '')
      return <TapeGround brand={brand} text={run.text} size={run.size} w={SLIDE_W} h={SLIDE_H} />
    }
    case 'ticks': return <TicksGround brand={brand} mark={tickMark(null, SLIDE_W)} y={RULE_Y} w={SLIDE_W} />
    case 'tint': return <TintGround brand={brand} src={photos[0]} w={SLIDE_W} h={SLIDE_H} />
    case 'initial': return <InitialGround brand={brand} glyph={(headline.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase() || 'A').slice(0, /^[IJLT1]/.test(headline.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase()) ? 2 : 1)} w={SLIDE_W} h={SLIDE_H} />
    case 'still':
      return (
        <>
          <Wash brand={brand} corner="bottom" w={SLIDE_W} h={SLIDE_H} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0]} alt="" width={SLIDE_W} height={STRIP.h} style={{ position: 'absolute', left: 0, top: STRIP.y, width: SLIDE_W, height: STRIP.h, objectFit: 'cover' }} />
          <div style={{ position: 'absolute', left: 0, top: STRIP.y, width: SLIDE_W, height: STRIP.h, background: brand.night, opacity: 0.1 }} />
        </>
      )
    case 'photo': return <PhotoGround brand={brand} src={photos[0]} w={SLIDE_W} h={SLIDE_H} fade={0.72} />
    case 'light': return <LightGround brand={brand} w={SLIDE_W} h={SLIDE_H} />
    case 'block': return <BlockGround brand={brand} w={SLIDE_W} h={SLIDE_H} />
    case 'bands': return <BandsGround brand={brand} w={SLIDE_W} h={SLIDE_H} />
    case 'rings': return <RingsGround brand={brand} w={SLIDE_W} h={SLIDE_H} />
    case 'bars': return <BarsGround brand={brand} seed={seed} w={SLIDE_W} h={SLIDE_H} />
    case 'arcs': return <ArcsGround brand={brand} w={SLIDE_W} h={SLIDE_H} />
    case 'wedge': return <WedgeGround brand={brand} w={SLIDE_W} h={SLIDE_H} />
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

// The words' width on a cover: beside the frame, clear of the bands, the
// arcs, the wedge and the tape, in the column's wide measure.
const coverWidth = (style: CardStyle | null) => (style === 'frame' ? FRAME.x - PAD - 50 : style === 'bands' || style === 'arcs' ? 560 : style === 'wedge' ? 720 : style === 'rings' ? WIDTH - 120 : style === 'tape' ? 740 : style === 'initial' ? 720 : style === 'column' ? COL.w : WIDTH)
// Where the words sit on a cover: at the foot under a photo, a wedge or a
// tint; from the top under the mosaic, the still and the masthead and
// hanging from the seam; else in the middle.
const coverJustify = (style: CardStyle | null): 'center' | 'flex-end' | 'flex-start' =>
  style === 'photo' || style === 'wedge' || style === 'tint' ? 'flex-end' : style === 'mosaic' || style === 'still' || style === 'masthead' || style === 'split' || style === 'ticks' ? 'flex-start' : 'center'

function Frame({ brand, a, s, n, total, children, corner = 'top', cover = null, seed = 0, slide }: { brand: Brand; a: Assets; s: Skin; n: number; total: number; children: React.ReactNode; corner?: 'top' | 'bottom'; cover?: string[] | null; seed?: number; slide: Slide }) {
  const full: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: SLIDE_W, height: SLIDE_H }
  const light = s.on === 'light'
  const block = s.style === 'block'
  const style = cover ? s.style : null
  const justify = coverJustify(style)
  const width = coverWidth(style)
  const top = style ? coverTop(style) : PAD
  // The words and the cue sit above the bars along the base; beside the tape.
  const bottom = style === 'bars' ? BARS_H : 0
  const left = style === 'tape' ? TAPE_W + PAD : PAD
  const measure = SLIDE_W - PAD - left
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, display: 'flex', background: s.bg, color: s.ink, fontFamily: 'Outfit', position: 'relative', overflow: 'hidden' }}>
      {cover ? <Cover brand={brand} s={s} photos={cover} seed={seed} slide={slide} /> : light ? <LightGround brand={brand} w={SLIDE_W} h={SLIDE_H} /> : <Wash brand={brand} corner={corner} w={SLIDE_W} h={SLIDE_H} />}
      {light || s.on === 'accent' ? null : <div style={{ position: 'absolute', left: 0, top: SLIDE_H - 14, width: SLIDE_W, height: 14, background: s.shape }} />}
      <div style={{ ...full, display: 'flex', flexDirection: 'column', padding: `${PAD}px ${PAD}px ${bottom}px ${left}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: measure }}>
          <Mark brand={brand} assets={a} size={0.86} on={s.on} />
          <span style={{ fontSize: 24, color: style === 'mosaic' ? '#C7CBD6' : s.faint, fontVariantNumeric: 'tabular-nums' }}>{`${n} / ${total}`}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: justify, width, paddingTop: top - PAD, paddingBottom: justify === 'flex-end' ? 70 : 40 }}>{children}</div>
        {/* On the brand colour the cue keeps to the left, clear of the night disc in the corner. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: block ? 'flex-start' : 'space-between', width: measure, fontSize: 24, paddingBottom: 60, color: s.faint }}>
          <span>{brand.site}</span>
          {n < total ? (
            <span style={{ display: 'flex', alignItems: 'center', color: s.accent, fontWeight: 600, marginLeft: block ? 40 : 0 }}>
              <span>Swipe</span>
              <svg width="30" height="24" viewBox="0 0 30 24" style={{ marginLeft: 10 }}>
                <path d="M2 12h24M17 4l9 8-9 8" fill="none" stroke={s.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : <span />}
        </div>
      </div>
    </div>
  )
}

function Body({ slide, s, width = WIDTH, site, kicker = true, summary = true }: { slide: Slide; s: Skin; width?: number; site: string; kicker?: boolean; summary?: boolean }) {
  const bar = barred(s.style)
  switch (slide.kind) {
    case 'news':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width }}>
          {kicker ? <Kicker text={slide.kicker} s={s} size={24} bar={bar} /> : null}
          <span style={{ fontSize: sized(slide.headline, width < 700 ? 72 : 92), fontWeight: 600, lineHeight: 1.06, letterSpacing: -2.5, maxWidth: width, color: s.ink }}>{slide.headline}</span>
          {slide.summary && summary ? <span style={{ fontSize: width < 700 ? 30 : 34, lineHeight: 1.4, color: s.muted, marginTop: 40, maxWidth: width - 40 }}>{slide.summary}</span> : null}
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
      // An editorial sign-off: no address and no claims about the checks;
      // the site is in the foot, the link in the caption.
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width }}>
          <Kicker text="From our Insights desk" s={s} size={24} bar={bar} />
          <span style={{ fontSize: sized(slide.headline, 80), fontWeight: 600, lineHeight: 1.08, letterSpacing: -2, maxWidth: width, color: s.ink }}>{slide.headline}</span>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 44 }}>
            <div style={{ width: 56, height: 4, background: s.shape, marginRight: 22 }} />
            <span style={{ fontSize: 30, color: s.muted }}>{`The full briefing is on ${site}`}</span>
          </div>
        </div>
      )
  }
}

// The timeline's cover: the kicker and the headline stand on the rule, the
// summary hangs beneath it.
function TicksBody({ slide, s }: { slide: Slide; s: Skin }) {
  const headline = slide.kind === 'news' || slide.kind === 'end' ? slide.headline : slide.kind === 'data' ? slide.title : slide.kind === 'statistic' ? slide.label : slide.text
  const summary = slide.kind === 'news' ? slide.summary : slide.kind === 'statistic' ? slide.context : ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: RULE_Y - 28 - (PAD + 58), width: WIDTH }}>
        <Kicker text={slide.kind === 'news' ? slide.kicker : 'From our Insights desk'} s={s} size={24} />
        <span style={{ fontSize: sized(headline, 72), fontWeight: 600, lineHeight: 1.06, letterSpacing: -2.5, maxWidth: WIDTH, color: s.ink }}>{headline}</span>
      </div>
      {summary ? <span style={{ fontSize: 32, lineHeight: 1.4, color: s.muted, marginTop: 76, maxWidth: WIDTH - 40 }}>{summary}</span> : null}
    </div>
  )
}

// The paper's cover: the photo in full colour, the logo over it, and a
// white sheet over the lower left carrying the words and the cue.
function PaperCover({ brand, a, s, n, total, slide, photo }: { brand: Brand; a: Assets; s: Skin; n: number; total: number; slide: Slide; photo: string }) {
  const light = skinFor(brand, 'light')
  const headline = slide.kind === 'news' || slide.kind === 'end' ? slide.headline : slide.kind === 'data' ? slide.title : slide.kind === 'statistic' ? slide.label : slide.text
  const summary = slide.kind === 'news' ? slide.summary : slide.kind === 'statistic' ? slide.context : ''
  const top = 620
  const width = 760 - PAD - 56
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, display: 'flex', background: s.bg, color: s.ink, fontFamily: 'Outfit', position: 'relative', overflow: 'hidden' }}>
      {/* The photo held high, so the band above the sheet shows its upper part. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" width={SLIDE_W} height={Math.round(SLIDE_H * 1.3)} style={{ position: 'absolute', left: 0, top: -250, width: SLIDE_W, height: Math.round(SLIDE_H * 1.3), objectFit: 'cover' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: SLIDE_W, height: SLIDE_H, background: brand.night, opacity: 0.22 }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: SLIDE_W, height: 320, background: `linear-gradient(to bottom, ${alpha(brand.night, 0.62)} 0%, ${alpha(brand.night, 0)} 100%)` }} />
      <div style={{ position: 'absolute', left: PAD, top: PAD, width: WIDTH, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Mark brand={brand} assets={a} size={0.86} on="night" />
        <span style={{ fontSize: 24, color: s.faint, fontVariantNumeric: 'tabular-nums' }}>{`${n} / ${total}`}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, top, width: 760, height: SLIDE_H - top, display: 'flex', flexDirection: 'column', background: '#FFFFFF', padding: `56px 56px 60px ${PAD}px`, color: light.ink }}>
        <Kicker text={slide.kind === 'news' ? slide.kicker : 'From our Insights desk'} s={light} size={24} bar />
        <span style={{ fontSize: sized(headline, 64), fontWeight: 600, lineHeight: 1.06, letterSpacing: -2, maxWidth: width, color: light.ink }}>{headline}</span>
        {summary ? <span style={{ fontSize: 28, lineHeight: 1.4, color: light.muted, marginTop: 28, maxWidth: width }}>{clip(summary, 170)}</span> : null}
        <div style={{ display: 'flex', flexGrow: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width, fontSize: 24, color: light.faint }}>
          <span>{brand.site}</span>
          {n < total ? (
            <span style={{ display: 'flex', alignItems: 'center', color: light.accent, fontWeight: 600 }}>
              <span>Swipe</span>
              <svg width="30" height="24" viewBox="0 0 30 24" style={{ marginLeft: 10 }}>
                <path d="M2 12h24M17 4l9 8-9 8" fill="none" stroke={light.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : <span />}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: SLIDE_H - 14, width: SLIDE_W, height: 14, background: brand.accent }} />
    </div>
  )
}

// What the cover needs for the post's style, fetched; a style without its
// photos is drawn as the night.
async function coverFor(post: CarouselPost, style: CardStyle): Promise<{ style: CardStyle; photos: string[] }> {
  const need = photosFor(style)
  const photos = (await Promise.all(photosOf(post.source).slice(0, need).map((p) => remoteImage(p)))).filter((p): p is string => Boolean(p))
  return photos.length < need ? { style: 'night', photos: [] } : { style, photos }
}

// One slide as a PNG. The cover slide takes the style (the post's, or one
// to preview); the slides after it follow in the night (or on white, for
// the light style).
export async function renderSlide(post: CarouselPost, index: number, styleOverride?: CardStyle): Promise<ImageResponse> {
  const brand = BRANDS[brandFor(post.series)]
  const a = await loadAssets()
  const slides = slidesOf(post)
  const i = Math.min(Math.max(0, index), Math.max(0, slides.length - 1))
  const slide = slides[i] ?? { kind: 'end', headline: 'No slides yet', link: brand.url }
  const asked = styleOverride ?? styleOf(post.source)
  const cover = i === 0 ? await coverFor(post, asked) : null
  const style: CardStyle = cover ? cover.style : onWhite(asked) ? 'light' : 'night'
  const s = skinFor(brand, style)
  const on = cover && style !== 'night'
  const width = coverWidth(on ? style : null)
  const n = i + 1
  const total = Math.max(1, slides.length)
  const seed = seedOf(slide.kind === 'news' ? slide.headline : '')
  if (on && style === 'paper') {
    return new ImageResponse(<PaperCover brand={brand} a={a} s={s} n={n} total={total} slide={slide} photo={cover.photos[0]} />, { width: SLIDE_W, height: SLIDE_H, fonts: FONTS(a) })
  }
  // The split's kicker stands in the colour, the masthead's in the folio,
  // the column's in the margin: the cover draws those.
  const kicker = !(on && (style === 'split' || style === 'masthead' || style === 'column'))
  const summary = true
  return new ImageResponse(
    (
      <Frame brand={brand} a={a} s={s} n={n} total={total} corner={slide.kind === 'statistic' || slide.kind === 'quote' ? 'bottom' : 'top'} cover={on ? cover.photos : null} seed={seed} slide={slide}>
        {on && style === 'ticks' ? <TicksBody slide={slide} s={s} /> : <Body slide={slide} s={s} width={width} site={brand.site} kicker={kicker} summary={summary} />}
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

// A Content-Disposition for a download whose name may hold any character:
// an ASCII name for old clients, the full name UTF-8 encoded beside it.
export function attachment(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120)
  const ascii = clean.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim() || 'post'
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`
}

// The name each slide's file takes, by what it is.
export const slideFileName = (slide: Slide, i: number) =>
  `${String(i + 1).padStart(2, '0')} ${({ news: 'The news', statistic: 'The number', data: 'The data', quote: 'The quote', end: 'Read the briefing' } as Record<string, string>)[slide.kind] ?? slide.kind}.png`
