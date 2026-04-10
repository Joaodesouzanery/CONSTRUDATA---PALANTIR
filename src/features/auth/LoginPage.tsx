/**
 * LoginPage — autenticação via Supabase Auth (email + senha).
 *
 * Fluxo:
 *   1. signInWithPassword
 *   2. Verifica se profile existe → se não, chama auto_provision_profile RPC
 *   3. Verifica MFA → se tem TOTP verificado, redireciona para /login/mfa
 *   4. refreshProfile → redirect para /app/minha-rotina
 *
 * Diagnóstico: erros aparecem na UI E no console (F12) para facilitar debug.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Lock, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'

export function LoginPage() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) {
      setError('Preencha e-mail e senha.')
      return
    }
    if (password.length < 6) {
      setError('Senha deve ter ao menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      // ── Passo 1: autenticar ─────────────────────────────────────────
      console.info('[login] tentando login para', trimmedEmail)

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email:    trimmedEmail,
        password,
      })

      if (authError) {
        console.error('[login] erro auth:', authError.message, authError.status)
        if (authError.message.includes('Invalid login')) {
          setError('E-mail ou senha incorretos.')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('E-mail não confirmado. Peça ao administrador para confirmar sua conta.')
        } else {
          setError(`Erro: ${authError.message}`)
        }
        return
      }

      if (!data.session || !data.user) {
        setError('Falha ao iniciar sessão. Tente novamente.')
        return
      }

      console.info('[login] auth OK. user:', data.user.id)

      // ── Passo 2: garantir que profile existe ────────────────────────
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!profileCheck) {
        console.info('[login] profile não encontrado, tentando auto_provision...')
        const { error: provisionErr } = await supabase.rpc('auto_provision_profile')
        if (provisionErr) {
          console.error('[login] auto_provision falhou:', provisionErr.message)
          await supabase.auth.signOut()
          setError('Sua conta não tem perfil. Entre em contato com o administrador.')
          return
        }
        console.info('[login] profile provisionado com sucesso')
      } else {
        console.info('[login] profile encontrado. role:', profileCheck.role)
      }

      // ── Passo 3: checar MFA ─────────────────────────────────────────
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totp = factors?.totp?.[0]
        if (totp && totp.status === 'verified') {
          console.info('[login] MFA TOTP ativo, redirecionando para challenge')
          navigate('/login/mfa', { state: { factorId: totp.id } })
          return
        }
      } catch {
        // MFA não configurado — prossegue sem
      }

      // ── Passo 4: carregar profile e entrar ──────────────────────────
      await useAuth.getState().refreshProfile()
      console.info('[login] sucesso! redirecionando...')
      navigate('/app/minha-rotina')

    } catch (err) {
      console.error('[login] erro inesperado:', err)
      setError(err instanceof Error ? err.message : 'Erro inesperado ao autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: 'radial-gradient(ellipse at center, #1a2540 0%, #0b1a30 100%)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <svg width="32" height="40" viewBox="0 0 24 32" fill="none">
              <path d="M12 2C12 2 2 14 2 21C2 26 6.5 30 12 30C17.5 30 22 26 22 21C22 14 12 2 12 2Z" stroke="#f97316" strokeWidth="1.6" fill="none" />
              <path d="M12 8C12 8 5 16 5 21C5 24.5 8.1 27 12 27C15.9 27 19 24.5 19 21C19 16 12 8 12 8Z" stroke="#f97316" strokeWidth="1.4" fill="none" />
              <path d="M12 13.5C12 13.5 8.5 18 8.5 21C8.5 23 10 24.5 12 24.5C14 24.5 15.5 23 15.5 21C15.5 18 12 13.5 12 13.5Z" stroke="#ea580c" strokeWidth="1.2" fill="none" />
            </svg>
            <div className="flex flex-col leading-none text-left">
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.18em' }} className="text-white font-semibold text-base uppercase">
                Atlântico
              </span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.16em' }} className="text-white/40 text-[10px] font-semibold uppercase">
                ConstruData
              </span>
            </div>
          </Link>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white text-2xl font-bold mt-8 mb-2">
            Acesse a sua plataforma
          </h1>
          <p className="text-white/55 text-sm">Use seu e-mail e senha</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-8"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          {/* Email */}
          <div className="mb-5">
            <label htmlFor="email" className="block text-[10px] font-semibold tracking-wider uppercase text-white/55 mb-2">
              E-mail
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                placeholder="voce@empresa.com.br"
                className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-5">
            <label htmlFor="password" className="block text-[10px] font-semibold tracking-wider uppercase text-white/55 mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                placeholder="••••••••"
                className="w-full bg-transparent pl-9 pr-10 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 text-xs text-red-300" style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.30)' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: '#f97316', color: '#fff' }}
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Entrando...</>
            ) : (
              <>Entrar <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        {/* CTA */}
        <div className="mt-6 p-6 text-center" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.20)', borderLeft: '2px solid #f97316' }}>
          <p className="text-white/80 text-sm mb-3">Ainda não tem conta?</p>
          <p className="text-white/55 text-xs mb-4">Cadastros são criados após demonstração de 20 min.</p>
          <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold" style={{ border: '1px solid #f97316', color: '#f97316' }}>
            Agendar Demonstração <ArrowRight size={13} />
          </a>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-white/40 hover:text-white/70 text-xs">← Voltar para o site</Link>
        </div>
      </div>
    </div>
  )
}
