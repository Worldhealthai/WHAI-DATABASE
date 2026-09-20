// Writes the digital agenda back out as a Word document.
//
// "classic" reproduces the team's own layout: centred bold title, date and
// venue in Calibri; each session as a bold "HH:MMAM – HH:MMAM | Title"
// line; the panel's questions as bullets; the speakers as bullets in the
// form "Name – Role – Organisation (Moderator)", organisation in bold.
// "designed" is a cleaner take on the same content: a time column, a
// type tag on each session, questions and people set apart, and TBC slots
// marked so a draft reads as a draft.

import {
  AlignmentType, BorderStyle, Document, HeadingLevel, LevelFormat, Packer, Paragraph, ShadingType, Table, TableCell, TableRow,
  TextRun, VerticalAlign, WidthType,
} from 'docx'
import { type Agenda, type Session, type SpeakerSlot, SESSION_TYPES, houseTime } from './model'

const CALIBRI = 'Calibri'

const slotLabel = (s: SpeakerSlot) => {
  const status = s.status === 'confirmed' ? '' : s.status === 'tbc' ? ' (TBC)' : s.status === 'invited' ? ' (invited)' : ' (declined)'
  return status
}

// ── Classic ─────────────────────────────────────────────────────────────────

function classicSpeakerRuns(s: SpeakerSlot): TextRun[] {
  const runs: TextRun[] = []
  const lead = [s.name || 'Speaker TBC', s.role].filter(Boolean).join(' – ')
  runs.push(new TextRun({ text: s.org ? `${lead} – ` : lead, font: CALIBRI, size: 20 }))
  if (s.org) runs.push(new TextRun({ text: s.org, font: CALIBRI, size: 20, bold: true }))
  if (s.moderator) runs.push(new TextRun({ text: ' (Moderator)', font: CALIBRI, size: 20, bold: true }))
  const tail = slotLabel(s)
  if (tail) runs.push(new TextRun({ text: tail, font: CALIBRI, size: 20, color: 'B45309' }))
  return runs
}

function classicSession(s: Session): Paragraph[] {
  const out: Paragraph[] = []
  out.push(
    new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [new TextRun({ text: `${houseTime(s.start)} – ${houseTime(s.end)} | ${s.title}`, font: CALIBRI, size: 22, bold: true })],
    })
  )
  if (s.type === 'break') {
    if (s.notes) out.push(new Paragraph({ children: [new TextRun({ text: s.notes, font: CALIBRI, size: 20 })] }))
    return out
  }
  if (s.talkTitle) {
    out.push(new Paragraph({ children: [new TextRun({ text: `“${s.talkTitle}”`, font: CALIBRI, size: 22 })] }))
  }
  for (const q of s.points) {
    out.push(new Paragraph({ numbering: { reference: 'questions', level: 0 }, children: [new TextRun({ text: q, font: CALIBRI, size: 22 })] }))
  }
  for (const sp of s.speakers) {
    out.push(new Paragraph({ numbering: { reference: 'speakers', level: 0 }, children: classicSpeakerRuns(sp) }))
  }
  if (!s.speakers.length) {
    out.push(new Paragraph({ numbering: { reference: 'speakers', level: 0 }, children: [new TextRun({ text: 'Speakers TBC', font: CALIBRI, size: 20, color: 'B45309' })] }))
  }
  return out
}

function classicDocument(a: Agenda): Document {
  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: a.title, font: CALIBRI, size: 28, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: a.dateLabel, font: CALIBRI, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: a.venue ? `Venue: ${a.venue}` : '', font: CALIBRI, size: 22 })] }),
    new Paragraph({ children: [] }),
    ...a.sessions.flatMap(classicSession),
  ]
  return new Document({
    numbering: {
      config: [
        { reference: 'questions', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: 'speakers', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  })
}

// ── Designed ────────────────────────────────────────────────────────────────

const INK = '1F2D3D'
const MUTED = '536B85'
const LINE = 'E4E9EF'
const ACCENT = '2563EB'
const WARN = 'B45309'
const OK = '107C41'

const TYPE_TINT: Record<string, string> = { keynote: 'E8EFFF', panel: 'F2F5F8', fireside: 'FDE8EE', spotlight: 'FDF1DC', break: 'F5F8FA', other: 'F2F5F8' }

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const hair = { style: BorderStyle.SINGLE, size: 4, color: LINE }

function designedSpeaker(s: SpeakerSlot): Paragraph {
  const runs: TextRun[] = [new TextRun({ text: s.name || 'Speaker TBC', font: CALIBRI, size: 20, bold: true, color: s.name ? INK : WARN })]
  const rest = [s.role, s.org].filter(Boolean).join(', ')
  if (rest) runs.push(new TextRun({ text: `  ${rest}`, font: CALIBRI, size: 19, color: MUTED }))
  if (s.moderator) runs.push(new TextRun({ text: '  Moderator', font: CALIBRI, size: 17, bold: true, color: ACCENT }))
  const tail = slotLabel(s).trim()
  if (tail) runs.push(new TextRun({ text: `  ${tail.replace(/[()]/g, '').toUpperCase()}`, font: CALIBRI, size: 17, bold: true, color: s.status === 'declined' ? 'C0392B' : WARN }))
  return new Paragraph({ spacing: { before: 40, after: 40 }, children: runs })
}

function designedSession(s: Session): TableRow {
  const typeLabel = SESSION_TYPES.find((t) => t.value === s.type)?.label ?? s.type
  const isBreak = s.type === 'break'
  const timeCell = new TableCell({
    width: { size: 1700, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    borders: { top: hair, bottom: hair, left: noBorder, right: noBorder },
    margins: { top: 140, bottom: 140, left: 80, right: 80 },
    children: [
      new Paragraph({ children: [new TextRun({ text: s.start, font: CALIBRI, size: 24, bold: true, color: isBreak ? MUTED : INK })] }),
      new Paragraph({ children: [new TextRun({ text: `to ${s.end}`, font: CALIBRI, size: 18, color: MUTED })] }),
    ],
  })
  const body: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: s.title, font: CALIBRI, size: isBreak ? 21 : 24, bold: !isBreak, color: isBreak ? MUTED : INK }),
        ...(isBreak ? [] : [new TextRun({ text: `   ${typeLabel.toUpperCase()}`, font: CALIBRI, size: 15, bold: true, color: ACCENT })]),
      ],
    }),
  ]
  if (!isBreak) {
    if (s.talkTitle) body.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: s.talkTitle, font: CALIBRI, size: 21, italics: true, color: INK })] }))
    for (const q of s.points) body.push(new Paragraph({ numbering: { reference: 'designed-points', level: 0 }, spacing: { after: 20 }, children: [new TextRun({ text: q, font: CALIBRI, size: 19, color: MUTED })] }))
    if (s.speakers.length) {
      body.push(new Paragraph({ spacing: { before: 100, after: 20 }, children: [new TextRun({ text: 'SPEAKERS', font: CALIBRI, size: 15, bold: true, color: MUTED })] }))
      for (const sp of s.speakers) body.push(designedSpeaker(sp))
    } else {
      body.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: 'Speakers to be confirmed', font: CALIBRI, size: 19, bold: true, color: WARN })] }))
    }
  } else if (s.notes) {
    body.push(new Paragraph({ children: [new TextRun({ text: s.notes, font: CALIBRI, size: 19, color: MUTED })] }))
  }
  const bodyCell = new TableCell({
    width: { size: 7326, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    borders: { top: hair, bottom: hair, left: noBorder, right: noBorder },
    margins: { top: 140, bottom: 140, left: 160, right: 120 },
    shading: isBreak ? { type: ShadingType.CLEAR, fill: TYPE_TINT.break, color: 'auto' } : undefined,
    children: body,
  })
  return new TableRow({ cantSplit: true, children: [timeCell, bodyCell] })
}

function designedDocument(a: Agenda): Document {
  const slots = a.sessions.flatMap((s) => s.speakers)
  const confirmed = slots.filter((s) => s.status === 'confirmed').length
  const tbc = slots.length - confirmed
  const header: Paragraph[] = [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'AGENDA', font: CALIBRI, size: 17, bold: true, color: ACCENT })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 60 }, children: [new TextRun({ text: a.title, font: CALIBRI, size: 40, bold: true, color: INK })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: [a.dateLabel, a.venue].filter(Boolean).join('  ·  '), font: CALIBRI, size: 22, color: MUTED })] }),
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: LINE, space: 8 } },
      children: [
        new TextRun({ text: `${a.sessions.filter((s) => s.type !== 'break').length} sessions  ·  ${slots.length} speaker slots  ·  `, font: CALIBRI, size: 18, color: MUTED }),
        new TextRun({ text: `${confirmed} confirmed`, font: CALIBRI, size: 18, bold: true, color: OK }),
        ...(tbc ? [new TextRun({ text: `  ·  ${tbc} to confirm`, font: CALIBRI, size: 18, bold: true, color: WARN })] : []),
      ],
    }),
  ]
  const table = new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [1700, 7326],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: hair, insideVertical: noBorder },
    rows: a.sessions.map(designedSession),
  })
  return new Document({
    styles: { default: { document: { run: { font: CALIBRI } } } },
    numbering: {
      config: [{ reference: 'designed-points', levels: [{ level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1200, right: 1440, bottom: 1200, left: 1440 } } }, children: [...header, table] }],
  })
}

export async function agendaToDocx(a: Agenda, style: 'classic' | 'designed'): Promise<Buffer> {
  const doc = style === 'designed' ? designedDocument(a) : classicDocument(a)
  return Packer.toBuffer(doc)
}
