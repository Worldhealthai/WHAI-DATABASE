// Writes an admin-panel team note onto a CRM record's timeline as a note
// activity, next to the status changes. Re-saving the note in the panel
// replaces the earlier entry (found by its metadata marker) instead of
// stacking a new one. Never throws — the note is already saved in the panel.

import { supabase } from '@/lib/supabase'
import { INBOX_NOTE_KIND } from '@/lib/inboxNote'

export type NoteEntity = 'delegate' | 'speaker' | 'sponsor' | 'partner'

const ID_COLUMN: Record<NoteEntity, string> = {
  delegate: 'delegateId',
  speaker: 'speakerId',
  sponsor: 'sponsorId',
  partner: 'partnerId',
}

export async function upsertInboxNoteActivity(args: {
  entityType: NoteEntity
  entityId: string
  note: string
  source: string
  email?: string | null
}): Promise<'created' | 'updated' | 'unchanged' | 'failed'> {
  const note = args.note.trim()
  if (!note) return 'unchanged'
  const idCol = ID_COLUMN[args.entityType]
  try {
    const { data: existing, error } = await supabase
      .from('activities')
      .select('id, content, metadata')
      .eq(idCol, args.entityId)
      .eq('type', 'note')
      .order('createdAt', { ascending: false })
      .limit(50)
    if (error) throw error

    const prior = (existing ?? []).find((a) => {
      try {
        return JSON.parse(a.metadata ?? '{}')?.kind === INBOX_NOTE_KIND
      } catch {
        return false
      }
    })

    const metadata = JSON.stringify({ kind: INBOX_NOTE_KIND, source: args.source, email: args.email ?? null })

    if (prior) {
      if ((prior.content ?? '').trim() === note) return 'unchanged'
      // Bring the edited note back to the top of the timeline.
      const { error: updErr } = await supabase
        .from('activities')
        .update({ content: note, metadata, createdBy: args.source, createdAt: new Date().toISOString() })
        .eq('id', prior.id)
      if (updErr) throw updErr
      return 'updated'
    }

    const { error: insErr } = await supabase.from('activities').insert({
      entityType: args.entityType,
      [idCol]: args.entityId,
      type: 'note',
      content: note,
      createdBy: args.source,
      metadata,
    })
    if (insErr) throw insErr
    return 'created'
  } catch (err) {
    console.error('inbox note activity failed:', err)
    return 'failed'
  }
}
