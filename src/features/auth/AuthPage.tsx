import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, QrCode, ShieldCheck, User } from 'lucide-react'
import { BrandLockup } from '@/components/shared/BrandLogo'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'

/* Mesmos tokens visuais da landing (tema técnico claro). */
const H_FONT = 'font-display'
const M_FONT = 'font-label'

type AuthMode = 'login' | 'invite' | 'mfa-challenge' | 'mfa-setup'

/** Cantoneiras de 8px nos 4 cantos de um card (motivo de frame técnico). */
function Corners() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 size-2 border-l border-t border-black/30" />
      <span aria-hidden className="pointer-events-none absolute right-0 top-0 size-2 border-r border-t border-black/30" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 size-2 border-b border-l border-black/30" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 size-2 border-b border-r border-black/30" />
    </>
  )
}

export function AuthPage({ mode = 'login' }: { mode?: AuthMode }) {
  const title = mode === 'invite'
    ? 'Aceitar convite'
    : mode === 'mfa-challenge'
      ? 'Verificação em duas etapas'
      : mode === 'mfa-setup'
        ? 'Ativar autenticação'
        : 'Acesse a plataforma'
  const subtitle = mode === 'invite'
    ? 'Entre na conta da empresa com o e-mail convidado.'
    : mode === 'mfa-challenge'
      ? 'Digite o código do seu app autenticador.'
      : mode === 'mfa-setup'
        ? 'Escaneie o QR code e confirme o código.'
        : 'Use seu e-mail e senha cadastrados.'

  return (
    <div className={`${H_FONT} min-h-screen bg-[#f4f4f2] text-[#0a0a0a] antialiased`}>
      <header className="relative z-10 border-b border-black/10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-10">
          <Link to="/" className="flex items-center gap-3">
            <BrandLockup dark />
          </Link>
          <Link to="/" className={`${M_FONT} border border-black/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/60 transition hover:border-[#f97316] hover:text-[#0a0a0a]`}>
            Voltar
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-10 px-4 py-10 md:px-10 lg:grid-cols-[0.95fr_0.8fr]">
        <section className="hidden max-w-2xl lg:block">
          <p className={`${M_FONT} text-[11px] font-medium uppercase tracking-[0.2em] text-black/50`}>
            <span className="mr-3 text-[#c2410c]">[ 01 ]</span>
            Acesso privado por empresa
          </p>
          <h1 className={`${H_FONT} mt-5 text-6xl font-medium leading-[0.98] tracking-[-0.03em] text-[#0a0a0a]`}>
            Entre na operação com segurança.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-black/60">
            A mesma base da landing agora protege login, convite e MFA em uma única experiência. Cada usuário entra apenas nas empresas e módulos liberados.
          </p>
          <div className={`${M_FONT} mt-8 grid grid-cols-3 gap-px text-[11px] font-semibold uppercase tracking-[0.14em] text-black/60`}>
            {['RLS', 'Audit Log', 'MFA'].map((item) => (
              <span key={item} className="relative border border-black/10 bg-white p-4">
                <Corners />
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="relative border border-black/10 bg-white p-5 sm:p-8">
          <Corners />
          <div className="mb-8">
            <p className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c2410c]`}>{mode === 'login' ? 'ConstruData' : 'Segurança'}</p>
            <h2 className={`${H_FONT} mt-3 text-3xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>{title}</h2>
            <p className="mt-2 text-sm leading-6 text-black/55">{subtitle}</p>
          </div>
          {mode === 'invite' ? <InviteForm /> : mode === 'mfa-challenge' ? <MfaChallengeForm /> : mode === 'mfa-setup' ? <MfaSetupForm /> : <LoginForm />}
        </section>
      </main>
    </div>
  )
}

function LoginForm() {
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
      // localStorage can be unavailable in private mode.
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) {
      setError('Preencha e-mail e senha.')
      return
    }

    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
      if (authError) {
        setError(authError.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : `Erro: ${authError.message}`)
        return
      }
      if (!data.session || !data.user) {
        setError('Falha ao iniciar sessão. Tente novamente.')
        return
      }

      useAuth.getState().setSession(data.session)
      try {
        window.localStorage.removeItem('cdata-public-preview')
        if (window.localStorage.getItem('cdata-demo') === 'true') window.localStorage.setItem('cdata-demo', 'false')
        if (rememberEmail) window.localStorage.setItem('cdata-login-email', trimmedEmail)
        else window.localStorage.removeItem('cdata-login-email')
      } catch {
        // Keep login flowing even when storage is blocked.
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
        // MFA is optional.
      }

      await useAuth.getState().refreshProfile()
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(from?.startsWith('/app') ? from : '/app/minha-rotina')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="E-mail" icon={<Mail size={16} />}>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" disabled={loading} placeholder="voce@empresa.com.br" className={inputClass} required />
        </Field>
        <Field label="Senha" icon={<Lock size={16} />}>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPwd ? 'text' : 'password'} autoComplete="current-password" disabled={loading} placeholder="********" className={`${inputClass} pr-11`} required />
          <button type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/45 hover:text-[#ea580c]" aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}>
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </Field>
        <label className="flex items-center gap-2 text-xs text-black/60">
          <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} className="h-4 w-4 accent-[#f97316]" />
          Lembrar meu e-mail neste dispositivo
        </label>
        <ErrorMessage error={error} />
        <SubmitButton loading={loading}>Entrar <ArrowRight size={16} /></SubmitButton>
      </form>
      <div className="mt-6 border border-black/10 bg-[#f4f4f2] p-5 text-center">
        <p className={`${M_FONT} text-xs font-semibold uppercase tracking-[0.14em] text-[#0a0a0a]`}>Ainda não tem conta?</p>
        <p className="mt-2 text-xs leading-5 text-black/55">O acesso é liberado por convite da empresa. Para iniciar uma nova conta, agende uma demonstração.</p>
        <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className={`${M_FONT} mt-4 inline-flex items-center gap-2 border border-[#f97316] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c2410c] transition hover:bg-[#f97316] hover:text-white`}>
          Agendar demo <ArrowRight size={13} />
        </a>
      </div>
    </>
  )
}

function InviteForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteMode, setInviteMode] = useState<'signup' | 'login'>('signup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
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
      const authResponse = inviteMode === 'signup'
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials)
      if (authResponse.error) throw authResponse.error
      if (!authResponse.data.session) {
        setError('Conta criada. Confirme seu e-mail e volte para aceitar o convite.')
        return
      }

      useAuth.getState().setSession(authResponse.data.session)
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {[
          ['signup', 'Criar acesso'],
          ['login', 'Já tenho senha'],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setInviteMode(value as 'signup' | 'login')} className={`${M_FONT} h-11 border text-[10px] font-semibold uppercase tracking-[0.12em] transition ${inviteMode === value ? 'border-[#f97316] bg-[#f97316] text-white' : 'border-black/15 bg-[#f4f4f2] text-black/55'}`}>
            {label}
          </button>
        ))}
      </div>
      <Field icon={<User size={16} />} label="Nome">
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={loading || inviteMode === 'login'} placeholder="Seu nome" className={inputClass} />
      </Field>
      <Field icon={<Mail size={16} />} label="E-mail convidado">
        <input value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} type="email" placeholder="voce@empresa.com.br" className={inputClass} required />
      </Field>
      <Field icon={<Lock size={16} />} label="Senha">
        <input value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} type="password" placeholder="************" className={inputClass} required />
      </Field>
      <ErrorMessage error={error} />
      <SubmitButton loading={loading}>Aceitar convite <ArrowRight size={16} /></SubmitButton>
      <div className="text-center"><Link to="/login" className="text-xs font-semibold text-black/50 hover:text-[#ea580c]">Voltar para login</Link></div>
    </form>
  )
}

function MfaChallengeForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const factorId = (location.state as { factorId?: string } | null)?.factorId
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function verify(event: FormEvent) {
    event.preventDefault()
    if (!factorId) return
    setError(null)
    setLoading(true)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
      if (verifyError) throw verifyError
      const { data: sessionData } = await supabase.auth.getSession()
      useAuth.getState().setSession(sessionData.session)
      await useAuth.getState().refreshProfile()
      navigate('/app/minha-rotina')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido.')
    } finally {
      setLoading(false)
    }
  }

  if (!factorId) {
    return (
      <div className="space-y-4">
        <ErrorMessage error="Sessão MFA não encontrada. Entre novamente." />
        <Link to="/login" className={`${M_FONT} flex h-12 w-full items-center justify-center bg-[#f97316] text-xs font-semibold uppercase tracking-[0.14em] text-white`}>Voltar ao login</Link>
      </div>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-5">
      <Field icon={<KeyRound size={16} />} label="Código de 6 dígitos">
        <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} type="text" inputMode="numeric" maxLength={6} autoFocus placeholder="000000" className={`${inputClass} text-center tracking-[0.35em]`} required />
      </Field>
      <ErrorMessage error={error} />
      <SubmitButton loading={loading || code.length !== 6}>Confirmar <ShieldCheck size={16} /></SubmitButton>
    </form>
  )
}

function MfaSetupForm() {
  const navigate = useNavigate()
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'ConstruData TOTP' })
      if (!active) return
      if (enrollError) setError(enrollError.message)
      else if (data) {
        setQrSvg(data.totp.qr_code)
        setSecret(data.totp.secret)
        setFactorId(data.id)
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  async function verify(event: FormEvent) {
    event.preventDefault()
    if (!factorId) return
    setError(null)
    setLoading(true)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
      if (verifyError) throw verifyError
      const user = useAuth.getState().user
      if (user) {
        await supabase.from('profiles').update({ mfa_enrolled: true }).eq('id', user.id)
        await useAuth.getState().refreshProfile()
      }
      navigate('/app/minha-rotina')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {loading && !qrSvg && <p className="text-center text-sm text-black/55">Carregando autenticador...</p>}
      {qrSvg && (
        <div className="border border-black/10 bg-[#f4f4f2] p-4 text-center">
          <div className="mx-auto w-fit bg-white p-3" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          {secret && <p className="mt-3 break-all font-mono text-[10px] text-black/45">Ou digite manualmente: {secret}</p>}
        </div>
      )}
      <form onSubmit={verify} className="space-y-5">
        <Field icon={<QrCode size={16} />} label="Código de 6 dígitos">
          <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} type="text" inputMode="numeric" maxLength={6} placeholder="000000" className={`${inputClass} text-center tracking-[0.35em]`} required />
        </Field>
        <ErrorMessage error={error} />
        <SubmitButton loading={loading || code.length !== 6}>Verificar e ativar <ShieldCheck size={16} /></SubmitButton>
      </form>
    </div>
  )
}

const inputClass = 'h-12 w-full rounded-none border border-black/15 bg-white pl-10 pr-3 text-sm text-[#0a0a0a] outline-none transition placeholder:text-black/30 focus:border-[#f97316] disabled:opacity-50'

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div>
      <label className={`${M_FONT} mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-black/50`}>{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#ea580c]">{icon}</div>
        {children}
      </div>
    </div>
  )
}

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null
  return <div className="border border-red-500/35 bg-red-500/[0.06] p-3 text-xs leading-5 text-red-600">{error}</div>
}

function SubmitButton({ children, loading }: { children: ReactNode; loading: boolean }) {
  return (
    <button type="submit" disabled={loading} className={`${M_FONT} flex h-12 w-full items-center justify-center gap-2 bg-[#f97316] text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#ea580c] disabled:opacity-50`}>
      {loading ? 'Processando...' : children}
    </button>
  )
}
