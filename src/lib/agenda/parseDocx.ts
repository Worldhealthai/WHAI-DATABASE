// Reads the team's Word agenda into the digital model.
//
// The document is a flat run of paragraphs: a centred title, date and
// venue; then, per session, a bold "HH:MMAM – HH:MMAM | Title" line, the
// panel's questions as bullets, and the speakers as bullets in the form
// "Name – Role – Organisation (Moderator)". A spotlight carries its talk
// title as a quoted line before the speaker. Anything the reader cannot
// place is kept as a note on the nearest session so nothing is lost.

import JSZip from 'jszip'
import { type Agenda, type Session, type SpeakerSlot, inferType, newId, to24h } from './model'

interface Para {
  text: string
  centred: boolean
  bold: boolean
  listed: boolean
  /** Which numbered list the paragraph belongs to, when it is in one */
  numId: string | null
  size: number | null
}

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

function paragraphs(xml: string): Para[] {
  const out: Para[] = []
  for (const m of Array.from(xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g))) {
    const p = m[0]
    const ppr = p.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/)?.[1] ?? ''
    const runs = Array.from(p.matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g)).map((r) => r[0])
    let text = ''
    let boldChars = 0
    let size: number | null = null
    for (const r of runs) {
      const rpr = r.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? ''
      const t = Array.from(r.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)).map((x) => unescapeXml(x[1])).join('')
      if (/<w:tab\/>/.test(r)) text += ' '
      if (!t) continue
      text += t
      if (/<w:b\/>|<w:b\s/.test(rpr) && !/<w:b w:val="(0|false)"/.test(rpr)) boldChars += t.length
      const sz = rpr.match(/<w:sz w:val="(\d+)"/)?.[1]
      if (sz && size === null) size = Number(sz)
    }
    out.push({
      text: text.replace(/\s+/g, ' ').trim(),
      centred: /<w:jc w:val="center"/.test(ppr),
      bold: text.trim().length > 0 && boldChars >= text.trim().length * 0.6,
      listed: /<w:numPr>/.test(ppr) || /<w:pStyle w:val="ListParagraph"/.test(ppr),
      numId: ppr.match(/<w:numId w:val="(\d+)"/)?.[1] ?? null,
      size,
    })
  }
  return out
}

// "8:30AM – 09:40AM | Registration" (dash and pipe vary)
const SESSION_RX = /^(\d{1,2}:\d{2}\s*(?:[AaPp][Mm])?)\s*[–—-]\s*(\d{1,2}:\d{2}\s*(?:[AaPp][Mm])?)\s*[|:]?\s*(.*)$/

// "Name – Role – Organisation (Moderator)"; the role may hold dashes of its own.
function parseSpeaker(line: string): SpeakerSlot {
  let s = line.trim()
  const moderator = /\((moderator|chair|host)\)/i.test(s)
  s = s.replace(/\s*\((moderator|chair|host)\)\s*/i, ' ').trim()
  const tbc = /\b(tbc|tba|to be confirmed)\b/i.test(s)
  // A status written in brackets is state, not part of the organisation.
  s = s.replace(/\s*\((tbc|tba|to be confirmed|invited|declined)\)\s*/gi, ' ').trim()
  const parts = s.split(/\s+[–—-]\s+/).map((x) => x.trim()).filter(Boolean)
  const name = parts[0] ?? s
  const role = parts.length > 2 ? parts.slice(1, -1).join(' – ') : parts[1] ?? ''
  const org = parts.length > 2 ? parts[parts.length - 1] : ''
  return { id: newId(), name, role, org, moderator, status: tbc ? 'tbc' : 'confirmed' }
}

// Lines the export writes where a seat is still empty.
const PLACEHOLDER_RX = /^(\d+ (moderators?|speakers?)( and \d+ (moderators?|speakers?))? TBC|speakers? TBC|speakers? to be confirmed|still needed:.*)$/i

const looksLikeQuestion = (t: string) => /\?$/.test(t) || /^(how|what|why|where|when|which|who|can|should|is|are|do|does|will)\b/i.test(t)
const looksLikeSpeaker = (t: string) => /\s[–—-]\s/.test(t) && !/\?$/.test(t) && t.length < 220
const looksLikeTalkTitle = (t: string) => /^[“"']/.test(t) || (/:/.test(t) && !/\s[–—-]\s/.test(t) && !looksLikeQuestion(t))

export async function parseAgendaDocx(file: Buffer | ArrayBuffer | Uint8Array, fileName?: string): Promise<Agenda> {
  const zip = await JSZip.loadAsync(file)
  const doc = zip.file('word/document.xml')
  if (!doc) throw new Error('Not a Word document (no word/document.xml).')
  const xml = await doc.async('string')
  const paras = paragraphs(xml).filter((p) => p.text)

  const agenda: Agenda = { title: '', dateLabel: '', venue: '', sessions: [], sourceFile: fileName ?? null }
  let current: Session | null = null
  let sawSession = false
  // This app's own classic export puts the questions and the people in two
  // separate Word lists. When a document is built that way, believe the
  // lists rather than guessing from punctuation — that is what lets a
  // speaker with no role ("Dr Alec Prices-Forbes") survive the round trip,
  // and keeps a question that happens to contain a dash out of the line-up.
  // A document with one list (or none) falls back to the heuristics below.
  const speakerLists = new Set<string>()
  const questionLists = new Set<string>()
  {
    const ids = new Set(paras.filter((p) => p.numId).map((p) => p.numId as string))
    if (ids.size >= 2) {
      for (const p of paras) {
        if (!p.numId) continue
        if (PLACEHOLDER_RX.test(p.text) || looksLikeSpeaker(p.text)) speakerLists.add(p.numId)
      }
      for (const id of Array.from(ids)) if (!speakerLists.has(id)) questionLists.add(id)
      // Only trust it when it actually separates the two.
      if (!speakerLists.size || !questionLists.size) { speakerLists.clear(); questionLists.clear() }
    }
  }

  for (const p of paras) {
    const m = p.text.match(SESSION_RX)
    if (m) {
      const title = m[3].trim()
      current = { id: newId(), start: to24h(m[1]), end: to24h(m[2]), title, type: inferType(title), points: [], speakers: [] }
      agenda.sessions.push(current)
      sawSession = true
      continue
    }
    if (!sawSession) {
      // The header block, in the order the team writes it.
      const t = p.text.replace(/^venue:\s*/i, '')
      if (!agenda.title) agenda.title = p.text
      else if (!agenda.dateLabel) agenda.dateLabel = p.text
      else if (!agenda.venue) agenda.venue = t
      else agenda.venue = `${agenda.venue} · ${t}`
      continue
    }
    if (!current) continue
    const t = p.text
    // Placeholder lines the export writes for empty seats are state, not people.
    if (PLACEHOLDER_RX.test(t)) continue
    if (current.type === 'break') {
      current.notes = [current.notes, t].filter(Boolean).join('\n')
      continue
    }
    if (p.numId && speakerLists.has(p.numId)) {
      current.speakers.push(parseSpeaker(t))
    } else if (p.numId && questionLists.has(p.numId)) {
      current.points.push(t)
    } else if (/^[“"']/.test(t) && !current.talkTitle) {
      // A quoted line is the talk's title, dashes and all.
      current.talkTitle = t.replace(/^[“"']|[”"']$/g, '').trim()
    } else if (looksLikeQuestion(t) && !looksLikeSpeaker(t)) {
      current.points.push(t)
    } else if (looksLikeSpeaker(t) && (p.listed || p.size === null || p.size <= 20 || current.points.length > 0 || current.type !== 'panel')) {
      current.speakers.push(parseSpeaker(t))
    } else if (looksLikeTalkTitle(t) && !current.talkTitle) {
      current.talkTitle = t.replace(/^[“"']|[”"']$/g, '').trim()
    } else if (looksLikeSpeaker(t)) {
      current.speakers.push(parseSpeaker(t))
    } else if (!current.talkTitle && (current.type === 'spotlight' || current.type === 'keynote')) {
      current.talkTitle = t
    } else {
      current.points.push(t)
    }
  }

  if (!agenda.sessions.length) throw new Error('No sessions found. Session lines look like "09:40AM – 10:05AM | Opening Keynote".')
  return agenda
}
