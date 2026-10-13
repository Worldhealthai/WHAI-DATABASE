// GET /api/marketing/content/sample?series=&city=&year=&kind=&style=[&format=carousel]
// A sample card in one look, for the look gallery on the draft panel:
// the edition's own brand, city and date, a speaker and a sponsor from
// its line-up when it has them, and sample words for the rest. Nothing
// is saved.
import { NextRequest, NextResponse } from 'next/server'
import { renderCard } from '@/lib/contentCard'
import { renderSlide } from '@/lib/contentCarousel'
import { BRANDS, brandFor, isCardStyle, photosFor } from '@/lib/contentBrand'
import { galleryPhotos } from '@/lib/contentGallery'
import { fetchLineup, type Edition, type Lineup } from '@/lib/marketingSource'

export const dynamic = 'force-dynamic'

const TTL = 5 * 60 * 1000
const lineups = new Map<string, { at: number; lineup: Lineup }>()
async function lineupFor(ed: Edition): Promise<Lineup> {
  const hit = lineups.get(ed.label)
  if (hit && Date.now() - hit.at < TTL) return hit.lineup
  try {
    const lineup = await fetchLineup(ed)
    lineups.set(ed.label, { at: Date.now(), lineup })
    return lineup
  } catch {
    return hit?.lineup ?? { event: null, speakers: [], sponsors: [] }
  }
}

// The words of the sample, by kind: what a post of that kind reads like.
function words(kind: string, brand: keyof typeof BRANDS, city: string) {
  const place = city || 'the summit'
  switch (kind) {
    case 'speaker': return { kicker: 'On the line-up', headline: `Confirmed for the stage in ${place}`, subline: 'Their session, and why it matters this year' }
    case 'session': return { kicker: 'Panel discussion', headline: brand === 'pharma' ? 'Can AI shorten the path from target to candidate without losing rigour?' : 'Can the NHS scale AI without exposing its most valuable data?', subline: '15:25, main stage' }
    case 'theme': return { kicker: 'On the agenda', headline: brand === 'pharma' ? 'Who signs off a model that changes a manufacturing batch?' : 'Who is accountable when an AI tool gets a diagnosis wrong?', subline: 'From the session: Clinical safety in practice' }
    case 'countdown': return { kicker: `${place} ${new Date().getFullYear() + 1}`, headline: 'Days to go', subline: 'Senior leaders from qualifying organisations attend free' }
    case 'sponsor': return { kicker: 'Gold sponsor', headline: `Joining us in ${place}`, subline: 'Bringing its clinical AI work to the exhibition floor' }
    case 'platform': return { kicker: 'The platform', headline: 'Vendors on the map', subline: 'Every company building AI for healthcare and pharma, with the capital behind them' }
    case 'signal': return { kicker: 'Market signal', headline: 'Why hiring tells you where the deployments are going', subline: 'What the platform watches, and what it means for buyers' }
    case 'event': return { kicker: 'Across the group', headline: `World Health AI returns to ${city || 'London'}`, subline: 'One day, the leaders who decide, and the AI that is already in service' }
    default:
      return brand === 'pharma'
        ? { kicker: 'From our Insights desk', headline: 'Where AI is shortening the path from target to candidate', subline: 'What the latest discovery deals say about the next two years' }
        : brand === 'nexus'
        ? { kicker: 'From our Insights desk', headline: 'Funding into healthcare AI rose again last quarter', subline: 'The deals, the buyers, and what they signal' }
        : { kicker: 'From our Insights desk', headline: 'NHS trusts cut reporting times with AI triage in radiology', subline: 'What the latest pilots show about the backlog, and who is paying for it' }
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const series = q.get('series') || 'World Health AI'
  const city = q.get('city') || ''
  const year = q.get('year') || ''
  const kind = q.get('kind') || 'insight'
  const style = q.get('style')
  if (!isCardStyle(style)) return NextResponse.json({ error: 'style must be one of the looks' }, { status: 400 })
  const brand = brandFor(series)
  const ed: Edition = { series, city, year, label: `${series}${city ? ` ${city}` : ''}${year ? ` ${year}` : ''}` }
  const needLineup = brand !== 'nexus' && (kind === 'speaker' || kind === 'session' || kind === 'sponsor' || kind === 'countdown' || kind === 'theme')
  const [photos, lineup] = await Promise.all([
    photosFor(style) ? galleryPhotos(series) : Promise.resolve([] as string[]),
    needLineup ? lineupFor(ed) : Promise.resolve<Lineup>({ event: null, speakers: [], sponsors: [] }),
  ])
  const speaker = lineup.speakers.find((s) => s.image && s.name) ?? lineup.speakers.find((s) => s.name)
  const sponsor = lineup.sponsors.find((s) => s.logo && s.name)
  const date = lineup.event?.date || ''
  const base: Record<string, unknown> = { style, photo: photos[0], photos: photos.slice(0, 3), city: lineup.event?.city || city, date }
  const source: Record<string, unknown> =
    kind === 'speaker' ? { ...base, name: speaker?.name ?? 'A confirmed speaker', role: speaker?.role ?? 'Their role', org: speaker?.org ?? 'Their organisation', image: speaker?.image ?? null }
    : kind === 'session' ? { ...base, speakers: lineup.speakers.filter((s) => s.name).slice(0, 3).map((s, i) => ({ name: s.name, org: s.org, moderator: i === 0 })) }
    : kind === 'sponsor' ? { ...base, logo: sponsor?.logo ?? null, name: sponsor?.name ?? '' }
    : kind === 'countdown' ? { ...base, figure: '42', daysToGo: 42 }
    : kind === 'platform' ? { ...base, figure: '1,200' }
    : base
  const w = words(kind, brand, city)
  const post = { series, kind, ...w, source, edition: ed.label }
  const image = q.get('format') === 'carousel'
    ? await renderSlide({ ...post, source: { ...source, format: 'carousel', slides: [{ kind: 'news', kicker: w.kicker, headline: w.headline, summary: w.subline }, { kind: 'end', headline: w.headline, link: BRANDS[brand].url }] } } as Parameters<typeof renderSlide>[0], 0, style)
    : await renderCard(post, style)
  image.headers.set('Cache-Control', 'private, max-age=300')
  return image
}
