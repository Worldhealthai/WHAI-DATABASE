'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, ExternalLink, TrendingUp, Building2,
  Users, Tag, ArrowRight, Globe, Briefcase,
} from 'lucide-react'
import { cn, formatDate, formatCurrency } from '@/lib/utils'

async function fetchDeal(id: string) {
  const res = await fetch(`/api/deals/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

const STAGE_COLORS: Record<string, string> = {
  'Completed': 'text-green-400 bg-green-400/10 border-green-400/20',
  'Announced': 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
  'Terminated': 'text-red-400 bg-red-400/10 border-red-400/20',
  'Rumoured': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

const STAGE_DOT: Record<string, string> = {
  'Completed': 'bg-green-400',
  'Announced': 'bg-[#00B4D8]',
  'Terminated': 'bg-red-400',
  'Rumoured': 'bg-amber-400',
}

// ── Company card (rich) ──────────────────────────────────────────────────────

function CompanyCard({ company, role }: { company: any; role: string }) {
  if (!company) return null
  const verticals = company.verticals?.map((v: any) => v.verticalSlug).join(', ') ?? null
  const location = [company.headquartersCity, company.headquartersCountry].filter(Boolean).join(', ')

  return (
    <div className="whai-card p-5 hover:border-[#1a3a5c] transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{role}</span>
        {company.companyType && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#112850] text-slate-400 border border-[#1a3a5c]">
            {company.companyType}
          </span>
        )}
      </div>

      <Link href={`/companies/${company.id}`} className="block mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#112850] border border-[#1a3a5c] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-white group-hover:text-[#00B4D8] transition-colors truncate">
              {company.name}
            </div>
            {company.legalName && company.legalName !== company.name && (
              <div className="text-xs text-slate-500 truncate">{company.legalName}</div>
            )}
          </div>
        </div>
      </Link>

      <div className="space-y-1.5 text-xs text-slate-400">
        {location && (
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-slate-500 shrink-0" /> {location}
          </div>
        )}
        {verticals && (
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">{verticals}</span>
          </div>
        )}
        {company.employeeCountRange && (
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-slate-500 shrink-0" /> {company.employeeCountRange} employees
          </div>
        )}
        {company.ownershipStatus && (
          <div className="flex items-center gap-1.5">
            <Tag className="w-3 h-3 text-slate-500 shrink-0" /> {company.ownershipStatus}
          </div>
        )}
      </div>

      {company.website && (
        <a
          href={company.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[#00B4D8] hover:underline mt-3"
        >
          <ExternalLink className="w-3 h-3" /> Website
        </a>
      )}
    </div>
  )
}

// ── Investor row ─────────────────────────────────────────────────────────────

function InvestorRow({ inv }: { inv: any }) {
  const name = inv.investorCompany?.name ?? inv.investorCompanyName
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1a3a5c]/50 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[#112850] border border-[#1a3a5c] flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-slate-500" />
        </div>
        <div className="min-w-0">
          {inv.investorCompany ? (
            <Link href={`/companies/${inv.investorCompany.id}`} className="font-medium text-white hover:text-[#00B4D8] transition-colors text-sm">
              {name}
            </Link>
          ) : (
            <span className="font-medium text-white text-sm">{name}</span>
          )}
          {inv.investorCompany?.companyType && (
            <div className="text-xs text-slate-500">{inv.investorCompany.companyType}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border',
          inv.investorRole === 'Lead'
            ? 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20'
            : inv.investorRole === 'Co-Lead'
              ? 'text-purple-400 bg-purple-400/10 border-purple-400/20'
              : 'text-slate-400 bg-slate-700/30 border-slate-600',
        )}>
          {inv.investorRole}
        </span>
        {inv.investmentAmountUsd && (
          <span className="font-bold text-[#00B4D8] text-sm whitespace-nowrap">
            {formatCurrency(BigInt(inv.investmentAmountUsd))}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Detail page ──────────────────────────────────────────────────────────────

export default function DealDetailPage({ params }: { params: { id: string } }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['deal', params.id],
    queryFn: () => fetchDeal(params.id),
  })

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-6">
        <div className="h-4 w-32 rounded bg-slate-700/50 animate-pulse" />
        <div className="whai-card p-8 space-y-4">
          <div className="h-6 w-96 rounded bg-slate-700/50 animate-pulse" />
          <div className="h-4 w-64 rounded bg-slate-700/30 animate-pulse" />
          <div className="h-12 w-40 rounded bg-slate-700/30 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="whai-card p-5 h-40 animate-pulse bg-slate-700/10" />
          <div className="whai-card p-5 h-40 animate-pulse bg-slate-700/10" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-red-400 text-sm">
        Deal not found.
      </div>
    )
  }

  const { deal, relatedDeals } = data
  const tags = deal.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) ?? []
  const hasInvestors = deal.investors?.length > 0

  return (
    <div className="max-w-6xl mx-auto px-5 py-6 space-y-6">
      {/* Back nav */}
      <Link href="/deals" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Deals
      </Link>

      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <div className="whai-card overflow-hidden">
        {/* Top accent bar */}
        <div className={cn(
          'h-1',
          deal.dealStage === 'Completed' ? 'bg-green-400'
            : deal.dealStage === 'Announced' ? 'bg-[#00B4D8]'
              : deal.dealStage === 'Terminated' ? 'bg-red-400'
                : 'bg-amber-400',
        )} />

        <div className="p-6 sm:p-8">
          {/* Type + Stage */}
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <span className="text-xs font-medium text-slate-400 bg-[#112850] px-2.5 py-1 rounded-md border border-[#1a3a5c]">
              {deal.dealType}
            </span>
            <span className={cn('whai-badge border', STAGE_COLORS[deal.dealStage] ?? 'text-slate-300 bg-slate-700/50 border-slate-600')}>
              <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 inline-block', STAGE_DOT[deal.dealStage] ?? 'bg-slate-500')} />
              {deal.dealStage}
            </span>
          </div>

          {/* Title + Value */}
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-4">
                {deal.title}
              </h1>

              {deal.description && (
                <p className="text-sm text-slate-400 leading-relaxed max-w-3xl mb-5">
                  {deal.description}
                </p>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {tags.map((tag: string) => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-[#112850] text-slate-300 border border-[#1a3a5c]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Value block */}
            {deal.dealValueUsd && (
              <div className="shrink-0 text-right p-5 rounded-xl bg-[#112850]/60 border border-[#1a3a5c]">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
                  Deal Value
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-[#00B4D8]">
                  {formatCurrency(BigInt(deal.dealValueUsd))}
                </div>
              </div>
            )}
          </div>

          {/* Key dates row */}
          <div className="flex flex-wrap gap-6 pt-5 border-t border-[#1a3a5c] text-sm">
            {deal.announcedDate && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#112850] border border-[#1a3a5c] flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Announced</div>
                  <div className="text-white font-medium">{formatDate(deal.announcedDate)}</div>
                </div>
              </div>
            )}
            {deal.closedDate && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#112850] border border-[#1a3a5c] flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Closed</div>
                  <div className="text-white font-medium">{formatDate(deal.closedDate)}</div>
                </div>
              </div>
            )}
            {deal.sourceUrl && (
              <a
                href={deal.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#112850] border border-[#1a3a5c] flex items-center justify-center group-hover:border-[#00B4D8]/40 transition-colors">
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-[#00B4D8] transition-colors" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Source</div>
                  <div className="text-[#00B4D8] font-medium text-sm group-hover:underline">View source</div>
                </div>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Parties ───────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Deal Parties
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {deal.acquirerCompany && <CompanyCard company={deal.acquirerCompany} role="Acquirer / Buyer" />}
          {deal.targetCompany && <CompanyCard company={deal.targetCompany} role="Target / Investee" />}
        </div>
      </div>

      {/* ── Investors ─────────────────────────────────────────────────────── */}
      {hasInvestors && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Investors ({deal.investors.length})
          </h2>
          <div className="whai-card px-5">
            {deal.investors.map((inv: any) => (
              <InvestorRow key={inv.id ?? inv.investorCompanyName} inv={inv} />
            ))}
          </div>
        </div>
      )}

      {/* ── Related deals ─────────────────────────────────────────────────── */}
      {relatedDeals?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#00B4D8]" />
            Related Deals ({relatedDeals.length})
          </h2>
          <div className="whai-card overflow-hidden divide-y divide-[#1a3a5c]/60">
            {relatedDeals.map((rd: any) => (
              <Link
                key={rd.id}
                href={`/deals/${rd.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-[#112850]/40 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white group-hover:text-[#00B4D8] transition-colors line-clamp-1">
                    {rd.title}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span>{rd.dealType}</span>
                    {rd.dealStage && (
                      <>
                        <span className={cn('w-1.5 h-1.5 rounded-full', STAGE_DOT[rd.dealStage] ?? 'bg-slate-500')} />
                        <span>{rd.dealStage}</span>
                      </>
                    )}
                    {rd.announcedDate && <span>{formatDate(rd.announcedDate)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {rd.dealValueUsd && (
                    <span className="text-sm font-bold text-[#00B4D8]">
                      {formatCurrency(BigInt(rd.dealValueUsd))}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-[#00B4D8] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
