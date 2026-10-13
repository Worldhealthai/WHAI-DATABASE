import { writeFile } from 'node:fs/promises'
import { ImageResponse } from 'next/og'
import { loadAssets, FONTS } from '@/lib/contentCard'
import { renderSlide } from '@/lib/contentCarousel'

const OUT = process.env.OUT!
const offline = process.env.OFFLINE === '1'
const tag = offline ? 'offline' : 'online'
const realFetch = globalThis.fetch
const calls: string[] = []
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : (input?.url ?? String(input))
  calls.push(url)
  if (offline) throw new Error('no egress (simulated)')
  return realFetch(input, init)
}) as typeof fetch

async function main() {
  const a = await loadAssets()
  const r = new ImageResponse(
    <div style={{ width: 1080, height: 320, display: 'flex', flexDirection: 'column', background: '#fff', color: '#000', fontFamily: 'Outfit', padding: 40 }}>
      <span style={{ fontSize: 80, fontWeight: 600 }}>Swipe → Łódź Şahin</span>
      <span style={{ fontSize: 80, fontWeight: 400 }}>Nguyễn ↑↓ ñ Ł Ş</span>
    </div>,
    { width: 1080, height: 320, fonts: FONTS(a) },
  )
  await writeFile(`${OUT}/line-${tag}.png`, Buffer.from(await r.arrayBuffer()))
  const post = { series: 'World Health AI', source: { style: 'night', slides: [
    { kind: 'news', kicker: 'The news', headline: 'Łódź hospital trials Şahin model', summary: 'A summary line.' },
    { kind: 'end', headline: 'Read on', link: 'https://worldhealth.ai' },
  ] } } as any
  const s = await renderSlide(post, 0)
  await writeFile(`${OUT}/slide-${tag}.png`, Buffer.from(await s.arrayBuffer()))
  console.log(`[${tag}] fetch calls:\n` + calls.map((c) => '  ' + c).join('\n'))
}
main().catch((e) => { console.error('FAILED', e); process.exit(1) })
