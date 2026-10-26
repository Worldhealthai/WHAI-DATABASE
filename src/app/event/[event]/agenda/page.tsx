'use client'

import { AgendaEditor } from '@/components/agenda/AgendaEditor'

// One agenda per edition: the running order, with Edit to change it.
export default function AgendaPage() {
  return <AgendaEditor mode="edit" />
}
