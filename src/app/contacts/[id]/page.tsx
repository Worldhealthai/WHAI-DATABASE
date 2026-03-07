'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Phone, Linkedin,
  Building2, MapPin, Tag, TrendingUp, Users
} from 'lucide-react'
import { cn, formatDate, formatCurrency } from '@/lib/utils'

async function fetchContact(id: string) {
  const res = await fetch(`/api/contacts/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

const SENIORITY_COLORS: Record<string, string> = {
  'C-Suite': 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
  'VP': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  'Director': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  'Manager': 'text-green-400 bg-green-400/10 border-green-400/20',
  'Individual Contributor': 'text-slate-300 bg-slate-700/50 border-slate-600',
  'Board': 'text-red-400 bg-red-400/10 border-red-400/20',
}

export default function ContactProfilePage({ params }: { params: { id: string } }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['contact', params.id],
    queryFn: () => fetchContact(params.id),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[50vh] text-slate-500 text-sm">
      Loading contact…
    </div>
  )

  if (error || !data) return (
    <div className="flex items-center justify-center min-h-[50vh] text-red-400 text-sm">
      Contact not found.
    </div>
  )

  const { contact, relatedContacts, relatedDeals } = data

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Back */}
      <Link href="/contacts" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Contacts
      </Link>

      {/* Header card */}
      <div className="whai-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-xl bg-[#1a3a5c] flex items-center justify-center text-xl font-bold text-[#00B4D8] shrink-0">
              {contact.firstName[0]}{contact.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white">
                  {contact.firstName} {contact.lastName}
                </h1>
                {contact.seniority && (
                  <span className={cn('whai-badge border', SENIORITY_COLORS[contact.seniority] ?? 'text-slate-300 bg-slate-700/50 border-slate-600')}>
                    {contact.seniority}
                  </span>
                )}
              </div>
              <p className="text-slate-300 mt-0.5">{contact.jobTitle}</p>
              {contact.company && (
                <Link href={`/companies/${contact.company.id}`} className="text-[#00B4D8] text-sm hover:underline mt-0.5 block">
                  {contact.company.name}
                </Link>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                {(contact.city || contact.country) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {[contact.city, contact.country].filter(Boolean).join(', ')}
                  </span>
                )}
                {contact.department && (
                  <span>{contact.department}</span>
                )}
              </div>
            </div>
          </div>

          {/* Engagement score */}
          <div className="text-right shrink-0">
            <div className="text-xs text-slate-500 mb-1">Engagement Score</div>
            <div className="text-3xl font-bold text-[#00B4D8]">{contact.engagementScore}</div>
            <div className="w-24 h-1.5 rounded-full bg-[#1a3a5c] mt-2 ml-auto">
              <div className="h-full rounded-full bg-[#00B4D8]" style={{ width: `${contact.engagementScore}%` }} />
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-sm text-[#00B4D8] hover:underline">
              <Mail className="w-3.5 h-3.5" /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
              <Phone className="w-3.5 h-3.5" /> {contact.phone}
            </a>
          )}
          {contact.linkedinUrl && (
            <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
              <Linkedin className="w-3.5 h-3.5" /> LinkedIn
            </a>
          )}
        </div>

        {/* Tags */}
        {contact.tags && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#112850] text-slate-300 border border-[#1a3a5c]">
              <Tag className="w-2.5 h-2.5" /> {contact.tags}
            </span>
          </div>
        )}

        {/* Bio */}
        {contact.bio && (
          <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-2xl">
            {contact.bio}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company card */}
        {contact.company && (
          <div className="whai-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Company
            </h2>
            <Link href={`/companies/${contact.company.id}`} className="group">
              <div className="font-semibold text-white group-hover:text-[#00B4D8] transition-colors">
                {contact.company.name}
              </div>
              {contact.company.companyType && (
                <div className="text-xs text-slate-400 mt-0.5">{contact.company.companyType}</div>
              )}
              {(contact.company.headquartersCity || contact.company.headquartersCountry) && (
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {[contact.company.headquartersCity, contact.company.headquartersCountry].filter(Boolean).join(', ')}
                </div>
              )}
            </Link>
          </div>
        )}

        {/* Related contacts */}
        {relatedContacts?.length > 0 && (
          <div className="whai-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Colleagues at {contact.company?.name}
            </h2>
            <div className="space-y-2">
              {relatedContacts.slice(0, 5).map((c: any) => (
                <Link key={c.id} href={`/contacts/${c.id}`} className="flex items-center gap-2 group">
                  <div className="w-6 h-6 rounded-full bg-[#1a3a5c] flex items-center justify-center text-[10px] font-semibold text-[#00B4D8] shrink-0">
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div>
                    <div className="text-sm text-white group-hover:text-[#00B4D8] transition-colors font-medium">
                      {c.firstName} {c.lastName}
                    </div>
                    <div className="text-xs text-slate-500 truncate max-w-[160px]">{c.jobTitle}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Related deals */}
        {relatedDeals?.length > 0 && (
          <div className="whai-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Company Deals
            </h2>
            <div className="space-y-3">
              {relatedDeals.slice(0, 4).map((deal: any) => (
                <Link key={deal.id} href={`/deals/${deal.id}`} className="block group">
                  <div className="text-sm text-white group-hover:text-[#00B4D8] transition-colors font-medium line-clamp-2">
                    {deal.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">
                      {deal.dealType}
                    </span>
                    {deal.announcedDate && (
                      <span className="text-xs text-slate-600">{formatDate(deal.announcedDate)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
