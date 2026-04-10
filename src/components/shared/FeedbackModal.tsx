import { useState } from 'react'
import { X, Star, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

const MODULES = [
  'RDO', 'Gestão 360', 'EVM', 'Planejamento', 'Suprimentos',
  'Mão de Obra', 'BIM', 'Agenda', 'Qualidade', 'Outro',
]

const DESTINATION_EMAIL = 'joaodsouzanery@gmail.com'

interface Props {
  onClose: () => void
}

export function FeedbackModal({ onClose }: Props) {
  const [rating,      setRating]      = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [module,      setModule]      = useState('')
  const [improvement, setImprovement] = useState('')
  const [nps,         setNps]         = useState<number | null>(null)
  const [sent,        setSent]        = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const subject = encodeURIComponent('Feedback — Atlântico ConstruData')
    const body = encodeURIComponent(
      `Avaliação geral: ${rating}/5 estrelas\n` +
      `Módulo mais usado: ${module || 'Não informado'}\n` +
      `NPS (0–10): ${nps !== null ? nps : 'Não respondido'}\n\n` +
      `O que poderia melhorar:\n${improvement || 'Não informado'}\n\n` +
      `---\nEnviado via Atlântico ConstruData`
    )

    window.open(`mailto:${DESTINATION_EMAIL}?subject=${subject}&body=${body}`, '_blank')
    setSent(true)
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-2xl"
        style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#333]">
          <div>
            <h2 className="text-sm font-semibold text-white">Pesquisa de Satisfação</h2>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">Sua opinião melhora a plataforma</p>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="px-5 py-10 text-center">
            <div className="text-3xl mb-3">🎉</div>
            <p className="text-sm font-semibold text-white mb-1">Obrigado pelo feedback!</p>
            <p className="text-xs text-[#9ca3af]">Seu cliente de e-mail foi aberto com as respostas preenchidas.</p>
            <button
              onClick={onClose}
              className="mt-6 px-5 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ background: '#f97316' }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-5">
            {/* Q1: Star rating */}
            <div>
              <p className="text-xs font-semibold text-[#e5e5e5] mb-2">
                1. Como você avalia a plataforma no geral?
              </p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      size={24}
                      className={cn(
                        'transition-colors',
                        (hoverRating || rating) >= star
                          ? 'fill-[#f97316] stroke-[#f97316]'
                          : 'stroke-[#525252] fill-transparent',
                      )}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-2 text-xs text-[#9ca3af] self-center">
                    {['', 'Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente'][rating]}
                  </span>
                )}
              </div>
            </div>

            {/* Q2: Module */}
            <div>
              <label className="text-xs font-semibold text-[#e5e5e5] block mb-2">
                2. Qual módulo você mais usa?
              </label>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#f97316]"
              >
                <option value="">Selecione…</option>
                {MODULES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Q3: Improvement */}
            <div>
              <label className="text-xs font-semibold text-[#e5e5e5] block mb-2">
                3. O que poderia melhorar?
              </label>
              <textarea
                value={improvement}
                onChange={(e) => setImprovement(e.target.value)}
                rows={3}
                placeholder="Escreva aqui sua sugestão…"
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-white placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316] resize-none"
              />
            </div>

            {/* Q4: NPS */}
            <div>
              <p className="text-xs font-semibold text-[#e5e5e5] mb-2">
                4. De 0 a 10, você recomendaria a plataforma?
              </p>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNps(n)}
                    className={cn(
                      'w-8 h-8 rounded text-xs font-semibold transition-colors',
                      nps === n
                        ? 'bg-[#f97316] text-white'
                        : 'bg-[#2c2c2c] border border-[#525252] text-[#9ca3af] hover:border-[#f97316] hover:text-white',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ background: '#f97316' }}
            >
              <Send size={14} />
              Enviar Feedback
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
