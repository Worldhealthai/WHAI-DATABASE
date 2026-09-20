'use client'

import { AgendaEditor } from '@/components/agenda/AgendaEditor'

// Sales opens on the finished running order and can switch to Edit, the
// same as Production — one agenda per edition, edited from either portal.
export default function SalesAgendaPage() {
  return <AgendaEditor mode="edit" />
}
