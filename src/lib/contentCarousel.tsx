// A LinkedIn carousel drawn from an Insights briefing: a few portrait slides
// (1080 by 1350, the size LinkedIn shows largest in the feed), each one
// kind of thing from the piece: the news, one statistic, the data, a quote,
// and a last slide pointing to the full briefing. LinkedIn takes a carousel
// as a PDF document, one page per slide, so the slides are also bound into
// a PDF here. Same look as the single cards (lib/contentCard): the page's
// night, a soft wash of its colour, its mark, sharp corners, Inter.

import { ImageResponse } from 'next/og'
import { PDFDocument } from 'pdf-lib'
import { BRANDS, brandFor, type Brand } from '@/lib/contentBrand'
import { Mark, alpha, loadAssets, type Assets } from '@/lib/contentCard'

export const SLIDE_W = 1080
export const SLIDE_H = 1350
const PAD = 88
const MUTED = '#C7CBD6'
const FAINT = '#8A93A6'
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

function Frame({ brand, a, n, total, children, corner = 'top' }: { brand: Brand; a: Assets; n: number; total: number; children: React.ReactNode; corner?: 'top' | 'bottom' }) {
  const from = corner === 'top' ? '160deg' : '340deg'
  const full: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: SLIDE_W, height: SLIDE_H }
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, display: 'flex', background: brand.night, color: '#fff', fontFamily: 'Inter', position: 'relative' }}>
      {/* The wash, on the unpadded slide so it covers all of it. */}
      <div style={{ ...full, background: `linear-gradient(${from}, ${alpha(brand.accent, 0.4)} 0%, ${alpha(brand.accent, 0.13)} 34%, ${alpha(brand.accent, 0)} 62%)` }} />
      <div style={{ ...full, background: `radial-gradient(circle at ${corner === 'top' ? '100% 100%' : '0% 0%'}, ${alpha(brand.accent, 0.15)} 0%, ${alpha(brand.accent, 0)} 48%)` }} />
      <div style={{ position: 'absolute', left: 0, top: SLIDE_H - 14, width: SLIDE_W, height: 14, background: brand.accent }} />
      <div style={{ ...full, display: 'flex', flexDirection: 'column', padding: `${PAD}px ${PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: WIDTH }}>
          <Mark brand={brand} assets={a} size={0.86} />
          <span style={{ fontSize: 24, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>{`${n} / ${total}`}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: WIDTH, paddingBottom: 40 }}>{children}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: WIDTH, fontSize: 24, paddingBottom: 60, color: FAINT }}>
          <span>{brand.site}</span>
          {n < total ? <span style={{ color: brand.accent, fontWeight: 600 }}>Swipe →</span> : <span />}
        </div>
      </div>
    </div>
  )
}

const Kicker = ({ text, brand }: { text: string; brand: Brand }) =>
  text ? <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: brand.accent, marginBottom: 30 }}>{text}</span> : null

const SourceLine = ({ source }: { source?: string | null }) =>
  source ? <span style={{ fontSize: 24, color: FAINT, marginTop: 44 }}>{`Source: ${source}`}</span> : null

const Col = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>{children}</div>

function SlideBody({ slide, brand }: { slide: Slide; brand: Brand }) {
  return <Col><Body slide={slide} brand={brand} /></Col>
}

function Body({ slide, brand }: { slide: Slide; brand: Brand }) {
  switch (slide.kind) {
    case 'news':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Kicker text={slide.kicker} brand={brand} />
          <span style={{ fontSize: sized(slide.headline, 92), fontWeight: 600, lineHeight: 1.06, letterSpacing: -2.5, maxWidth: WIDTH }}>{slide.headline}</span>
          {slide.summary ? <span style={{ fontSize: 34, lineHeight: 1.4, color: MUTED, marginTop: 40, maxWidth: WIDTH - 40 }}>{slide.summary}</span> : null}
          {slide.date ? <span style={{ fontSize: 26, color: brand.accent, fontWeight: 600, marginTop: 40 }}>{slide.date}</span> : null}
        </div>
      )
    case 'statistic': {
      const len = slide.figure.length
      const size = len <= 3 ? 330 : len <= 5 ? 270 : len <= 8 ? 200 : 150
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Kicker text="The number" brand={brand} />
          <span style={{ fontSize: size, fontWeight: 600, lineHeight: 0.95, letterSpacing: -8, color: brand.accent, fontVariantNumeric: 'tabular-nums' }}>{slide.figure}</span>
          <span style={{ fontSize: sized(slide.label, 58), fontWeight: 600, lineHeight: 1.12, letterSpacing: -1.5, marginTop: 36, maxWidth: WIDTH }}>{slide.label}</span>
          {slide.context ? <span style={{ fontSize: 32, lineHeight: 1.4, color: MUTED, marginTop: 26, maxWidth: WIDTH - 40 }}>{slide.context}</span> : null}
          <SourceLine source={slide.source} />
        </div>
      )
    }
    case 'data':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Kicker text="The data" brand={brand} />
          <span style={{ fontSize: sized(slide.title, 58), fontWeight: 600, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: WIDTH, marginBottom: 34 }}>{slide.title}</span>
          <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
            {slide.points.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', borderTop: `1px solid ${alpha('#FFFFFF', 0.16)}`, padding: '26px 0' }}>
                <span style={{ width: 330, flexShrink: 0, fontSize: p.figure.length > 8 ? 56 : 72, fontWeight: 600, letterSpacing: -2.5, color: brand.accent, fontVariantNumeric: 'tabular-nums' }}>{p.figure}</span>
                <span style={{ flex: 1, fontSize: 30, lineHeight: 1.3, color: '#fff' }}>{p.label}</span>
              </div>
            ))}
          </div>
          <SourceLine source={slide.source} />
        </div>
      )
    case 'quote': {
      const size = slide.text.length <= 80 ? 64 : slide.text.length <= 140 ? 54 : slide.text.length <= 200 ? 46 : 40
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Kicker text="In their words" brand={brand} />
          <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `10px solid ${brand.accent}`, paddingLeft: 44 }}>
            <span style={{ fontSize: size, fontWeight: 600, lineHeight: 1.2, letterSpacing: -1.5, maxWidth: WIDTH - 60 }}>{`“${slide.text}”`}</span>
            <span style={{ fontSize: 32, fontWeight: 600, marginTop: 40 }}>{slide.speaker}</span>
            {slide.role ? <span style={{ fontSize: 28, color: MUTED, marginTop: 8, maxWidth: WIDTH - 60 }}>{slide.role}</span> : null}
          </div>
          <SourceLine source={slide.source} />
        </div>
      )
    }
    case 'end':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH }}>
          <Kicker text="Read the briefing" brand={brand} />
          <span style={{ fontSize: sized(slide.headline, 80), fontWeight: 600, lineHeight: 1.08, letterSpacing: -2, maxWidth: WIDTH }}>{slide.headline}</span>
          <span style={{ fontSize: 32, color: brand.accent, fontWeight: 600, marginTop: 44, maxWidth: WIDTH }}>{slide.link.replace(/^https?:\/\/(www\.)?/, '')}</span>
          <span style={{ fontSize: 30, color: MUTED, marginTop: 20 }}>Every figure on these slides is from the sources cited there.</span>
        </div>
      )
  }
}

const FONTS = (a: Assets) => [
  { name: 'Inter', data: a.regular, weight: 400 as const, style: 'normal' as const },
  { name: 'Inter', data: a.semibold, weight: 600 as const, style: 'normal' as const },
]

// One slide as a PNG.
export async function renderSlide(post: CarouselPost, index: number): Promise<ImageResponse> {
  const brand = BRANDS[brandFor(post.series)]
  const a = await loadAssets()
  const slides = slidesOf(post)
  const i = Math.min(Math.max(0, index), Math.max(0, slides.length - 1))
  const slide = slides[i] ?? { kind: 'end', headline: 'No slides yet', link: brand.url }
  return new ImageResponse(
    (
      <Frame brand={brand} a={a} n={i + 1} total={Math.max(1, slides.length)} corner={slide.kind === 'statistic' || slide.kind === 'quote' ? 'bottom' : 'top'}>
        <SlideBody slide={slide} brand={brand} />
      </Frame>
    ),
    { width: SLIDE_W, height: SLIDE_H, fonts: FONTS(a) },
  )
}

// Every slide bound into one PDF, a page each, at the slides' own size:
// what LinkedIn's "Add a document" takes as a carousel.
export async function renderCarouselPdf(post: CarouselPost, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  doc.setCreator('World Nexus Group CRM')
  const n = slidesOf(post).length
  for (let i = 0; i < n; i++) {
    const png = new Uint8Array(await (await renderSlide(post, i)).arrayBuffer())
    const img = await doc.embedPng(png)
    const page = doc.addPage([SLIDE_W, SLIDE_H])
    page.drawImage(img, { x: 0, y: 0, width: SLIDE_W, height: SLIDE_H })
  }
  return doc.save()
}
