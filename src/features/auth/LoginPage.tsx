import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { BrandLockup } from '@/components/shared/BrandLogo'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberEmail, setRememberEmail] = useState(true)
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const savedEmail = window.localStorage.getItem('cdata-login-email')
      if (savedEmail) setEmail(savedEmail)
    } catch {
      // localStorage pode estar indisponivel em modo privado.
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) {
      setError('Preencha e-mail e senha.')
      return
    }

    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (authError) {
        if (authError.message.includes('Invalid login')) {
          setError('E-mail ou senha incorretos.')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('E-mail não confirmado. Confirme sua conta antes de entrar.')
        } else {
          setError(`Erro: ${authError.message}`)
        }
        return
      }

      if (!data.session || !data.user) {
        setError('Falha ao iniciar sessão. Tente novamente.')
        return
      }

      try {
        window.localStorage.removeItem('cdata-public-preview')
        if (window.localStorage.getItem('cdata-demo') === 'true') {
          window.localStorage.setItem('cdata-demo', 'false')
        }

        if (rememberEmail) {
          window.localStorage.setItem('cdata-login-email', trimmedEmail)
        } else {
          window.localStorage.removeItem('cdata-login-email')
        }
      } catch {
        // Sem bloqueio de login caso o navegador nao permita persistencia local.
      }

      const { data: profileCheck, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError) {
        await supabase.auth.signOut()
        setError(profileError.message)
        return
      }

      if (!profileCheck) {
        await supabase.auth.signOut()
        setError('Sua conta ainda não está vinculada a uma empresa. Use o link de convite enviado para o seu e-mail ou solicite acesso ao administrador.')
        return
      }

      try {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totp = factors?.totp?.[0]
        if (totp && totp.status === 'verified') {
          navigate('/login/mfa', { state: { factorId: totp.id } })
          return
        }
      } catch {
        // MFA is optional for now.
      }

      await useAuth.getState().refreshProfile()
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(from?.startsWith('/app') ? from : '/app/minha-rotina')
    } catch (err) {
      if (err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch')) {
        setError('Não foi possível conectar ao Supabase. Confira a conexão, as variáveis VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY na Vercel e se o projeto Supabase está ativo.')
      } else {
        setError(err instanceof Error ? err.message : 'Erro inesperado ao autenticar.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf7ee] px-4 py-10 text-[#1f2420] auth-grid">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden border border-[#e4dccf] bg-[#fffdf8] shadow-[0_28px_90px_rgba(31,36,32,0.10)] lg:grid-cols-[1fr_0.95fr]">
          <section className="hidden border-r border-[#e4dccf] bg-[#fffaf0] p-10 lg:flex lg:flex-col lg:justify-between">
            <Link to="/" className="flex items-center gap-3 text-sm font-black uppercase">
              <BrandLockup dark />
            </Link>

            <div>
              <p className="text-xs font-black uppercase text-[#ff6b2c]">Acesso privado por empresa</p>
              <h1 className="mt-4 text-5xl font-black uppercase leading-tight">
                Entre na operação com segurança.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-[#526058]">
                Cada login acessa apenas as empresas e módulos liberados. Para administradores globais, o seletor lateral permite alternar entre clientes vinculados.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs font-black uppercase text-[#526058]">
              <span className="border border-[#e4dccf] bg-[#fffdf8] p-3">RLS</span>
              <span className="border border-[#e4dccf] bg-[#fffdf8] p-3">Audit Log</span>
              <span className="border border-[#e4dccf] bg-[#fffdf8] p-3">Convite</span>
            </div>
          </section>

          <section className="p-6 sm:p-10">
            <div className="mb-9 text-center lg:text-left">
              <Link to="/" className="inline-flex items-center gap-3 text-sm font-black uppercase lg:hidden">
                <BrandLockup dark />
              </Link>
              <h2 className="mt-8 text-3xl font-black uppercase text-[#1f2420]">Acesse a plataforma</h2>
              <p className="mt-2 text-sm text-[#657069]">Use seu e-mail e senha cadastrados.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Field label="E-mail" icon={<Mail size={16} />}>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                  placeholder="voce@empresa.com.br"
                  className="h-12 w-full border border-[#d8cfc0] bg-[#fffdf8] pl-10 pr-3 text-sm text-[#1f2420] outline-none transition placeholder:text-[#9b8f7d] focus:border-[#ff6b2c]"
                  required
                />
              </Field>

              <Field label="Senha" icon={<Lock size={16} />}>
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  placeholder="********"
                  className="h-12 w-full border border-[#d8cfc0] bg-[#fffdf8] pl-10 pr-11 text-sm text-[#1f2420] outline-none transition placeholder:text-[#9b8f7d] focus:border-[#ff6b2c]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#817568] hover:text-[#ff6b2c]"
                  aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </Field>

              <label className="flex items-center gap-2 text-xs text-[#526058]">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(event) => setRememberEmail(event.target.checked)}
                  className="h-4 w-4 accent-[#ff6b2c]"
                />
                Lembrar meu e-mail neste dispositivo
              </label>

              {error && (
                <div className="border border-red-300 bg-red-50 p-3 text-xs leading-5 text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 bg-[#ff6b2c] text-sm font-black uppercase text-white transition hover:bg-[#f25d1e] disabled:opacity-50"
              >
                {loading ? 'Entrando...' : <>Entrar <ArrowRight size={16} /></>}
              </button>
            </form>

            <div className="mt-6 border border-[#e4dccf] bg-[#fffaf0] p-5 text-center">
              <p className="text-sm font-black uppercase text-[#1f2420]">Ainda não tem conta?</p>
              <p className="mt-2 text-xs leading-5 text-[#657069]">
                O acesso é liberado por convite da empresa. Para iniciar uma nova conta, agende uma demonstração.
              </p>
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 border border-[#ff6b2c] px-5 py-2 text-xs font-black uppercase text-[#ff6b2c]">
                Agendar demo <ArrowRight size={13} />
              </a>
            </div>

            <div className="mt-6 text-center">
              <Link to="/" className="text-xs font-semibold text-[#817568] hover:text-[#ff6b2c]">Voltar para o site</Link>
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
