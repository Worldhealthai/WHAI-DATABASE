'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Globe, Loader2, ChevronDown, X, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  searching?: boolean
}

const SUGGESTIONS = [
  { label: 'How many sponsors are In Discussion?', icon: '📊' },
  { label: 'Who are WHAI\'s main competitors?', icon: '🔍' },
  { label: 'Ideas for chasing healthcare AI sponsors', icon: '💡' },
  { label: 'Top healthcare AI events in 2025', icon: '🌍' },
]

function PulseLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <radialGradient id="pg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pl" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="url(#pg)" />
      <circle cx="20" cy="20" r="17" stroke="#0ea5e9" strokeWidth="1" strokeOpacity="0.25" />
      <polyline
        points="3,20 8,20 11,13 14,27 17,20 20,20 23,10 26,30 29,20 32,20 37,20"
        stroke="url(#pl)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <circle cx="20" cy="20" r="2" fill="#22d3ee" />
    </svg>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce"
          style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  )
}

function EmptyState({ onSuggest }: { onSuggest: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="relative overflow-hidden rounded-xl p-4"
        style={{ background: 'linear-gradient(135deg, #071e3d 0%, #0c2d52 50%, #071e3d 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 rounded-full opacity-20"
            style={{ background: 'radial-gradient(ellipse, #22d3ee, transparent)' }} />
        </div>
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#22d3ee 1px, transparent 1px), linear-gradient(90deg, #22d3ee 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center gap-3">
          <div className="shrink-0 p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <PulseLogo size={40} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-white tracking-tight">Pulse</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/70 bg-cyan-400/10 px-1.5 py-0.5 rounded-full border border-cyan-400/20">by WHAI</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">Live CRM data meets live web search</p>
          </div>
        </div>
        <div className="relative mt-3 flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400" />
          </span>
          <span className="text-[10px] text-slate-500">Connected to your CRM · Web search enabled</span>
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold px-0.5">Try asking</p>
      <div className="space-y-1.5">
        {SUGGESTIONS.map(s => (
          <button key={s.label} onClick={() => onSuggest(s.label)}
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#1a3a5c] hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-left">
            <span className="text-sm leading-none shrink-0">{s.icon}</span>
            <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors flex-1">{s.label}</span>
            <span className="text-slate-700 group-hover:text-cyan-500 transition-colors text-xs">↗</span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface PanelProps {
  messages: Message[]
  loading: boolean
  input: string
  setInput: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onSuggest: (s: string) => void
  inputRef: React.RefObject<HTMLInputElement>
  scrollRef: React.RefObject<HTMLDivElement>
  bottomRef: React.RefObject<HTMLDivElement>
  onScroll: () => void
  inline: boolean
  onClose?: () => void
}

function ChatPanel({ messages, loading, input, setInput, onSubmit, onSuggest, inputRef, scrollRef, bottomRef, onScroll, inline, onClose }: PanelProps) {
  return (
    <div className={cn(
      'flex flex-col bg-[#0a1c38] border border-[#1a3a5c]',
      inline ? 'rounded-2xl h-full' : 'rounded-2xl h-full w-full',
    )}
      style={{ boxShadow: '0 0 0 1px #1a3a5c, 0 24px 60px -12px rgba(0,0,0,0.7)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a3a5c]/80 shrink-0"
        style={{ background: 'linear-gradient(90deg, #071e3d 0%, #0c2540 100%)' }}>
        <div className="flex items-center gap-2.5">
          <PulseLogo size={26} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">Pulse</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-cyan-400/60 bg-cyan-400/10 px-1.5 py-0.5 rounded-full border border-cyan-400/15">by WHAI</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Globe className="w-2.5 h-2.5 text-slate-600" />
              <span className="text-[10px] text-slate-600">Live web search · CRM data</span>
            </div>
          </div>
        </div>
        {!inline && onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#1a3a5c] text-slate-600 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages — flex-1 min-h-0 is critical for overflow to work inside flex */}
      <div ref={scrollRef} onScroll={onScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyState onSuggest={onSuggest} />
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-3 h-3 text-cyan-400" />
                </div>
              )}
              <div className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-cyan-600 to-teal-600 text-white rounded-br-sm shadow-lg shadow-cyan-900/30'
                  : 'bg-[#0f2545] border border-[#1a3a5c] text-slate-200 rounded-bl-sm',
              )}>
                {msg.role === 'assistant' && msg.searching && !msg.content && (
                  <div className="flex items-center gap-2 text-xs">
                    <Globe className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '2s' }} />
                    <span className="text-cyan-400/70">Searching the web…</span>
                  </div>
                )}
                {msg.role === 'assistant' && !msg.content && !msg.searching
                  ? <TypingDots />
                  : <span className="whitespace-pre-wrap">{msg.content}</span>
                }
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-[#1a3a5c]/60 shrink-0">
        <form onSubmit={onSubmit}>
          <div className="flex items-center gap-2 rounded-xl border border-[#1e3f6a] focus-within:border-cyan-500/40 transition-colors px-3.5 py-2.5"
            style={{ background: 'linear-gradient(135deg, #061525, #071e3d)' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Pulse anything…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-700 outline-none"
              disabled={loading}
            />
            <button type="submit" disabled={!input.trim() || loading}
              className="p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
              style={{ background: 'linear-gradient(135deg, #0891b2, #0d9488)' }}>
              {loading
                ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                : <Send className="w-3.5 h-3.5 text-white" />
              }
            </button>
          </div>
        </form>
        <p className="text-center text-[9px] text-slate-700 mt-1.5 tracking-wide">Powered by Claude · Brave Web Search</p>
      </div>
    </div>
  )
}

export function AIAssistant({ inline = false }: { inline?: boolean }) {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const scrollRef               = useRef<HTMLDivElement>(null)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)
  const stickToBottom           = useRef(true)

  // Scroll the inner message container only (never the page) when new
  // content arrives and the user is already near the bottom. Skipped while
  // there are no messages so opening the dashboard never jumps to Pulse.
  useEffect(() => {
    if (messages.length === 0) return
    if (stickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120)
  }, [open])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    // New message = snap back to bottom
    stickToBottom.current = true

    const userMsg: Message      = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const assistantId           = crypto.randomUUID()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', searching: false }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'text') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + evt.text, searching: false } : m,
              ))
            } else if (evt.type === 'searching') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, searching: true } : m,
              ))
            } else if (evt.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: `Error: ${evt.text}`, searching: false } : m,
              ))
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Sorry, something went wrong. Please try again.', searching: false }
          : m,
      ))
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input) }

  const panelProps: PanelProps = {
    messages, loading, input, setInput,
    onSubmit: handleSubmit, onSuggest: sendMessage,
    inputRef, scrollRef, bottomRef, onScroll: handleScroll, inline,
  }

  if (inline) {
    return (
      <div className="h-full">
        <ChatPanel {...panelProps} />
      </div>
    )
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Open Pulse AI"
        className={cn(
          'fixed bottom-20 right-5 md:bottom-6 md:right-6 z-50',
          'w-[52px] h-[52px] rounded-2xl flex items-center justify-center transition-all duration-200',
          open ? 'bg-[#1a3a5c] text-slate-400' : 'text-white shadow-lg shadow-cyan-900/40',
        )}
        style={open ? {} : { background: 'linear-gradient(135deg, #0891b2, #0d9488)' }}
      >
        {open ? <ChevronDown className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
      </button>

      {/* Floating panel — fixed size, ChatPanel fills it */}
      <div
        className={cn(
          'fixed bottom-[84px] right-5 md:bottom-[76px] md:right-6 z-50',
          'w-[390px] transition-all duration-300 origin-bottom-right',
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none',
        )}
        style={{ height: '540px' }}
      >
        <ChatPanel {...panelProps} onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
