'use client'

import { useParams } from 'next/navigation'
import { ContactProfile } from '@/components/workspace/Profiles'

export default function ContactPage() {
  const { id } = useParams<{ id: string }>()
  return <ContactProfile id={id} />
}
