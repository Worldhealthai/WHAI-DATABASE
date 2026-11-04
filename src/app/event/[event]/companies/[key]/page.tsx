'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { CompanyProfile } from '@/components/workspace/Profiles'

export default function CompanyPage() {
  const { key } = useParams<{ key: string }>()
  const name = useSearchParams().get('name') || decodeURIComponent(key)
  return <CompanyProfile companyKeyParam={decodeURIComponent(key)} name={name} />
}
