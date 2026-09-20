// The digital agenda: one per edition. Sessions in running order, each
// with its speaker slots and whether each person is confirmed or still
// to be confirmed. Shared by the Production portal (edits it), the Sales
// portal (reads it) and the Word export.

export type SessionType = 'keynote' | 'panel' | 'fireside' | 'spotlight' | 'break' | 'other'
export type SlotStatus = 'confirmed' | 'tbc' | 'invited' | 'declined'

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
  { value: 'invited', label: 'Invited' },
  { value: 'declined', label: 'Declined' },
]

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

export function agendaStats(a: Agenda) {
  const slots = a.sessions.flatMap((s) => s.speakers)
  return {
    sessions: a.sessions.length,
    talks: a.sessions.filter((s) => s.type !== 'break').length,
    slots: slots.length,
    confirmed: slots.filter((s) => s.status === 'confirmed').length,
    tbc: slots.filter((s) => s.status === 'tbc' || s.status === 'invited').length,
    declined: slots.filter((s) => s.status === 'declined').length,
    empty: a.sessions.filter((s) => s.type !== 'break' && s.speakers.length === 0).length,
  }
}
