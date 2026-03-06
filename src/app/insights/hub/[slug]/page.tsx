import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Globe, Calendar, User } from 'lucide-react'
import { getHubArticle } from '@/data/intelligence-hub'

const CONTENT_TYPE_LABELS: Record<string, string> = {
  'market-pulse': 'News Brief',
  'deep-dive': 'Analysis',
  'data-snapshot': 'Data Snapshot',
  'quarterly-report': 'Quarterly Report',
  'educational': 'Analysis',
  'market-report': 'Market Report',
}

const CONTENT_TYPE_COLORS: Record<string, string> = {
  'market-pulse': 'text-green-400 bg-green-400/10 border-green-400/20',
  'deep-dive': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  'data-snapshot': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  'quarterly-report': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  'market-report': 'text-[#00B4D8] bg-[#00B4D8]/10 border-[#00B4D8]/20',
}

export default async function HubArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getHubArticle(slug)

  if (!article) notFound()

  const typeLabel = CONTENT_TYPE_LABELS[article.content_type] ?? article.content_type
  const typeColor = CONTENT_TYPE_COLORS[article.content_type] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/20'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/insights"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Insights
      </Link>

      {/* Header */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded border ${typeColor}`}>
            {typeLabel}
          </span>
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#00B4D8]/10 border border-[#00B4D8]/20 text-[#00B4D8]">
            <Globe className="w-2.5 h-2.5" /> worldhealthai.com
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white leading-snug">{article.title}</h1>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          {article.author && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {article.author}
            </span>
          )}
          {article.date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {article.date}
            </span>
          )}
        </div>

        {article.excerpt && (
          <p className="text-slate-300 text-sm leading-relaxed border-l-2 border-[#00B4D8] pl-4">
            {article.excerpt}
          </p>
        )}

        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {article.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-[#112850] text-slate-400 border border-[#1a3a5c]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Article body */}
      <div
        className="prose prose-invert prose-sm max-w-none
          prose-headings:text-white prose-headings:font-semibold
          prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
          prose-p:text-slate-300 prose-p:leading-relaxed
          prose-li:text-slate-300
          prose-strong:text-white
          prose-a:text-[#00B4D8] prose-a:no-underline hover:prose-a:underline
          prose-ul:pl-4 prose-ol:pl-4"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />
    </div>
  )
}

export async function generateStaticParams() {
  const { ALL_HUB_ARTICLES } = await import('@/data/intelligence-hub')
  return ALL_HUB_ARTICLES.map((a) => ({ slug: a.slug }))
}
