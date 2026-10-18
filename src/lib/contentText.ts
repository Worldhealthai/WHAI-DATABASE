// The words on a card or a slide, held to the room they have. Nothing here
// ever cuts a word or a figure in half: a draft that runs over is sent back
// to be rewritten (contentStudio, contentRoutine), and only as a last
// resort is text shortened, and then at the end of a sentence or a clause,
// else between words, never inside one. Figures are never shortened at all:
// "EUR 680 million" cut to "EUR 680 millio" is a wrong figure.

export interface Limit { field: string; text: string; max: number }

// The fields that run over their limit, for a rewrite or an error.
export function overruns(limits: Limit[]): Limit[] {
  return limits.filter((l) => l.text.trim().length > l.max)
}

export function describeOverruns(over: Limit[]): string {
  return over.map((l) => `${l.field} is ${l.text.trim().length} characters, at most ${l.max}: ${JSON.stringify(l.text.trim())}`).join('\n')
}

// Short words a line must not end on once shortened.
const DANGLING = /\s+(?:and|or|but|nor|the|a|an|of|to|for|from|with|in|on|at|by|as|into|than|that|which|who|its|their|our|is|are|was|were|be|has|have|had|will|across|between|through|over|under|after|before|about|per|vs)$/i

// Text shortened to at most `max` characters without breaking a word: at
// the last sentence end, else the last clause break, else the last space,
// in the second half of the room; then with no trailing connective or
// punctuation left hanging. A single word longer than the room is
// returned whole: a word is never cut.
export function fitText(text: string, max: number): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const room = t.slice(0, max + 1)
  const floor = Math.floor(max / 2)
  const last = (re: RegExp) => {
    let at = -1
    for (const m of room.matchAll(re)) if (m.index! + m[1].length <= max && m.index! >= floor) at = m.index! + m[1].length
    return at
  }
  let cut = last(/([.?!])(?=\s)/g)
  if (cut < 0) cut = last(/()[,;:](?=\s)/g)
  if (cut < 0) cut = room.lastIndexOf(' ')
  if (cut <= 0) return t.split(' ')[0]
  let out = t.slice(0, cut).trim()
  for (let prev = ''; prev !== out; ) {
    prev = out
    out = out.replace(/[\s,;:–—-]+$/, '').replace(DANGLING, '')
  }
  return out
}

