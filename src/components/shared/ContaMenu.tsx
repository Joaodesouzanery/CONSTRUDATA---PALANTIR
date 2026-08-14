import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { flushAllTenantStores, getPendingSummary } from '@/store/appModeStore'

/**
 * Menu da conta na barra lateral: quem está logado, trocar senha e sair.
 *
 * POR QUE ISTO EXISTE. O `signOut` já estava escrito e correto em `src/lib/auth.ts`, mas
 * **nenhuma tela o chamava** — não havia como sair da plataforma a não ser limpando o navegador.
 * Em computador compartilhado de escritório de obra, isso é a conta ficando aberta.
 *
 * O CUIDADO COM A FILA. Sair apaga o cache local da organização (`clearTenantScopedCaches`
 * remove as chaves `cdata-*`), e é ali que mora a fila de operações ainda não enviadas. Se a
 * pessoa estiver offline com trabalho pendente, sair sem avisar **destrói esse trabalho**. Então
 * a ordem aqui é: tentar enviar, conferir de novo, e só perguntar se ainda sobrou alguma coisa —
 * com o aviso dizendo o que realmente acontece, não um "tem certeza?" genérico.
 */
export function ContaMenu({ isOpen }: { isOpen: boolean }) {
  const navigate = useNavigate()
  const profile = useAuth((state) => state.profile)
  const user = useAuth((state) => state.user)
  const signOut = useAuth((state) => state.signOut)

  const [aberto, setAberto] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  const nome = profile?.full_name?.trim() || user?.email || 'Minha conta'
  const email = user?.email ?? ''

  async function sair() {
    if (saindo) return
    setSaindo(true)
    try {
      const antes = await getPendingSummary()
      if (antes.pending > 0) {
        // Tenta subir antes de perguntar: no caso comum (só demorou a sincronizar) não há
        // pergunta nenhuma, e a pessoa sai sem perder nada.
        try { await flushAllTenantStores() } catch { /* offline: cai no aviso abaixo */ }
        const depois = await getPendingSummary()
        if (depois.pending > 0) {
          const ok = window.confirm(
            `Ainda há ${depois.pending} alteração(ões) salva(s) só neste aparelho que não foram para a nuvem.\n\n`
            + 'Sair agora APAGA essas alterações — elas não voltam depois. Se você estiver sem internet, '
            + 'o certo é reconectar e esperar o aviso "Tudo salvo na nuvem" antes de sair.\n\n'
            + 'Sair mesmo assim?',
          )
          if (!ok) return
        }
      }
      setAberto(false)
      await signOut()
      navigate('/login', { replace: true })
    } finally {
      setSaindo(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setAberto((v) => !v)}
        title={email || 'Minha conta'}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={cn(
          'flex items-center gap-3 h-9 px-3 rounded-lg transition-colors w-full',
          aberto ? 'bg-[#333333] text-white' : 'text-[#e5e5e5] hover:bg-[#333333] hover:text-white',
        )}
      >
        <UserCircle size={18} className="shrink-0" strokeWidth={1.5} />
        {isOpen && <span className="text-xs font-normal whitespace-nowrap truncate">{nome}</span>}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-1 w-60 rounded-lg shadow-2xl z-50 overflow-hidden"
          style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="px-3 py-2.5">
            <p className="text-xs text-white truncate">{nome}</p>
            {email && email !== nome && <p className="text-[10px] text-[#9a9a9a] truncate">{email}</p>}
          </div>
          <div className="border-t border-[#333]" />
          <button
            role="menuitem"
            onClick={() => { setAberto(false); navigate('/conta/senha') }}
            className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#e5e5e5] hover:bg-[#333333] hover:text-white transition-colors w-full"
          >
            <KeyRound size={14} className="shrink-0" />
            Trocar senha
          </button>
          <button
            role="menuitem"
            onClick={() => void sair()}
            disabled={saindo}
            className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#e5e5e5] hover:bg-[#333333] hover:text-white transition-colors w-full disabled:opacity-60"
          >
            <LogOut size={14} className="shrink-0" />
            {saindo ? 'Saindo…' : 'Sair da conta'}
          </button>
        </div>
      )}
    </div>
  )
}
