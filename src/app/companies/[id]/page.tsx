'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Globe, MapPin, Users, TrendingUp, Building2, Tag } from 'lucide-react'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { COMPANY_TYPE_LABELS, OWNERSHIP_LABELS, EMPLOYEE_RANGE_LABELS, REVENUE_RANGE_LABELS, SENIORITY_LABELS, DEAL_TYPE_LABELS, DEAL_STAGE_LABELS } from '@/types'
import type { CompanyType, OwnershipStatus, SeniorityLevel, DealType, DealStage, EmployeeCountRange, AnnualRevenueRange } from '@/types'

async function fetchCompany(id: string) {
  const res = await fetch(`/api/companies/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

const SENIORITY_COLORS: Record<string, string> = {
  C_SUITE: 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
  VP: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  DIRECTOR: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  MANAGER: 'text-green-400 bg-green-400/10 border-green-400/20',
  INDIVIDUAL_CONTRIBUTOR: 'text-slate-300 bg-slate-700/50 border-slate-600',
  BOARD: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const DEAL_STAGE_COLORS: Record<string, string> = {
  COMPLETED: 'text-green-400 bg-green-400/10 border-green-400/20',
  ANNOUNCED: 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
  TERMINATED: 'text-red-400 bg-red-400/10 border-red-400/20',
  RUMOURED: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
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
                {company.legal_name && company.legal_name !== company.name && (
                  <p className="text-sm text-slate-500 mt-0.5">{company.legal_name}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-slate-400">{COMPANY_TYPE_LABELS[company.company_type as CompanyType] ?? company.company_type}</span>
                  {company.ownership_status && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="text-sm text-slate-400">{OWNERSHIP_LABELS[company.ownership_status as OwnershipStatus]}</span>
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
                  <div className="text-xl font-bold text-white">{(company._count?.deals_as_acquirer ?? 0) + (company._count?.deals_as_target ?? 0)}</div>
                  <div className="text-xs text-slate-500">Deals</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-400">
              {(company.headquarters_city || company.headquarters_country) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[company.headquarters_city, company.headquarters_country].filter(Boolean).join(', ')}
                </span>
              )}
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[#00B4D8] transition-colors">
                  <Globe className="w-3.5 h-3.5" /> {company.website}
                </a>
              )}
              {company.founded_year && <span>Est. {company.founded_year}</span>}
              {company.employee_count_range && <span>{EMPLOYEE_RANGE_LABELS[company.employee_count_range as EmployeeCountRange]} employees</span>}
              {company.annual_revenue_range && <span>{REVENUE_RANGE_LABELS[company.annual_revenue_range as AnnualRevenueRange]}</span>}
            </div>
          </div>
        </div>

        {company.description && (
          <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-3xl">{company.description}</p>
        )}

        {/* Verticals + Therapeutic Areas */}
        <div className="mt-4 flex flex-wrap gap-2">
          {company.verticals?.map((cv: any) => (
            <span key={cv.vertical.id} className={cn(
              'text-xs px-2 py-0.5 rounded border',
              cv.is_primary
                ? 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20'
                : 'text-slate-300 bg-[#112850] border-[#1a3a5c]',
            )}>
              {cv.vertical.name}
            </span>
          ))}
          {company.therapeutic_areas?.map((cta: any) => (
            <span key={cta.therapeutic_area.id} className="text-xs px-2 py-0.5 rounded bg-purple-900/20 text-purple-300 border border-purple-700/30">
              {cta.therapeutic_area.name}
            </span>
          ))}
        </div>
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
                  {['Name', 'Title', 'Function', 'Seniority', 'Dept', 'Location'].map((h) => (
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
                          {c.first_name[0]}{c.last_name[0]}
                        </div>
                        <span className="font-medium text-white group-hover:text-[#00B4D8] transition-colors">
                          {c.first_name} {c.last_name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <span className="text-slate-300 truncate block">{c.job_title}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-400">
                      {c.job_function?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {c.seniority_level ? (
                        <span className={cn('whai-badge border', SENIORITY_COLORS[c.seniority_level])}>
                          {SENIORITY_LABELS[c.seniority_level as SeniorityLevel]}
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
                      <span className="text-xs text-slate-400">{DEAL_TYPE_LABELS[deal.deal_type as DealType]}</span>
                      <span className={cn('whai-badge border', DEAL_STAGE_COLORS[deal.deal_stage])}>
                        {DEAL_STAGE_LABELS[deal.deal_stage as DealStage]}
                      </span>
                      {deal.announced_date && (
                        <span className="text-xs text-slate-500">{formatDate(deal.announced_date)}</span>
                      )}
                    </div>
                  </div>
                  {deal.deal_value_usd && (
                    <span className="text-sm font-semibold text-[#00B4D8] whitespace-nowrap">
                      {formatCurrency(deal.deal_value_usd)}
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
