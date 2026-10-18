// A post moved to another page: something written for World Nexus Group
// that belongs on World Pharma AI (or any page to any other). Claude
// rewrites it for that page (its readers, its voice, its link and its
// tag) from the same material, the figures and the quote checked again as
// when it was written; it is filed as a draft under that page's next
// edition, in a look that page's photos allow. The original draft goes,
// unless a copy is kept; a post already posted always stays where it is.

import { supabase } from '@/lib/supabase'
import { BRANDS, brandFor, nextStyle, styleOf, type BrandKey } from '@/lib/contentBrand'
import { routineEdition } from '@/lib/contentRoutine'
import { ContentError, gatherContext, nextFreeDay, photoFields, readPost, rewritePost, type ContentPost } from '@/lib/contentStudio'

export interface Transfer { post: ContentPost; removed: boolean; notes: string[] }

// The briefing on the page's own site when it is published there, else on
// worldnexusgroup.com, which carries every briefing: a pharma or health
// site sends a piece it does not carry back to its Insights index.
async function briefingLink(to: BrandKey, slug: string, fallback: string | null): Promise<string | null> {
  const own = `${BRANDS[to].url}/insights/${slug}`
  try {
    const r = await fetch(own, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (r.ok && new URL(r.url).pathname.replace(/\/+$/, '').endsWith(`/insights/${slug}`)) return own
  } catch {
    /* the group's own site below */
  }
  return fallback && fallback.includes('worldnexusgroup.com') ? fallback : `${BRANDS.nexus.url}/insights/${slug}`
}

export async function movePost(id: string, to: BrandKey, opts: { keep?: boolean; note?: string | null } = {}): Promise<Transfer> {
  const post = await readPost(id)
  const from = brandFor(post.series)
  if (from === to) throw new ContentError(`This post is already on ${BRANDS[to].name}.`, 400)
  const ed = await routineEdition(to)
  const ctx = await gatherContext(ed)
  const link = post.kind === 'insight' && post.ref ? await briefingLink(to, post.ref, post.link) : post.link
  const facts = { site: ctx.site, city: ed.city, date: ctx.event?.date ?? null }
  const steer = [
    `Rewrite this post for the ${BRANDS[to].name} LinkedIn page, for its own readers, from what the material says that matters to them. It was written for ${BRANDS[from].name}: nothing of that page may stay (its name, its tag, its "we", its link). The hashtags include ${BRANDS[to].tag}${ed.city ? ` and the city, ${ed.city}` : ''}.`,
    opts.note?.trim() ? `The team adds: ${opts.note.trim()}` : '',
  ].filter(Boolean).join(' ')
  const { patch, notes } = await rewritePost(post, steer, { page: `${ed.label}${to === 'nexus' ? ' (the group page, about the intelligence platform)' : ''}`, link, facts })

  // The look carried over where the page's photos allow it.
  const source = ((patch.source as Record<string, unknown> | undefined) ?? post.source) as Record<string, unknown>
  const style = nextStyle(ctx.recent, styleOf(post.source), ctx.photos.length, post.kind)
  const { before: _b, steers: _s, linkedin: _l, photo: _p, photos: _ps, ...kept } = source
  const row = {
    edition: ed.label,
    series: ed.series,
    kind: post.kind,
    ref: post.ref,
    forDate: await nextFreeDay(ed.label),
    kicker: post.kicker,
    headline: post.headline,
    subline: post.subline,
    caption: post.caption,
    hashtags: post.hashtags,
    ...patch,
    link,
    source: { ...kept, ...facts, style, ...photoFields(ctx, post.ref ?? post.kind, style), movedFrom: { edition: post.edition, id: post.id } },
    brief: post.brief,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('marketing_content').insert(row).select('*').single()
  if (error) throw error

  // The original goes once the new one is saved: a draft only, and only
  // when no copy is to be kept.
  let removed = false
  if (!opts.keep && post.status === 'draft') {
    const { error: delError } = await supabase.from('marketing_content').delete().eq('id', post.id)
    if (delError) notes.push(`the original could not be removed (${delError.message}), so it is still on ${post.edition}`)
    else removed = true
  }
  return { post: data as ContentPost, removed, notes }
}
