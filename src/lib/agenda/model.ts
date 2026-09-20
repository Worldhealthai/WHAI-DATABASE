// The digital agenda: one per edition. Sessions in running order, each
// with its speaker slots and whether each person is confirmed or still
// to be confirmed. Shared by the Production portal (edits it), the Sales
// portal (reads it) and the Word export.

export type SessionType = 'keynote' | 'panel' | 'fireside' | 'spotlight' | 'break' | 'other'
// A seat is either confirmed or still to be confirmed.
export type SlotStatus = 'confirmed' | 'tbc'

export interface SpeakerSlot {
  id: string
  name: string
  role: string
  org: string
  moderator: boolean
  status: SlotStatus
  /** The admin panel's speaker id when this person is on the event's line-up */
  lineupRef?: string | null
  notes?: string
}

export interface Seats {
  moderators: number
  speakers: number
}

export interface Session {
  id: string
  start: string // "09:40"
  end: string // "10:05"
  title: string
  type: SessionType
  /** A spotlight or keynote's talk title, shown under the session */
  talkTitle?: string
  /** The panel's questions / description points */
  points: string[]
  speakers: SpeakerSlot[]
  /** How many people the format takes; defaults come from the type */
  seats?: Seats
  notes?: string
}

export interface Agenda {
  title: string
  dateLabel: string
  venue: string
  sessions: Session[]
  /** Where it came from: the uploaded file's name, if any */
  sourceFile?: string | null
  updatedAt?: string
}

export const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'keynote', label: 'Keynote' },
  { value: 'panel', label: 'Panel' },
  { value: 'fireside', label: 'Fireside chat' },
  { value: 'spotlight', label: 'Spotlight' },
  { value: 'break', label: 'Break / networking' },
  { value: 'other', label: 'Other' },
]

export const SLOT_STATUSES: { value: SlotStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'tbc', label: 'TBC' },
]

// What each format takes: a panel is one moderator and four speakers, a
// fireside one moderator and two, a keynote or spotlight one speaker.
export function seatsFor(type: SessionType): Seats {
  switch (type) {
    case 'panel': return { moderators: 1, speakers: 4 }
    case 'fireside': return { moderators: 1, speakers: 2 }
    case 'keynote': return { moderators: 0, speakers: 1 }
    case 'spotlight': return { moderators: 0, speakers: 1 }
    case 'break': return { moderators: 0, speakers: 0 }
    default: return { moderators: 0, speakers: 0 }
  }
}

export const sessionSeats = (s: Session): Seats => s.seats ?? seatsFor(s.type)

// Seats still empty on a session (a named person, confirmed or TBC, fills
// a seat), and how many named people are still to be confirmed.
export function sessionNeeds(s: Session): { moderators: number; speakers: number; toConfirm: number } {
  const seats = sessionSeats(s)
  const named = s.speakers.filter((x) => x.name.trim())
  const mods = named.filter((x) => x.moderator).length
  const others = named.length - mods
  return {
    moderators: Math.max(0, seats.moderators - mods),
    speakers: Math.max(0, seats.speakers - others),
    toConfirm: named.filter((x) => x.status !== 'confirmed').length,
  }
}

// One line for what is still due: "2 moderators and 3 speakers" or "".
export function needsLabel(n: { moderators: number; speakers: number }): string {
  const parts: string[] = []
  if (n.moderators) parts.push(`${n.moderators} moderator${n.moderators === 1 ? '' : 's'}`)
  if (n.speakers) parts.push(`${n.speakers} speaker${n.speakers === 1 ? '' : 's'}`)
  return parts.join(' and ')
}

// Older saves may carry statuses that no longer exist.
export function normaliseAgenda(a: Agenda): Agenda {
  return {
    ...a,
    sessions: (a.sessions ?? []).map((s) => ({
      ...s,
      points: s.points ?? [],
      speakers: (s.speakers ?? []).map((x) => ({ ...x, status: x.status === 'confirmed' ? 'confirmed' : 'tbc' })),
    })),
  }
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function inferType(title: string): SessionType {
  const t = title.toLowerCase()
  if (/\b(break|lunch|registration|breakfast|reception|networking|drinks|coffee|close of)\b/.test(t)) return 'break'
  if (/keynote/.test(t)) return 'keynote'
  if (/fireside/.test(t)) return 'fireside'
  if (/spotlight|presentation|case study/.test(t)) return 'spotlight'
  return 'panel'
}

export function emptyAgenda(title = '', dateLabel = '', venue = ''): Agenda {
  return { title, dateLabel, venue, sessions: [] }
}

export function emptySession(start = '', end = ''): Session {
  return { id: newId(), start, end, title: '', type: 'panel', points: [], speakers: [] }
}

export function emptySlot(): SpeakerSlot {
  return { id: newId(), name: '', role: '', org: '', moderator: false, status: 'tbc' }
}

// "09:40" → "09:40AM"; "13:40" → "13:40PM" (the house style keeps 24-hour
// digits with an AM/PM suffix, as the source document does).
export function houseTime(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return t
  const h = Number(m[1])
  return `${m[1].padStart(2, '0')}:${m[2]}${h < 12 ? 'AM' : 'PM'}`
}

// "8:30AM" / "13:40PM" / "1:40 pm" → "08:30" / "13:40" / "13:40"
export function to24h(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/)
  if (!m) return raw.trim()
  let h = Number(m[1])
  const ap = m[3]?.toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

// Everything except the breaks: keynotes, panels, spotlights, firesides.
export function agendaStats(a: Agenda) {
  const talks = a.sessions.filter((s) => s.type !== 'break')
  const slots = talks.flatMap((s) => s.speakers.filter((x) => x.name.trim()))
  const seats = talks.reduce((n, s) => { const k = sessionSeats(s); return n + k.moderators + k.speakers }, 0)
  const need = talks.reduce((acc, s) => { const n = sessionNeeds(s); acc.moderators += n.moderators; acc.speakers += n.speakers; return acc }, { moderators: 0, speakers: 0 })
  return {
    sessions: talks.length,
    breaks: a.sessions.length - talks.length,
    seats,
    filled: slots.length,
    confirmed: slots.filter((s) => s.status === 'confirmed').length,
    tbc: slots.filter((s) => s.status !== 'confirmed').length,
    needModerators: need.moderators,
    needSpeakers: need.speakers,
    sessionsShort: talks.filter((s) => { const n = sessionNeeds(s); return n.moderators + n.speakers > 0 }).length,
  }
}
