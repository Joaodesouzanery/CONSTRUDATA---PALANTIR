import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { FlowHoverButton } from '@/components/ui/flow-hover-button'

interface FormData {
  nome: string
  sobrenome: string
  email: string
  empresa: string
  cargo: string
  estado: string
}

const EMPTY: FormData = { nome: '', sobrenome: '', email: '', empresa: '', cargo: '', estado: '' }

export function ContactForm() {
  const [form, setForm] = useState<FormData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2abfdc] focus:border-transparent transition-all bg-white'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_KEY ?? 'YOUR_WEB3FORMS_KEY',
          subject: 'Nova Solicitação de Demo — Atlântico',
          from_name: `${form.nome} ${form.sobrenome}`,
          email: form.email,
          empresa: form.empresa,
          cargo: form.cargo,
          estado: form.estado,
          message: `Nome: ${form.nome} ${form.sobrenome}\nEmail: ${form.email}\nEmpresa: ${form.empresa}\nCargo: ${form.cargo}\nEstado: ${form.estado}`,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
        setForm(EMPTY)
      } else {
        setError('Ocorreu um erro. Tente novamente ou envie um email para joaodsouzanery@gmail.com.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="contato" className="py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-8 py-10 bg-gradient-to-br from-[#0a1628] to-[#112645]">
            <h2 className="text-3xl font-bold text-white mb-2">Ganhe uma vantagem com Atlântico.</h2>
            <p className="text-white/60">
              Preencha o formulário e nossa equipe entrará em contato para agendar uma apresentação personalizada.
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-10">
            {success ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Recebemos sua solicitação!</h3>
                <p className="text-gray-600 max-w-md">
                  Obrigado! Nossa equipe entrará em contato em breve para agendar sua apresentação personalizada da plataforma Atlântico.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome <span className="text-red-500">*</span></label>
                    <input required className={inputCls} placeholder="João" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Sobrenome <span className="text-red-500">*</span></label>
                    <input required className={inputCls} placeholder="Silva" value={form.sobrenome} onChange={(e) => setForm((f) => ({ ...f, sobrenome: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Endereço de Email <span className="text-red-500">*</span></label>
                  <input required type="email" className={inputCls} placeholder="joao@empresa.com.br" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da Empresa <span className="text-red-500">*</span></label>
                    <input required className={inputCls} placeholder="Construtora XYZ" value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Cargo <span className="text-red-500">*</span></label>
                    <input required className={inputCls} placeholder="Diretor de Engenharia" value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado / País <span className="text-red-500">*</span></label>
                  <input required className={inputCls} placeholder="São Paulo, Brasil" value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} />
                </div>

                {error && (
                  <p className="text-red-600 text-sm">{error}</p>
                )}

                <FlowHoverButton
                  variant="light"
                  type="submit"
                  disabled={loading}
                  className="w-full justify-center text-base py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Enviando...' : 'Solicitar Apresentação'}
                </FlowHoverButton>

                <p className="text-gray-400 text-xs text-center">
                  Ao enviar, você concorda em receber comunicações da equipe Atlântico. Sem spam.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
