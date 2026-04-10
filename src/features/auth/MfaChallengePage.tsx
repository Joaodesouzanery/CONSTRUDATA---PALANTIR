/**
 * MfaChallengePage — challenge de TOTP no fluxo de login.
 * Usuário já fez signInWithPassword; agora precisa digitar o código TOTP.
 */
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export function MfaChallengePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const factorId = (location.state as { factorId?: string } | null)?.factorId

  const [code,    setCode]    = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!factorId) {
    navigate('/login', { replace: true })
    return null
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: factorId! })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: factorId!,
        challengeId: challenge.id,
        code,
      })
      if (vErr) throw vErr

      await useAuth.getState().refreshProfile()
      navigate('/app/minha-rotina')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at center, #1a2540 0%, #0b1a30 100%)' }}>
      <div className="w-full max-w-md text-white">
        <div className="text-center mb-6">
          <ShieldCheck size={40} className="mx-auto mb-3 text-[#f97316]" />
          <h1 className="text-2xl font-bold mb-2">Verificação em duas etapas</h1>
          <p className="text-white/55 text-sm">Digite o código de 6 dígitos do seu app autenticador</p>
        </div>

        <form onSubmit={verify} className="p-8"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
            className="w-full bg-transparent px-3 py-3 text-center text-lg tracking-[0.4em] text-white focus:outline-none mb-4"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            required
          />
          {error && (
            <div className="mb-4 p-3 text-xs text-red-300"
              style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.30)' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-3 text-sm font-semibold disabled:opacity-50"
            style={{ background: '#f97316', color: '#fff' }}
          >
            {loading ? 'Verificando…' : 'Confirmar'}
          </button>
        </form>
      </div>
    </div>
  )
}
