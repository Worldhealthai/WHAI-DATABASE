'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin, ExternalLink, TrendingUp, Building2 } from 'lucide-react'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { DEAL_TYPE_LABELS, DEAL_STAGE_LABELS } from '@/types'
import type { DealType, DealStage } from '@/types'

async function fetchDeal(id: string) {
  const res = await fetch(`/api/deals/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

const STAGE_COLORS: Record<string, string> = {
  COMPLETED: 'text-green-400 bg-green-400/10 border-green-400/20',
  ANNOUNCED: 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
  TERMINATED: 'text-red-400 bg-red-400/10 border-red-400/20',
  RUMOURED: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

function CompanyCard({ company, role }: { company: any; role: string }) {
  if (!company) return null
  return (
    <div className="whai-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{role}</div>
      <Link href={`/companies/${company.id}`} className="group">
        <div className="font-semibold text-white group-hover:text-[#00B4D8] transition-colors">{company.name}</div>
      </Link>
      {company.verticals?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {company.verticals.slice(0, 3).map((cv: any) => (
            <span key={cv.vertical.id} className="text-xs px-1.5 py-0.5 rounded bg-[#112850] text-slate-300 border border-[#1a3a5c]">
              {cv.vertical.name}
            </span>
          ))}
        </div>
      )}
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
              <span className="text-xs text-slate-400">{DEAL_TYPE_LABELS[deal.deal_type as DealType]}</span>
              <span className={cn('whai-badge border', STAGE_COLORS[deal.deal_stage])}>
                {DEAL_STAGE_LABELS[deal.deal_stage as DealStage]}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">{deal.title}</h1>
          </div>
          {deal.deal_value_disclosed && deal.deal_value_usd && (
            <div className="text-right">
              <div className="text-xs text-slate-500">Deal Value</div>
              <div className="text-3xl font-bold text-[#00B4D8]">
                {formatCurrency(BigInt(deal.deal_value_usd))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-400">
          {deal.announced_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Announced: {formatDate(deal.announced_date)}
            </span>
          )}
          {deal.closed_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Closed: {formatDate(deal.closed_date)}
            </span>
          )}
          {(deal.region || deal.country) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {[deal.region, deal.country].filter(Boolean).join(', ')}
            </span>
          )}
          {deal.source_url && (
            <a href={deal.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-[#00B4D8] transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Source
            </a>
          )}
        </div>

        {deal.description && (
          <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-3xl">{deal.description}</p>
        )}

        {/* Verticals */}
        {deal.verticals?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {deal.verticals.map((dv: any) => (
              <span key={dv.vertical.id} className="text-xs px-2 py-0.5 rounded bg-[#112850] text-slate-300 border border-[#1a3a5c]">
                {dv.vertical.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Parties */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {deal.acquirer_company && <CompanyCard company={deal.acquirer_company} role="Acquirer / Investor" />}
        {deal.target_company && <CompanyCard company={deal.target_company} role="Target / Investee" />}
        {deal.investors?.map((inv: any) => (
          <div key={inv.company.id} className="whai-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              {inv.investor_role} Investor
            </div>
            <Link href={`/companies/${inv.company.id}`} className="group">
              <div className="font-semibold text-white group-hover:text-[#00B4D8] transition-colors">{inv.company.name}</div>
            </Link>
            {inv.investment_amount_usd && (
              <div className="text-sm font-semibold text-[#00B4D8] mt-1">
                {formatCurrency(BigInt(inv.investment_amount_usd))}
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
                  <span>{DEAL_TYPE_LABELS[rd.deal_type as DealType]}</span>
                  {rd.announced_date && <span>· {formatDate(rd.announced_date)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
