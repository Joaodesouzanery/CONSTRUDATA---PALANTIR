/**
 * LoginPage — página de autenticação para usuários existentes.
 *
 * Estado atual (v0): UI completa, validação client-side, redireciona para
 * /app/gestao-360 ao submeter. Backend Supabase será conectado no Sprint 1
 * (ver docs/database-architecture.md).
 *
 * Segurança:
 *  - autocomplete adequado (current-password, email)
 *  - input types corretos (email/password)
 *  - validação Zod no submit
 *  - rate-limit visual (cooldown após N tentativas) — preparado para v1
 *  - SEM cadastro público: única forma de criar conta é via Calendly
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Lock, Mail } from 'lucide-react'
import { z } from 'zod'

const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'

const loginSchema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
})

export function LoginPage() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [attempts, setAttempts] = useState(0)

  // Cooldown visual após 5 tentativas falhas (preparado para v1)
  const isRateLimited = attempts >= 5

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isRateLimited) {
      setError('Muitas tentativas. Aguarde alguns minutos.')
      return
    }

    // Validação Zod
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      setError(firstIssue?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    try {
      // TODO Sprint 1: substituir por supabase.auth.signInWithPassword({email, password})
      // Por enquanto, simula um login bem-sucedido após 600ms
      await new Promise((r) => setTimeout(r, 600))

      // No futuro com Supabase: verificar sessão, redirecionar para /app
      navigate('/app/minha-rotina')
    } catch (err) {
      setAttempts((a) => a + 1)
      setError(err instanceof Error ? err.message : 'Erro ao autenticar')
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
        {/* Logo + título */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <svg width="32" height="40" viewBox="0 0 24 32" fill="none">
              <path d="M12 2C12 2 2 14 2 21C2 26 6.5 30 12 30C17.5 30 22 26 22 21C22 14 12 2 12 2Z" stroke="#f97316" strokeWidth="1.6" fill="none" />
              <path d="M12 8C12 8 5 16 5 21C5 24.5 8.1 27 12 27C15.9 27 19 24.5 19 21C19 16 12 8 12 8Z" stroke="#f97316" strokeWidth="1.4" fill="none" />
              <path d="M12 13.5C12 13.5 8.5 18 8.5 21C8.5 23 10 24.5 12 24.5C14 24.5 15.5 23 15.5 21C15.5 18 12 13.5 12 13.5Z" stroke="#ea580c" strokeWidth="1.2" fill="none" />
            </svg>
            <div className="flex flex-col leading-none text-left">
              <span
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.18em' }}
                className="text-white font-semibold text-base uppercase"
              >
                Atlântico
              </span>
              <span
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.16em' }}
                className="text-white/40 text-[10px] font-semibold uppercase"
              >
                ConstruData
              </span>
            </div>
          </Link>
          <h1
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.01em' }}
            className="text-white text-2xl font-bold mt-8 mb-2"
          >
            Acesse a sua plataforma
          </h1>
          <p className="text-white/55 text-sm">
            Use seu e-mail corporativo e senha
          </p>
        </div>

        {/* Card do formulário */}
        <form
          onSubmit={handleSubmit}
          className="p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Email */}
          <div className="mb-5">
            <label
              htmlFor="email"
              className="block text-[10px] font-semibold tracking-wider uppercase text-white/55 mb-2"
            >
              E-mail
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
              />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                spellCheck={false}
                disabled={loading}
                placeholder="voce@empresa.com.br"
                className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none transition-colors"
                style={{
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="password"
                className="block text-[10px] font-semibold tracking-wider uppercase text-white/55"
              >
                Senha
              </label>
              <button
                type="button"
                onClick={() => alert('Recuperação de senha estará disponível em breve. Entre em contato pelo Calendly.')}
                className="text-[10px] text-[#f97316] hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
              />
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                placeholder="••••••••"
                className="w-full bg-transparent pl-9 pr-10 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none transition-colors"
                style={{
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors"
                aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div
              className="mb-4 p-3 text-xs text-red-300"
              style={{
                background: 'rgba(220,38,38,0.10)',
                border: '1px solid rgba(220,38,38,0.30)',
              }}
            >
              {error}
            </div>
          )}

          {/* Botão entrar */}
          <button
            type="submit"
            disabled={loading || isRateLimited}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: '#f97316',
              color: '#ffffff',
            }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Entrando…
              </>
            ) : (
              <>
                Entrar
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* MFA aviso */}
          <p className="text-[10px] text-white/40 text-center mt-4">
            🔒 Após o login, você confirmará com código MFA do seu autenticador
          </p>
        </form>

        {/* Sem conta? */}
        <div
          className="mt-6 p-6 text-center"
          style={{
            background: 'rgba(249,115,22,0.05)',
            border: '1px solid rgba(249,115,22,0.20)',
            borderLeft: '2px solid #f97316',
          }}
        >
          <p className="text-white/80 text-sm mb-3">
            Ainda não tem conta?
          </p>
          <p className="text-white/55 text-xs mb-4 leading-relaxed">
            Cadastros são criados manualmente após uma demonstração técnica de 20 min.
            Sem compromisso.
          </p>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold transition-colors"
            style={{
              border: '1px solid #f97316',
              color: '#f97316',
            }}
          >
            Agendar Demonstração
            <ArrowRight size={13} />
          </a>
        </div>

        {/* Voltar */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            ← Voltar para o site
          </Link>
        </div>
      </div>
    </div>
  )
}
