import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, QrCode, ShieldCheck, User } from 'lucide-react'
import { BrandLockup } from '@/components/shared/BrandLogo'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'
const HERO_BG = '/hero/hero1.webp'

/* Mesmos tokens visuais da landing (tema técnico escuro). */
const H_FONT = "font-['Inter_Tight']"
const M_FONT = "font-['IBM_Plex_Mono']"

type AuthMode = 'login' | 'invite' | 'mfa-challenge' | 'mfa-setup'

/** Cantoneiras de 8px nos 4 cantos de um card (motivo de frame técnico). */
function Corners() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 size-2 border-l border-t border-white/30" />
      <span aria-hidden className="pointer-events-none absolute right-0 top-0 size-2 border-r border-t border-white/30" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 size-2 border-b border-l border-white/30" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 size-2 border-b border-r border-white/30" />
    </>
  )
}

export function AuthPage({ mode = 'login' }: { mode?: AuthMode }) {
  const title = mode === 'invite'
    ? 'Aceitar convite'
    : mode === 'mfa-challenge'
      ? 'Verificacao em duas etapas'
      : mode === 'mfa-setup'
        ? 'Ativar autenticacao'
        : 'Acesse a plataforma'
  const subtitle = mode === 'invite'
    ? 'Entre na conta da empresa com o e-mail convidado.'
    : mode === 'mfa-challenge'
      ? 'Digite o codigo do seu app autenticador.'
      : mode === 'mfa-setup'
        ? 'Escaneie o QR code e confirme o codigo.'
        : 'Use seu e-mail e senha cadastrados.'

  return (
    <div className={`${H_FONT} min-h-screen bg-[#0b0d10] text-white antialiased`}>
      <div className="fixed inset-0">
        <img src={HERO_BG} alt="" width={1408} height={768} className="size-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,13,16,0.96)_0%,rgba(11,13,16,0.74)_48%,rgba(11,13,16,0.42)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,13,16,0.2)_0%,rgba(11,13,16,0.92)_100%)]" />
      </div>
      <header className="relative z-10 border-b border-white/10 bg-black/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-10">
          <Link to="/" className="flex items-center gap-3">
            <BrandLockup />
          </Link>
          <Link to="/" className={`${M_FONT} border border-white/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:border-[#f97316] hover:text-white`}>
            Voltar
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-10 px-4 py-10 md:px-10 lg:grid-cols-[0.95fr_0.8fr]">
        <section className="hidden max-w-2xl lg:block">
          <p className={`${M_FONT} text-[11px] font-medium uppercase tracking-[0.2em] text-white/55`}>
            <span className="mr-3 text-[#fb923c]">[ 01 ]</span>
            Acesso privado por empresa
          </p>
          <h1 className={`${H_FONT} mt-5 text-6xl font-medium leading-[0.98] tracking-[-0.03em] text-white`}>
            Entre na operacao com seguranca.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-white/70">
            A mesma base da landing agora protege login, convite e MFA em uma unica experiencia. Cada usuario entra apenas nas empresas e modulos liberados.
          </p>
          <div className={`${M_FONT} mt-8 grid grid-cols-3 gap-px text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70`}>
            {['RLS', 'Audit Log', 'MFA'].map((item) => (
              <span key={item} className="relative border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
                <Corners />
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="relative border border-white/10 bg-black/70 p-5 backdrop-blur-xl sm:p-8">
          <Corners />
          <div className="mb-8">
            <p className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.18em] text-[#fb923c]`}>{mode === 'login' ? 'ConstruData' : 'Seguranca'}</p>
            <h2 className={`${H_FONT} mt-3 text-3xl font-medium tracking-[-0.02em] text-white`}>{title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">{subtitle}</p>
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
        setError('Falha ao iniciar sessao. Tente novamente.')
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
        setError('Sua conta ainda nao esta vinculada a uma empresa. Use o link de convite enviado para o seu e-mail ou solicite acesso ao administrador.')
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
          <button type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/48 hover:text-[#f97316]" aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}>
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </Field>
        <label className="flex items-center gap-2 text-xs text-white/62">
          <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} className="h-4 w-4 accent-[#f97316]" />
          Lembrar meu e-mail neste dispositivo
        </label>
        <ErrorMessage error={error} />
        <SubmitButton loading={loading}>Entrar <ArrowRight size={16} /></SubmitButton>
      </form>
      <div className="mt-6 border border-white/10 bg-white/[0.03] p-5 text-center">
        <p className={`${M_FONT} text-xs font-semibold uppercase tracking-[0.14em] text-white`}>Ainda nao tem conta?</p>
        <p className="mt-2 text-xs leading-5 text-white/55">O acesso e liberado por convite da empresa. Para iniciar uma nova conta, agende uma demonstracao.</p>
        <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className={`${M_FONT} mt-4 inline-flex items-center gap-2 border border-[#f97316] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#fb923c] transition hover:bg-[#f97316] hover:text-white`}>
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
      setError('Convite invalido ou sem token.')
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
          ['login', 'Ja tenho senha'],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setInviteMode(value as 'signup' | 'login')} className={`${M_FONT} h-11 border text-[10px] font-semibold uppercase tracking-[0.12em] transition ${inviteMode === value ? 'border-[#f97316] bg-[#f97316] text-white' : 'border-white/10 bg-white/[0.04] text-white/60'}`}>
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
      <div className="text-center"><Link to="/login" className="text-xs font-semibold text-white/54 hover:text-[#f97316]">Voltar para login</Link></div>
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
      setError(err instanceof Error ? err.message : 'Codigo invalido.')
    } finally {
      setLoading(false)
    }
  }

  if (!factorId) {
    return (
      <div className="space-y-4">
        <ErrorMessage error="Sessao MFA nao encontrada. Entre novamente." />
        <Link to="/login" className={`${M_FONT} flex h-12 w-full items-center justify-center bg-[#f97316] text-xs font-semibold uppercase tracking-[0.14em] text-white`}>Voltar ao login</Link>
      </div>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-5">
      <Field icon={<KeyRound size={16} />} label="Codigo de 6 digitos">
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
      setError(err instanceof Error ? err.message : 'Codigo invalido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {loading && !qrSvg && <p className="text-center text-sm text-white/62">Carregando autenticador...</p>}
      {qrSvg && (
        <div className="border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="mx-auto w-fit bg-white p-3" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          {secret && <p className="mt-3 break-all font-mono text-[10px] text-white/44">Ou digite manualmente: {secret}</p>}
        </div>
      )}
      <form onSubmit={verify} className="space-y-5">
        <Field icon={<QrCode size={16} />} label="Codigo de 6 digitos">
          <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} type="text" inputMode="numeric" maxLength={6} placeholder="000000" className={`${inputClass} text-center tracking-[0.35em]`} required />
        </Field>
        <ErrorMessage error={error} />
        <SubmitButton loading={loading || code.length !== 6}>Verificar e ativar <ShieldCheck size={16} /></SubmitButton>
      </form>
    </div>
  )
}

const inputClass = 'h-12 w-full rounded-none border border-white/15 bg-white/5 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#f97316] disabled:opacity-50'

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div>
      <label className={`${M_FONT} mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50`}>{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#fb923c]">{icon}</div>
        {children}
      </div>
    </div>
  )
}

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null
  return <div className="border border-red-400/40 bg-red-500/10 p-3 text-xs leading-5 text-red-200">{error}</div>
}

function SubmitButton({ children, loading }: { children: ReactNode; loading: boolean }) {
  return (
    <button type="submit" disabled={loading} className={`${M_FONT} flex h-12 w-full items-center justify-center gap-2 bg-[#f97316] text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#ea580c] disabled:opacity-50`}>
      {loading ? 'Processando...' : children}
    </button>
  )
}
