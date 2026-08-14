import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { flushAllTenantStores, getPendingSummary } from '@/store/appModeStore'
import { inventarioTrabalhoSoLocal } from '@/lib/tenantCache'

/**
 * Menu da conta na barra lateral: quem está logado, trocar senha e sair.
 *
 * POR QUE ISTO EXISTE. O `signOut` já estava escrito e correto em `src/lib/auth.ts`, mas
 * **nenhuma tela o chamava** — não havia como sair da plataforma a não ser limpando o navegador.
 * Em computador compartilhado de escritório de obra, isso é a conta ficando aberta.
 *
 * O CUIDADO COM O QUE SE PERDE. Sair apaga o cache local da organização
 * (`clearTenantScopedCaches` remove as chaves `cdata-*`). Ali moram duas coisas diferentes:
 *
 * 1. A fila de operações ainda não enviadas dos stores sincronizados. Para essas, a ordem é
 *    tentar enviar, conferir de novo, e só perguntar se ainda sobrou.
 * 2. Trabalho que **nunca teve fila porque nunca teve servidor** — o RDO da Sabesp salvo
 *    localmente quando o envio falha, os critérios de medição criados à mão, o levantamento
 *    quantitativo personalizado. `getPendingSummary` não enxerga nada disso, então o aviso
 *    dispararia com a fila zerada e a pessoa perderia o trabalho sem saber. Quem lista é
 *    `inventarioTrabalhoSoLocal` (src/lib/tenantCache.ts).
 *
 * Nos dois casos o aviso diz o que de fato acontece, item por item — não um "tem certeza?".
 */
export function ContaMenu({ isOpen }: { isOpen: boolean }) {
  const navigate = useNavigate()
  const profile = useAuth((state) => state.profile)
  const user = useAuth((state) => state.user)
  const signOut = useAuth((state) => state.signOut)

  const [aberto, setAberto] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [posicao, setPosicao] = useState<{ left: number; bottom: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)

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

  /**
   * O menu é `fixed`, não `absolute`, e é por necessidade — não por gosto.
   *
   * A barra lateral tem `overflow-hidden` no `<aside>` e `overflow-x-hidden` no `<nav>`, e mede
   * 220px aberta e 64px recolhida. Um filho `absolute` de 240px é recortado nos dois estados —
   * some a metade direita com a barra aberta, e sobra um talo de 56px com ela recolhida. O
   * recorte corta a pintura E a área de clique, então "Sair da conta" ficava inalcançável
   * justamente no estado em que a barra passa a maior parte do tempo. Elemento `fixed` não é
   * recortado por `overflow` de ancestral (o bloco que o contém é a janela), e nenhum ancestral
   * aqui usa transform, que é o que quebraria essa regra.
   *
   * A posição é lida do botão na abertura; rolagem ou redimensionamento fecham o menu em vez de
   * recalcular, porque um menu de três itens não justifica um observador de posição vivo.
   */
  useEffect(() => {
    if (!aberto) return
    const medir = () => {
      const r = botaoRef.current?.getBoundingClientRect()
      if (r) setPosicao({ left: r.left, bottom: window.innerHeight - r.top + 4 })
    }
    medir()
    const fechar = () => setAberto(false)
    window.addEventListener('resize', fechar)
    window.addEventListener('scroll', fechar, true)
    return () => { window.removeEventListener('resize', fechar); window.removeEventListener('scroll', fechar, true) }
  }, [aberto])

  const nome = profile?.full_name?.trim() || user?.email || 'Minha conta'
  const email = user?.email ?? ''

  async function sair() {
    if (saindo) return
    setSaindo(true)
    try {
      const antes = await getPendingSummary()
      let pendentes = antes.pending
      if (pendentes > 0) {
        // Tenta subir antes de perguntar: no caso comum (só demorou a sincronizar) não há
        // pergunta nenhuma, e a pessoa sai sem perder nada.
        try { await flushAllTenantStores() } catch { /* offline: cai no aviso abaixo */ }
        pendentes = (await getPendingSummary()).pending
      }

      // A fila não conta tudo. Há trabalho que nunca teve fila porque nunca teve servidor —
      // e sair apaga esse trabalho junto. Sem isto, o caso mais grave (o RDO que o app
      // prometeu guardar no navegador) saía com a fila zerada e nenhum aviso na tela.
      const soLocal = inventarioTrabalhoSoLocal()

      if (pendentes > 0 || soLocal.total > 0) {
        const linhas = [
          pendentes > 0 && `• ${pendentes} alteração(ões) que não subiram para a nuvem`,
          ...soLocal.itens.map((i) => `• ${i}`),
        ].filter(Boolean)
        const ok = window.confirm(
          'Isto só existe neste aparelho:\n\n'
          + `${linhas.join('\n')}\n\n`
          + 'Sair APAGA tudo acima — não volta depois, nem entrando de novo. '
          + (pendentes > 0
            ? 'Se for falta de internet, reconecte e espere o aviso "Tudo salvo na nuvem" antes de sair.\n\n'
            : 'Exporte ou anote o que precisar antes de continuar.\n\n')
          + 'Sair mesmo assim?',
        )
        if (!ok) return
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
        ref={botaoRef}
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

      {aberto && posicao && (
        <div
          role="menu"
          className="fixed w-60 max-w-[calc(100vw-1rem)] rounded-lg shadow-2xl z-[100] overflow-hidden"
          style={{
            left: posicao.left,
            bottom: posicao.bottom,
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
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
