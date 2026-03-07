'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Globe, MapPin, Users, TrendingUp, Building2, Tag } from 'lucide-react'
import { cn, formatDate, formatCurrency } from '@/lib/utils'

async function fetchCompany(id: string) {
  const res = await fetch(`/api/companies/${id}`)
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

const DEAL_STAGE_COLORS: Record<string, string> = {
  'Completed': 'text-green-400 bg-green-400/10 border-green-400/20',
  'Announced': 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
  'Terminated': 'text-red-400 bg-red-400/10 border-red-400/20',
  'Rumoured': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

export default function CompanyProfilePage({ params }: { params: { id: string } }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['company', params.id],
    queryFn: () => fetchCompany(params.id),
  })

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh] text-slate-500 text-sm">Loading…</div>
  if (error || !data) return <div className="flex items-center justify-center min-h-[50vh] text-red-400 text-sm">Company not found.</div>

  const { company, contacts, deals } = data

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <Link href="/companies" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Companies
      </Link>

      {/* Header */}
      <div className="whai-card p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#1a3a5c] flex items-center justify-center shrink-0">
            <Building2 className="w-7 h-7 text-[#00B4D8]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-white">{company.name}</h1>
                {company.legalName && company.legalName !== company.name && (
                  <p className="text-sm text-slate-500 mt-0.5">{company.legalName}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-slate-400">{company.companyType}</span>
                  {company.ownershipStatus && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="text-sm text-slate-400">{company.ownershipStatus}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{company._count?.contacts ?? 0}</div>
                  <div className="text-xs text-slate-500">Contacts</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{(company._count?.dealsAsAcquirer ?? 0) + (company._count?.dealsAsTarget ?? 0)}</div>
                  <div className="text-xs text-slate-500">Deals</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-400">
              {(company.headquartersCity || company.headquartersCountry) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[company.headquartersCity, company.headquartersCountry].filter(Boolean).join(', ')}
                </span>
              )}
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[#00B4D8] transition-colors">
                  <Globe className="w-3.5 h-3.5" /> {company.website}
                </a>
              )}
              {company.foundedYear && <span>Est. {company.foundedYear}</span>}
              {company.employeeCountRange && <span>{company.employeeCountRange} employees</span>}
              {company.annualRevenueRange && <span>{company.annualRevenueRange}</span>}
            </div>
          </div>
        </div>

        {company.description && (
          <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-3xl">{company.description}</p>
        )}

        {/* Tags */}
        {company.tags && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs px-2 py-0.5 rounded border text-slate-300 bg-[#112850] border-[#1a3a5c]">
              {company.tags}
            </span>
          </div>
        )}
      </div>

      {/* People */}
      {contacts?.length > 0 && (
        <div className="whai-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#00B4D8]" /> People ({company._count?.contacts ?? 0})
            </h2>
            <Link href={`/contacts?companyId=${company.id}`} className="text-xs text-[#00B4D8] hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Name', 'Title', 'Seniority', 'Dept', 'Location'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((c: any) => (
                  <tr key={c.id} className="hover:bg-[#112850]/50 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link href={`/contacts/${c.id}`} className="flex items-center gap-2 group">
                        <div className="w-6 h-6 rounded-full bg-[#1a3a5c] flex items-center justify-center text-[10px] font-semibold text-[#00B4D8] shrink-0">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <span className="font-medium text-white group-hover:text-[#00B4D8] transition-colors">
                          {c.firstName} {c.lastName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <span className="text-slate-300 truncate block">{c.jobTitle}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {c.seniority ? (
                        <span className={cn('whai-badge border', SENIORITY_COLORS[c.seniority] ?? 'text-slate-300 bg-slate-700/50 border-slate-600')}>
                          {c.seniority}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-400">{c.department ?? '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-400">
                      {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deals */}
      {deals?.length > 0 && (
        <div className="whai-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00B4D8]" /> Deals
            </h2>
          </div>
          <div className="divide-y divide-border">
            {deals.map((deal: any) => (
              <div key={deal.id} className="px-4 py-3 hover:bg-[#112850]/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/deals/${deal.id}`} className="font-medium text-white hover:text-[#00B4D8] transition-colors">
                      {deal.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-slate-400">{deal.dealType}</span>
                      <span className={cn('whai-badge border', DEAL_STAGE_COLORS[deal.dealStage] ?? 'text-slate-300 bg-slate-700/50 border-slate-600')}>
                        {deal.dealStage}
                      </span>
                      {deal.announcedDate && (
                        <span className="text-xs text-slate-500">{formatDate(deal.announcedDate)}</span>
                      )}
                    </div>
                  </div>
                  {deal.dealValueUsd && (
                    <span className="text-sm font-semibold text-[#00B4D8] whitespace-nowrap">
                      {formatCurrency(deal.dealValueUsd)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
