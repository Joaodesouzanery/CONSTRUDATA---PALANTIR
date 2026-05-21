import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Lock, Mail, User, Workflow } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export function AcceptInvitationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!token) {
      setError('Convite inválido ou sem token.')
      return
    }

    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.')
      return
    }

    setLoading(true)
    try {
      const credentials = { email: email.trim().toLowerCase(), password }

      const authResponse = mode === 'signup'
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials)

      if (authResponse.error) throw authResponse.error
      if (!authResponse.data.session) {
        setError('Conta criada. Confirme seu e-mail e volte para aceitar o convite.')
        return
      }

      const { error: acceptError } = await supabase.rpc('accept_invitation', {
        p_token: token,
        p_full_name: fullName.trim() || null,
      })
      if (acceptError) throw acceptError

      await useAuth.getState().refreshProfile()
      navigate('/app/minha-rotina')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aceitar convite.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf7ee] px-4 py-10 text-[#1f2420] auth-grid">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden border border-[#e4dccf] bg-[#fffdf8] shadow-[0_28px_90px_rgba(31,36,32,0.10)] lg:grid-cols-[0.9fr_1fr]">
          <section className="hidden border-r border-[#e4dccf] bg-[#fffaf0] p-10 lg:flex lg:flex-col lg:justify-between">
            <Link to="/" className="flex items-center gap-3 text-sm font-black uppercase">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff6b2c] text-white">
                <Workflow size={18} />
              </span>
              ConstruData
            </Link>

            <div>
              <p className="text-xs font-black uppercase text-[#ff6b2c]">Convite privado</p>
              <h1 className="mt-4 text-5xl font-black uppercase leading-tight">
                Seu acesso nasce vinculado à empresa.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-[#526058]">
                Ao aceitar o convite, seu login entra com empresa, função e permissões definidos.
                Os dados ficam separados e auditáveis desde o primeiro acesso.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs font-black uppercase text-[#526058]">
              <span className="border border-[#e4dccf] bg-[#fffdf8] p-3">Empresa</span>
              <span className="border border-[#e4dccf] bg-[#fffdf8] p-3">Função</span>
              <span className="border border-[#e4dccf] bg-[#fffdf8] p-3">Permissão</span>
            </div>
          </section>

          <section className="p-6 sm:p-10">
            <div className="mb-8 text-center lg:text-left">
              <Link to="/" className="inline-flex items-center gap-3 text-sm font-black uppercase lg:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff6b2c] text-white">
                  <Workflow size={18} />
                </span>
                ConstruData
              </Link>
              <h1 className="mt-8 text-3xl font-black uppercase text-[#1f2420]">Aceitar convite</h1>
              <p className="mt-2 text-sm text-[#657069]">Entre na conta da empresa com o e-mail convidado.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`h-11 border text-xs font-black uppercase transition ${
                    mode === 'signup'
                      ? 'border-[#ff6b2c] bg-[#fff0d7] text-[#ff6b2c]'
                      : 'border-[#d8cfc0] bg-[#fffdf8] text-[#817568]'
                  }`}
                >
                  Criar acesso
                </button>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`h-11 border text-xs font-black uppercase transition ${
                    mode === 'login'
                      ? 'border-[#ff6b2c] bg-[#fff0d7] text-[#ff6b2c]'
                      : 'border-[#d8cfc0] bg-[#fffdf8] text-[#817568]'
                  }`}
                >
                  Já tenho senha
                </button>
              </div>

              <Field icon={<User size={16} />} label="Nome">
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  disabled={loading || mode === 'login'}
                  placeholder="Seu nome"
                  className="h-12 w-full border border-[#d8cfc0] bg-[#fffdf8] pl-10 pr-3 text-sm text-[#1f2420] outline-none transition placeholder:text-[#9b8f7d] focus:border-[#ff6b2c] disabled:opacity-50"
                />
              </Field>

              <Field icon={<Mail size={16} />} label="E-mail convidado">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  placeholder="voce@empresa.com.br"
                  className="h-12 w-full border border-[#d8cfc0] bg-[#fffdf8] pl-10 pr-3 text-sm text-[#1f2420] outline-none transition placeholder:text-[#9b8f7d] focus:border-[#ff6b2c]"
                  required
                />
              </Field>

              <Field icon={<Lock size={16} />} label="Senha">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  placeholder="************"
                  className="h-12 w-full border border-[#d8cfc0] bg-[#fffdf8] pl-10 pr-3 text-sm text-[#1f2420] outline-none transition placeholder:text-[#9b8f7d] focus:border-[#ff6b2c]"
                  required
                />
              </Field>

              {error && (
                <div className="border border-red-300 bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 bg-[#ff6b2c] text-sm font-black uppercase text-white transition hover:bg-[#f25d1e] disabled:opacity-50"
              >
                {loading ? 'Processando...' : <>Aceitar convite <ArrowRight size={16} /></>}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="text-xs font-semibold text-[#817568] hover:text-[#ff6b2c]">
                Voltar para login
              </Link>
            </div>
          </section>
        </div>
      </div>
      <style>{`
        .auth-grid {
          background-image:
            linear-gradient(rgba(31,36,32,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31,36,32,0.07) 1px, transparent 1px);
          background-size: 82px 82px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        }
      `}</style>
    </div>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-[#817568]">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#ff6b2c]">
          {icon}
        </div>
        {children}
      </div>
    </div>
  )
}
