import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
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
    <div className="relative min-h-screen overflow-hidden bg-[#0d0d0d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_18%,rgba(249,115,22,0.18),transparent_30%),linear-gradient(135deg,#111111_0%,#171717_48%,#0a0a0a_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.18)_0%,rgba(10,10,10,0.62)_50%,rgba(10,10,10,0.2)_100%)]" />
      <div className="pointer-events-none absolute right-[5%] top-[12%] hidden h-72 w-72 rounded-full border border-white/18 lg:block" />
      <div className="pointer-events-none absolute right-[12%] top-[22%] hidden h-[28rem] w-[28rem] rounded-full border border-white/10 lg:block" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-end gap-10 px-5 py-10 md:px-10 lg:grid-cols-[0.56fr_0.44fr] lg:py-16">
        <section className="hidden max-w-2xl pb-8 lg:block">
          <div className="inline-flex border border-white/18 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#f97316] backdrop-blur-md">
            Acesso seguro por empresa
          </div>
          <h1 className="mt-8 font-['Space_Grotesk'] text-6xl font-medium leading-[0.95] text-white xl:text-7xl">
            ConstruData
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">
            Entre na sua operação global, alterne empresas, acesse ambientes de homologação e acompanhe campo,
            planejamento, medição e suprimentos em uma única base operacional.
          </p>
          <div className="mt-8 h-[2px] w-14 bg-[#f97316]" />
          <div className="mt-9 grid max-w-md gap-3">
            {[
              ['Conta global', 'Empresas, demos e homologações no mesmo acesso'],
              ['RLS + auditoria', 'Dados protegidos por organização e perfil'],
              ['Origem rastreável', 'Cada lançamento preserva contexto operacional'],
            ].map(([title, copy]) => (
              <div key={title} className="border border-white/10 bg-[#1a1a1a]/82 p-4 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-mono text-[10px] font-black uppercase text-[#f97316]">{title}</p>
                  <span className="h-2 w-2 rounded-full bg-[#f97316] shadow-[0_0_18px_rgba(249,115,22,0.85)]" />
                </div>
                <p className="mt-3 text-sm text-white/70">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-lg border border-white/12 bg-[#fffaf0]/95 p-6 text-[#10251c] shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8 lg:ml-auto">
          <div className="mb-8">
            <div className="flex size-12 items-center justify-center border border-[#10251c]/14 bg-[#f5f0e5] text-[#f97316]">
              <ShieldCheck size={24} />
            </div>
            <h2 className="mt-6 font-['Space_Grotesk'] text-4xl font-medium tracking-tight text-[#10251c]">
              Acesse a plataforma
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#10251c]/70">Use seu e-mail e senha cadastrados.</p>
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
                className="h-12 w-full rounded-none border border-[#10251c]/18 bg-[#fffaf0] pl-10 pr-3 text-sm text-[#10251c] outline-none transition placeholder:text-[#10251c]/30 focus:border-[#f97316]"
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
                className="h-12 w-full rounded-none border border-[#10251c]/18 bg-[#fffaf0] pl-10 pr-11 text-sm text-[#10251c] outline-none transition placeholder:text-[#10251c]/30 focus:border-[#f97316]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#10251c]/45 transition hover:text-[#f97316]"
                aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </Field>

            <label className="flex items-center gap-2 text-xs text-[#10251c]/64">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(event) => setRememberEmail(event.target.checked)}
                className="h-4 w-4 accent-[#f97316]"
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
              className="flex h-12 w-full items-center justify-center gap-3 bg-[#f97316] text-sm font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#ea580c] disabled:opacity-50"
            >
              {loading ? 'Entrando...' : <>Entrar <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="mt-6 border border-[#10251c]/14 bg-[#f5f0e5] p-5 text-center">
            <p className="text-sm font-black uppercase text-[#10251c]">Ainda não tem conta?</p>
            <p className="mt-2 text-xs leading-5 text-[#10251c]/64">
              O acesso é liberado por convite da empresa. Para iniciar uma nova conta, agende uma demonstração.
            </p>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 border border-[#f97316] px-5 py-2 text-xs font-black uppercase text-[#f97316] transition hover:bg-[#f97316] hover:text-white"
            >
              Agendar demo <ArrowRight size={13} />
            </a>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-xs font-semibold text-[#10251c]/55 transition hover:text-[#f97316]">
              Voltar para o site
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-[#10251c]/55">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#f97316]">
          {icon}
        </div>
        {children}
      </div>
    </div>
  )
}
