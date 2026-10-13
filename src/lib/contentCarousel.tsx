// A LinkedIn carousel drawn from an Insights briefing: a few portrait slides
// (1080 by 1350, the size LinkedIn shows largest in the feed), each one
// kind of thing from the piece: the news, one statistic, the data, a quote,
// and a last slide pointing to the full briefing. LinkedIn takes a carousel
// as a PDF document, one page per slide, so the slides are also bound into
// a PDF here. The same three styles as the single cards (lib/contentCard):
// the night with its wash, ink on white, or the night with an event photo
// behind the cover slide. No dates on the slides.

import { ImageResponse } from 'next/og'
import { PDFDocument } from 'pdf-lib'
import { BRANDS, brandFor, styleOf, type Brand } from '@/lib/contentBrand'
import { FONTS, Kicker, LightGround, Mark, PhotoGround, Wash, alpha, loadAssets, remoteImage, skinFor, type Assets, type Skin } from '@/lib/contentCard'

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

function Frame({ brand, a, s, n, total, children, corner = 'top', photo = null }: { brand: Brand; a: Assets; s: Skin; n: number; total: number; children: React.ReactNode; corner?: 'top' | 'bottom'; photo?: string | null }) {
  const full: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: SLIDE_W, height: SLIDE_H }
  const light = s.style === 'light'
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, display: 'flex', background: s.bg, color: s.ink, fontFamily: 'Outfit', position: 'relative', overflow: 'hidden' }}>
      {photo ? <PhotoGround brand={brand} src={photo} w={SLIDE_W} h={SLIDE_H} fade={0.72} /> : light ? <LightGround brand={brand} w={SLIDE_W} h={SLIDE_H} /> : <Wash brand={brand} corner={corner} w={SLIDE_W} h={SLIDE_H} />}
      {!light ? <div style={{ position: 'absolute', left: 0, top: SLIDE_H - 14, width: SLIDE_W, height: 14, background: s.shape }} /> : null}
      <div style={{ ...full, display: 'flex', flexDirection: 'column', padding: `${PAD}px ${PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: WIDTH }}>
          <Mark brand={brand} assets={a} size={0.86} on={light ? 'light' : 'night'} />
          <span style={{ fontSize: 24, color: s.faint, fontVariantNumeric: 'tabular-nums' }}>{`${n} / ${total}`}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: photo ? 'flex-end' : 'center', width: WIDTH, paddingBottom: photo ? 70 : 40 }}>{children}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: WIDTH, fontSize: 24, paddingBottom: 60, color: s.faint }}>
          <span>{brand.site}</span>
          {n < total ? <span style={{ color: s.accent, fontWeight: 600 }}>Swipe →</span> : <span />}
        </div>
      </div>
    </div>
  )
}

function Body({ slide, s }: { slide: Slide; s: Skin }) {
  const light = s.style === 'light'
  switch (slide.kind) {
    case 'news':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Kicker text={slide.kicker} s={s} size={24} bar={light} />
          <span style={{ fontSize: sized(slide.headline, 92), fontWeight: 600, lineHeight: 1.06, letterSpacing: -2.5, maxWidth: WIDTH, color: s.ink }}>{slide.headline}</span>
          {slide.summary ? <span style={{ fontSize: 34, lineHeight: 1.4, color: s.muted, marginTop: 40, maxWidth: WIDTH - 40 }}>{slide.summary}</span> : null}
        </div>
      )
    case 'statistic': {
      const len = slide.figure.length
      const size = len <= 3 ? 330 : len <= 5 ? 270 : len <= 8 ? 200 : 150
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Kicker text="The number" s={s} size={24} bar={light} />
          <span style={{ fontSize: size, fontWeight: 600, lineHeight: 0.95, letterSpacing: -8, color: s.accent, fontVariantNumeric: 'tabular-nums' }}>{slide.figure}</span>
          <span style={{ fontSize: sized(slide.label, 58), fontWeight: 600, lineHeight: 1.12, letterSpacing: -1.5, marginTop: 36, maxWidth: WIDTH, color: s.ink }}>{slide.label}</span>
          {slide.context ? <span style={{ fontSize: 32, lineHeight: 1.4, color: s.muted, marginTop: 26, maxWidth: WIDTH - 40 }}>{slide.context}</span> : null}
        </div>
      )
    }
    case 'data':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Kicker text="The data" s={s} size={24} bar={light} />
          <span style={{ fontSize: sized(slide.title, 58), fontWeight: 600, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: WIDTH, marginBottom: 34, color: s.ink }}>{slide.title}</span>
          <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Kicker text="In their words" s={s} size={24} bar={light} />
          <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `10px solid ${s.shape}`, paddingLeft: 44 }}>
            <span style={{ fontSize: size, fontWeight: 600, lineHeight: 1.2, letterSpacing: -1.5, maxWidth: WIDTH - 60, color: s.ink }}>{`“${slide.text}”`}</span>
            <span style={{ fontSize: 32, fontWeight: 600, marginTop: 40, color: s.ink }}>{slide.speaker}</span>
            {slide.role ? <span style={{ fontSize: 28, color: s.muted, marginTop: 8, maxWidth: WIDTH - 60 }}>{slide.role}</span> : null}
          </div>
        </div>
      )
    }
    case 'end':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Kicker text="Read the briefing" s={s} size={24} bar={light} />
          <span style={{ fontSize: sized(slide.headline, 80), fontWeight: 600, lineHeight: 1.08, letterSpacing: -2, maxWidth: WIDTH, color: s.ink }}>{slide.headline}</span>
          <span style={{ fontSize: 32, color: s.accent, fontWeight: 600, marginTop: 44, maxWidth: WIDTH }}>{slide.link.replace(/^https?:\/\/(www\.)?/, '')}</span>
          <span style={{ fontSize: 30, color: s.muted, marginTop: 20 }}>Every figure here is referenced in the full briefing.</span>
        </div>
      )
  }
}

// One slide as a PNG. The photo style puts the photo behind the cover
// slide; the others follow it in the night.
export async function renderSlide(post: CarouselPost, index: number): Promise<ImageResponse> {
  const brand = BRANDS[brandFor(post.series)]
  const a = await loadAssets()
  const slides = slidesOf(post)
  const i = Math.min(Math.max(0, index), Math.max(0, slides.length - 1))
  const slide = slides[i] ?? { kind: 'end', headline: 'No slides yet', link: brand.url }
  const style = styleOf(post.source)
  const photo = style === 'photo' && i === 0 ? await remoteImage(typeof post.source.photo === 'string' ? post.source.photo : null) : null
  const s = skinFor(brand, style === 'light' ? 'light' : 'night')
  return new ImageResponse(
    (
      <Frame brand={brand} a={a} s={s} n={i + 1} total={Math.max(1, slides.length)} corner={slide.kind === 'statistic' || slide.kind === 'quote' ? 'bottom' : 'top'} photo={photo}>
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Body slide={slide} s={s} />
        </div>
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

