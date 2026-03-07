'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin, ExternalLink, TrendingUp, Building2 } from 'lucide-react'
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

function CompanyCard({ company, role }: { company: any; role: string }) {
  if (!company) return null
  return (
    <div className="whai-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{role}</div>
      <Link href={`/companies/${company.id}`} className="group">
        <div className="font-semibold text-white group-hover:text-[#00B4D8] transition-colors">{company.name}</div>
      </Link>
    </div>
  )
}

export default function DealDetailPage({ params }: { params: { id: string } }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['deal', params.id],
    queryFn: () => fetchDeal(params.id),
  })

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh] text-slate-500 text-sm">Loading…</div>
  if (error || !data) return <div className="flex items-center justify-center min-h-[50vh] text-red-400 text-sm">Deal not found.</div>

  const { deal, relatedDeals } = data

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <Link href="/deals" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Deals
      </Link>

      {/* Header */}
      <div className="whai-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs text-slate-400">{deal.dealType}</span>
              <span className={cn('whai-badge border', STAGE_COLORS[deal.dealStage] ?? 'text-slate-300 bg-slate-700/50 border-slate-600')}>
                {deal.dealStage}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">{deal.title}</h1>
          </div>
          {deal.dealValueUsd && (
            <div className="text-right">
              <div className="text-xs text-slate-500">Deal Value</div>
              <div className="text-3xl font-bold text-[#00B4D8]">
                {formatCurrency(BigInt(deal.dealValueUsd))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-400">
          {deal.announcedDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Announced: {formatDate(deal.announcedDate)}
            </span>
          )}
          {deal.closedDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Closed: {formatDate(deal.closedDate)}
            </span>
          )}
          {deal.sourceUrl && (
            <a href={deal.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-[#00B4D8] transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Source
            </a>
          )}
        </div>

        {deal.description && (
          <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-3xl">{deal.description}</p>
        )}

        {/* Tags */}
        {deal.tags && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            <span className="text-xs px-2 py-0.5 rounded bg-[#112850] text-slate-300 border border-[#1a3a5c]">
              {deal.tags}
            </span>
          </div>
        )}
      </div>

      {/* Parties */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {deal.acquirerCompany && <CompanyCard company={deal.acquirerCompany} role="Acquirer / Investor" />}
        {deal.targetCompany && <CompanyCard company={deal.targetCompany} role="Target / Investee" />}
        {deal.investors?.map((inv: any) => (
          <div key={inv.investorCompanyId ?? inv.investorCompanyName} className="whai-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              {inv.investorRole} Investor
            </div>
            {inv.company ? (
              <Link href={`/companies/${inv.company.id}`} className="group">
                <div className="font-semibold text-white group-hover:text-[#00B4D8] transition-colors">{inv.company.name}</div>
              </Link>
            ) : inv.investorCompanyName ? (
              <div className="font-semibold text-white">{inv.investorCompanyName}</div>
            ) : null}
            {inv.investmentAmountUsd && (
              <div className="text-sm font-semibold text-[#00B4D8] mt-1">
                {formatCurrency(BigInt(inv.investmentAmountUsd))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Related Deals */}
      {relatedDeals?.length > 0 && (
        <div className="whai-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00B4D8]" /> Related Deals
            </h2>
          </div>
          <div className="divide-y divide-border">
            {relatedDeals.map((rd: any) => (
              <div key={rd.id} className="px-4 py-3 hover:bg-[#112850]/50 transition-colors">
                <Link href={`/deals/${rd.id}`} className="font-medium text-white hover:text-[#00B4D8] transition-colors">
                  {rd.title}
                </Link>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span>{rd.dealType}</span>
                  {rd.announcedDate && <span>· {formatDate(rd.announcedDate)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
