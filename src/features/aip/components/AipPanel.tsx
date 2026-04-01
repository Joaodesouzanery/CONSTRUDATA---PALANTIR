/**
 * AipPanel — Palantir-style AI assistant for CONSTRUDATA platform.
 *
 * Uses a rule-based query engine — no external API required, no token costs.
 * Reads live data from Zustand stores and returns structured responses.
 */
import { useRef, useEffect, useState } from 'react'
import { Sparkles, X, Send, Trash2, BrainCircuit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAipStore } from '../store/aipStore'
import { queryLocal } from '../utils/queryEngine'

const SUGGESTIONS = [
  'Quantos RDOs foram registrados?',
  'Qual o clima dos últimos RDOs?',
  'Projetos ativos',
  'PPC desta semana',
  'Riscos críticos',
]

function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex gap-2 mb-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-[#f97316]/15 border border-[#f97316]/30 flex items-center justify-center mt-0.5">
          <Sparkles size={13} className="text-[#f97316]" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed',
          isUser
            ? 'bg-[#f97316] text-white rounded-br-sm'
            : 'bg-[#3d3d3d] text-[#f5f5f5] border border-[#525252] rounded-bl-sm'
        )}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {content}
      </div>
    </div>
  )
}

export function AipPanel() {
  const { isOpen, messages, isLoading, togglePanel, addMessage, setLoading, clearHistory } =
    useAipStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, messages.length])

  function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    addMessage('user', text)
    setLoading(true)

    // Small timeout to allow UI to update before running query
    setTimeout(() => {
      try {
        const reply = queryLocal(text)
        addMessage('assistant', reply)
      } catch (err) {
        addMessage('assistant', `❌ Erro ao processar consulta: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setLoading(false)
      }
    }, 120)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={togglePanel}
        title="AIP — Assistente de Dados"
        className={cn(
          'fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full',
          'flex items-center justify-center shadow-lg transition-all duration-200',
          'border border-[#f97316]/40 hover:border-[#f97316]/80',
          isOpen
            ? 'bg-[#f97316] text-white'
            : 'bg-[#2c2c2c] text-[#f97316] hover:bg-[#3d3d3d]',
        )}
        style={{ boxShadow: '0 4px 20px rgba(249,115,22,0.3)' }}
      >
        {isOpen ? <X size={20} /> : <BrainCircuit size={20} />}
      </button>

      {/* Slide-in panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full z-40 flex flex-col',
          'border-l border-[#525252] bg-[#2c2c2c]',
          'transition-transform duration-300 ease-in-out',
          'w-[400px] max-w-[100vw]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.4)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[#525252] shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30">
            <BrainCircuit size={16} className="text-[#f97316]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[#f5f5f5] text-sm font-semibold tracking-wide">AIP</span>
            <span className="text-[#6b6b6b] text-[10px] uppercase tracking-widest">Assistente de Dados</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="flex items-center gap-1 mr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-[#6b6b6b] text-[10px]">offline</span>
            </div>
            <button
              onClick={clearHistory}
              title="Limpar histórico"
              className="p-1.5 rounded-md text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#3d3d3d] transition-colors"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={togglePanel}
              title="Fechar"
              className="p-1.5 rounded-md text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#3d3d3d] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
                <Sparkles size={24} className="text-[#f97316]" />
              </div>
              <div>
                <p className="text-[#f5f5f5] text-sm font-medium mb-1">Como posso ajudar?</p>
                <p className="text-[#6b6b6b] text-xs leading-relaxed max-w-[280px]">
                  Consulte dados de RDOs, projetos, PPC, riscos e muito mais — sem internet.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[300px]">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-[#525252] text-[#a3a3a3] hover:border-[#f97316]/40 hover:text-[#f5f5f5] hover:bg-[#3d3d3d] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}

          {isLoading && (
            <div className="flex gap-2 mb-3 justify-start">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[#f97316]/15 border border-[#f97316]/30 flex items-center justify-center mt-0.5">
                <Sparkles size={13} className="text-[#f97316]" />
              </div>
              <div className="px-3.5 py-2.5 rounded-xl bg-[#3d3d3d] border border-[#525252] rounded-bl-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 px-4 py-3 border-t border-[#525252]">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: quantos rdos? / ppc / riscos / clima…"
              rows={1}
              className={cn(
                'flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm',
                'bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5]',
                'placeholder:text-[#6b6b6b] outline-none',
                'focus:border-[#f97316]/50 transition-colors',
                'max-h-32 overflow-y-auto',
              )}
              style={{ scrollbarWidth: 'none' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
                'transition-colors',
                input.trim() && !isLoading
                  ? 'bg-[#f97316] text-white hover:bg-[#ea580c]'
                  : 'bg-[#3d3d3d] text-[#525252] cursor-not-allowed border border-[#525252]',
              )}
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-[#525252] text-[10px] mt-2 text-center">
            Motor local · sem API · dados ao vivo
          </p>
        </div>
      </div>

      {/* Backdrop — close panel when clicking outside on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={togglePanel}
        />
      )}
    </>
  )
}
