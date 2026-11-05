'use client'

// A person's name, anywhere in a list (November 2026): a real link to their
// page, so a middle-click or a screen reader still gets there, that on a
// plain click opens the contact panel (ContactDrawer) instead. The seed is
// what the list already knows about them; the panel fetches the rest.

import Link from 'next/link'
import { createContext, useContext } from 'react'
import type { Firmographic, FocusRow, Relationship } from '@/lib/segments'
import type { Focus } from '@/lib/contactFocus'

export interface ContactRecord { relationship: Relationship; table: string; id: string; status: string | null; event?: string | null }

export interface ContactSeed {
  key?: string
  name: string
  email?: string | null
  email2?: string | null
  phone?: string | null
  jobTitle?: string | null
  company?: string | null
  type?: Firmographic | null
  records?: ContactRecord[]
  note?: string | null
  focus?: Focus[]
  focusAuto?: Focus[]
  focusRows?: FocusRow[]
  linkedinUrl?: string | null
  city?: string | null
  country?: string | null
  website?: string | null
  // Their full page, if they have one.
  href?: string | null
  // An action the list offers for them (a sponsor contact's Edit).
  onEdit?: () => void
}

export interface ContactDrawerApi {
  // `list` is the list the name was in, for the panel's Previous and Next.
  openContact: (seed: ContactSeed, list?: ContactSeed[]) => void
  close: () => void
}

export const ContactDrawerContext = createContext<ContactDrawerApi | null>(null)
export const useContactDrawer = () => useContext(ContactDrawerContext)

export function ContactLink({ seed, list, href, className, style, title, children }: { seed: ContactSeed; list?: ContactSeed[]; href?: string | null; className?: string; style?: React.CSSProperties; title?: string; children: React.ReactNode }) {
  const drawer = useContactDrawer()
  const to = href ?? seed.href ?? null
  const onClick = (e: React.MouseEvent) => {
    if (!drawer) return
    // A modifier click keeps the browser's own behaviour (a new tab).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    drawer.openContact({ ...seed, href: to }, list)
  }
  if (to) return <Link href={to} onClick={onClick} className={className} style={style} title={title}>{children}</Link>
  return <button type="button" onClick={onClick} className={`text-left ${className ?? ''}`} style={style} title={title}>{children}</button>
}
