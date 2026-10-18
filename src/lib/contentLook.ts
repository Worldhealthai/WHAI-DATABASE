// A post's look: the style it is drawn in and the event photos it shows.
// Shared by the style picker (api/marketing/content/<id>/style) and the
// chat on a post (lib/contentStudio revisePost), which may be asked for
// another look or other photos.

import { isCardStyle, photosFor, photosOf, styleOf, stylesFor, type CardStyle } from '@/lib/contentBrand'
import { galleryPhotos, shuffle } from '@/lib/contentGallery'

export class LookError extends Error {}

// The post's source in the style asked for (else the next in turn), with
// fresh photos for a style that takes them: asking again, or asking for
// new photos, shuffles them.
export async function restyle(post: { series: string; kind: string; source: Record<string, unknown> | null }, asked?: CardStyle | null): Promise<{ source: Record<string, unknown>; style: CardStyle }> {
  const source = (post.source ?? {}) as Record<string, unknown>
  const current = styleOf(source)
  const gallery = await galleryPhotos(post.series)
  // A speaker's headshot stands in for one photo (the photo and frame styles).
  const own = post.kind === 'speaker' && typeof source.image === 'string' && source.image ? 1 : 0
  const possible = stylesFor(post.kind).filter((s) => photosFor(s) <= Math.max(gallery.length, own))
  let style: CardStyle
  if (isCardStyle(asked)) {
    if (!possible.includes(asked)) {
      if (!stylesFor(post.kind).includes(asked)) throw new LookError('A speaker\'s card shows their own photo, as it is, and no other: the mosaic and the tint are not among their looks.')
      throw new LookError(`The ${asked} look needs ${photosFor(asked)} event photo${photosFor(asked) === 1 ? '' : 's'} and the gallery on worldnexusgroup.com has ${gallery.length}.`)
    }
    style = asked
  } else {
    style = possible[(possible.indexOf(current) + 1) % possible.length] ?? 'night'
  }
  // Fresh photos for a style that takes them: ones the post is not showing.
  const had = photosOf(source)
  const need = photosFor(style)
  let photos = had.slice(0, need)
  if (need) {
    const fresh = gallery.filter((p) => !had.includes(p))
    photos = shuffle(fresh.length >= need ? fresh : gallery).slice(0, need)
  }
  // The old layout and design fields no longer decide anything.
  const { layout: _layout, design: _design, photo: _photo, photos: _photos, ...rest } = source
  return { source: { ...rest, style, ...(photos.length ? { photo: photos[0], photos } : {}) }, style }
}
