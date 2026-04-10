/**
 * MfaSetupPage — enrolment de TOTP (Google Authenticator, Authy, 1Password etc).
 *
 * Fluxo:
 *   1. supabase.auth.mfa.enroll() → retorna QR code SVG + secret
 *   2. Usuário escaneia no app autenticador
 *   3. Digita os 6 dígitos para verificar
 *   4. supabase.auth.mfa.challenge() + verify() confirmam o factor
 *
 * Após sucesso, marca profile.mfa_enrolled = true.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export function MfaSetupPage() {
  const navigate = useNavigate()
  const [qrSvg,    setQrSvg]    = useState<string | null>(null)
  const [secret,   setSecret]   = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code,     setCode]     = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data, error: e } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'ConstruData TOTP',
      })
      if (e) {
        setError(e.message)
      } else if (data) {
        setQrSvg(data.totp.qr_code)
        setSecret(data.totp.secret)
        setFactorId(data.id)
      }
      setLoading(false)
    })()
  }, [])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setError(null)
    setLoading(true)
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      })
      if (vErr) throw vErr

      // Marca o profile como mfa_enrolled = true
      const user = useAuth.getState().user
      if (user) {
        await supabase.from('profiles').update({ mfa_enrolled: true }).eq('id', user.id)
        await useAuth.getState().refreshProfile()
      }

      navigate('/app/minha-rotina')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(ellipse at center, #1a2540 0%, #0b1a30 100%)' }}>
      <div className="w-full max-w-md text-white">
        <div className="text-center mb-6">
          <ShieldCheck size={40} className="mx-auto mb-3 text-[#f97316]" />
          <h1 className="text-2xl font-bold mb-2">Ativar autenticação de dois fatores</h1>
          <p className="text-white/55 text-sm">
            Escaneie o QR code com seu app autenticador (Google Authenticator, Authy, 1Password)
          </p>
        </div>

        <div className="p-8" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }}>
          {loading && !qrSvg && <p className="text-center text-white/60">Carregando…</p>}

          {qrSvg && (
            <div className="mb-6">
              <div
                className="bg-white p-3 mx-auto w-fit"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              {secret && (
                <p className="text-[10px] text-white/40 text-center mt-3 font-mono break-all">
                  Ou digite manualmente: {secret}
                </p>
              )}
            </div>
          )}

          <form onSubmit={verify}>
            <label className="block text-[10px] font-semibold uppercase text-white/55 mb-2">
              Código de 6 dígitos
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
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
              {loading ? 'Verificando…' : 'Verificar e ativar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
