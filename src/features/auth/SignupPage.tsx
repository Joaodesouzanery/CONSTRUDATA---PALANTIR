/**
 * SignupPage — cadastro de nova organização + owner.
 *
 * Fluxo:
 *   1. supabase.auth.signUp(email, password)  → cria auth.users
 *   2. supabase.rpc('signup_with_org', {...}) → cria organization + profile owner
 *   3. Redireciona para /app/minha-rotina
 *
 * Notas de segurança:
 *   - O e-mail precisa ser confirmado se o projeto Supabase exigir (recomendado)
 *   - Senha mínima de 12 chars (alinhado com a configuração do projeto)
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Mail, Lock, User } from 'lucide-react'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const schema = z.object({
  orgName:  z.string().min(2, 'Nome da empresa muito curto'),
  fullName: z.string().min(2, 'Informe seu nome completo'),
  email:    z.string().email('E-mail inválido'),
  password: z.string()
    .min(12, 'Senha deve ter ao menos 12 caracteres')
    .regex(/[A-Z]/, 'Inclua ao menos uma letra maiúscula')
    .regex(/[a-z]/, 'Inclua ao menos uma letra minúscula')
    .regex(/[0-9]/, 'Inclua ao menos um número')
    .regex(/[^a-zA-Z0-9]/, 'Inclua ao menos um símbolo'),
})

export function SignupPage() {
  const navigate = useNavigate()
  const [orgName,  setOrgName]  = useState('')
  const [fullName, setFullName] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const parsed = schema.safeParse({ orgName, fullName, email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email:    parsed.data.email,
        password: parsed.data.password,
      })
      if (signUpError) throw signUpError

      // Se o projeto exigir confirmação de email, session vem null
      if (!signUpData.session) {
        setSuccessMsg(
          'Cadastro criado! Verifique seu e-mail para confirmar a conta antes de fazer login.',
        )
        return
      }

      // Cria a organização + profile owner
      const { error: rpcError } = await supabase.rpc('signup_with_org', {
        p_org_name:  parsed.data.orgName,
        p_full_name: parsed.data.fullName,
      })
      if (rpcError) throw rpcError

      await useAuth.getState().refreshProfile()
      navigate('/app/minha-rotina')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background: 'radial-gradient(ellipse at center, #1a2540 0%, #0b1a30 100%)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            className="text-white text-2xl font-bold mb-2"
          >
            Criar nova organização
          </h1>
          <p className="text-white/55 text-sm">
            Você será o <strong>owner</strong> da conta
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Field icon={<Building2 size={16} />} label="Empresa">
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={loading}
              placeholder="Construtora Atlântico"
              className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              required
            />
          </Field>

          <Field icon={<User size={16} />} label="Seu nome">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              placeholder="João da Silva"
              autoComplete="name"
              className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              required
            />
          </Field>

          <Field icon={<Mail size={16} />} label="E-mail corporativo">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="voce@empresa.com.br"
              autoComplete="email"
              className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              required
            />
          </Field>

          <Field icon={<Lock size={16} />} label="Senha (12+ chars, mista)">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••••••"
              autoComplete="new-password"
              minLength={12}
              className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              required
            />
          </Field>

          {error && (
            <div
              className="mb-4 p-3 text-xs text-red-300"
              style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.30)' }}
            >
              {error}
            </div>
          )}
          {successMsg && (
            <div
              className="mb-4 p-3 text-xs text-emerald-300"
              style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)' }}
            >
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: '#f97316', color: '#ffffff' }}
          >
            {loading ? 'Criando…' : (
              <>
                Criar conta
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="text-[10px] text-white/40 text-center mt-4">
            🔒 Após criar a conta, vamos pedir para você ativar o MFA (TOTP)
          </p>
        </form>

        <div className="text-center mt-6">
          <Link to="/login" className="text-white/55 hover:text-white text-xs">
            Já tem conta? Fazer login
          </Link>
        </div>
      </div>
    </div>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-[10px] font-semibold tracking-wider uppercase text-white/55 mb-2">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
          {icon}
        </div>
        {children}
      </div>
    </div>
  )
}
