'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Calendar, User, Lock, BookOpen } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { CONTENT_TYPE_LABELS } from '@/types'
import type { ContentType } from '@/types'

async function fetchInsight(slug: string) {
  const res = await fetch(`/api/insights/${slug}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export default function InsightPage({ params }: { params: { slug: string } }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['insight', params.slug],
    queryFn: () => fetchInsight(params.slug),
  })

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh] text-slate-500 text-sm">Loading…</div>
  if (error || !data) return <div className="flex items-center justify-center min-h-[50vh] text-red-400 text-sm">Article not found.</div>

  const { insight, related } = data

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Link href="/insights" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Insights
      </Link>

      <article className="whai-card p-8">
        {/* Meta */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded border text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20">
            {CONTENT_TYPE_LABELS[insight.content_type as ContentType]}
          </span>
          {insight.is_premium && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border text-amber-300 bg-amber-400/10 border-amber-400/20">
              <Lock className="w-3 h-3" /> Premium
            </span>
          )}
        </div>

        <h1 className="text-3xl font-bold text-white leading-tight mb-4">{insight.title}</h1>
        <p className="text-slate-400 text-base leading-relaxed border-l-2 border-[#00B4D8] pl-4 mb-6 italic">
          {insight.summary}
        </p>

        <div className="flex items-center gap-4 text-xs text-slate-500 mb-8 pb-4 border-b border-border">
          {insight.author && (
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> {insight.author}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> {formatDate(insight.published_at)}
          </span>
          <span>{insight.view_count} views</span>
        </div>

        {/* Body */}
        <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed">
          {insight.body.split('\n').map((paragraph: string, i: number) => {
            if (paragraph.startsWith('## ')) {
              return <h2 key={i} className="text-xl font-bold text-white mt-6 mb-3">{paragraph.slice(3)}</h2>
            }
            if (paragraph.startsWith('### ')) {
              return <h3 key={i} className="text-base font-semibold text-white mt-4 mb-2">{paragraph.slice(4)}</h3>
            }
            if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
              return <p key={i} className="font-semibold text-slate-200 my-2">{paragraph.slice(2, -2)}</p>
            }
            if (!paragraph.trim()) return <br key={i} />
            return <p key={i} className="my-2">{paragraph}</p>
          })}
        </div>

        {/* Verticals + TAs */}
        {(insight.verticals?.length > 0 || insight.therapeutic_areas?.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-8 pt-4 border-t border-border">
            {insight.verticals?.map((iv: any) => (
              <span key={iv.vertical.id} className="text-xs px-2 py-0.5 rounded bg-[#112850] text-slate-300 border border-[#1a3a5c]">
                {iv.vertical.name}
              </span>
            ))}
            {insight.therapeutic_areas?.map((ita: any) => (
              <span key={ita.therapeutic_area.id} className="text-xs px-2 py-0.5 rounded bg-purple-900/20 text-purple-300 border border-purple-700/30">
                {ita.therapeutic_area.name}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* Related articles */}
      {related?.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-4">Related Insights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {related.map((r: any) => (
              <Link key={r.id} href={`/insights/${r.slug}`} className="whai-card p-4 hover:border-[#00B4D8]/40 transition-all group">
                <div className="text-xs text-slate-500 mb-1">{CONTENT_TYPE_LABELS[r.content_type as ContentType]} · {formatDate(r.published_at)}</div>
                <div className="font-medium text-white group-hover:text-[#00B4D8] transition-colors text-sm line-clamp-2">
                  {r.title}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
