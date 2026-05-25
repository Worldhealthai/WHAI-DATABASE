'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, X, Send, Globe, Loader2, ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  searching?: boolean
}

const SUGGESTIONS = [
  'How many confirmed sponsors do we have?',
  'Show me the speaker pipeline',
  'Find healthcare AI events in 2025',
  'Who are WHAI competitors?',
]

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}

export function AIAssistant({ inline = false }: { inline?: boolean }) {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [open, messages])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const assistantId = crypto.randomUUID()
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

      if (!res.ok || !res.body) {
        throw new Error('Request failed')
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

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
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: 'Sorry, something went wrong. Please try again.', searching: false } : m,
      ))
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const content = (
    <div className={cn(
      'flex flex-col bg-[#0d2040] border border-[#1a3a5c]',
      inline
        ? 'rounded-xl h-[520px]'
        : 'rounded-2xl shadow-2xl shadow-black/60 h-[520px] w-[380px]',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a3a5c]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-violet-500/15">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">WHAI AI Assistant</div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <Globe className="w-2.5 h-2.5" />
              Live web search + CRM data
            </div>
          </div>
        </div>
        {!inline && (
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-[#1a3a5c] text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="text-center pt-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                <Bot className="w-6 h-6 text-violet-400" />
              </div>
              <p className="text-sm text-slate-300 font-medium">Ask me anything</p>
              <p className="text-xs text-slate-500 mt-1">I can search the web and access your live CRM data</p>
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-[#1a3a5c] hover:border-violet-500/40 hover:bg-violet-500/5 text-xs text-slate-400 hover:text-slate-200 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-violet-400" />
                </div>
              )}
              <div className={cn(
                'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-br-sm'
                  : 'bg-[#112850] text-slate-200 rounded-bl-sm',
              )}>
                {msg.role === 'assistant' && msg.searching && !msg.content && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Globe className="w-3 h-3 animate-pulse text-violet-400" />
                    Searching the web…
                  </div>
                )}
                {msg.role === 'assistant' && !msg.content && !msg.searching ? (
                  <TypingDots />
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 py-3 border-t border-[#1a3a5c]">
        <div className="flex items-center gap-2 bg-[#071528] rounded-xl border border-[#1a3a5c] focus-within:border-violet-500/50 transition-colors px-3 py-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about CRM data or search the web…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>
      </form>
    </div>
  )

  if (inline) return content

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'fixed bottom-20 right-5 md:bottom-6 md:right-6 z-50',
          'w-12 h-12 rounded-2xl shadow-lg shadow-violet-900/40 flex items-center justify-center transition-all duration-200',
          open
            ? 'bg-[#1a3a5c] text-slate-400 rotate-0'
            : 'bg-violet-600 hover:bg-violet-500 text-white',
        )}
        aria-label="Open AI assistant"
      >
        {open ? <ChevronDown className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {/* Panel */}
      <div className={cn(
        'fixed bottom-36 right-5 md:bottom-20 md:right-6 z-50 transition-all duration-300 origin-bottom-right',
        open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none',
      )}>
        {content}
      </div>
    </>
  )
}
