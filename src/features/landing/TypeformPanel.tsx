/**
 * TypeformPanel — o formulário de qualificação da seção final da landing.
 *
 * Mesma regra do VideoShowcase: **nada da Typeform carrega antes do clique**. Não há iframe
 * no DOM enquanto ninguém abriu, então quem só passa pela página não baixa nada e não recebe
 * cookie de terceiro nenhum. Isso não é só peso — é o que mantém verdadeira a seção de cookies
 * da política de privacidade para a maioria dos visitantes.
 *
 * `aberto = false` é o estado do servidor E o da primeira renderização do cliente (a landing é
 * pré-renderizada por src/prerender.tsx e hidratada inteira por src/main.tsx), então as duas
 * árvores nascem idênticas e não há divergência de hidratação.
 *
 * Requisito de infraestrutura: `frame-src https://*.typeform.com` na CSP do vercel.json. Sem
 * isso o navegador recusa o iframe — o estado de erro abaixo é o que o usuário veria.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Corners } from './Corners'
import { CtaBox } from './CtaBox'

const M_FONT = 'font-label'
const H_FONT = 'font-display'

const TYPEFORM_ID = 'nvIZCyYA'

/** Duração declarada na fachada. Se o formulário mudar de tamanho, atualize aqui. */
export const TYPEFORM_DURACAO = 'menos de um minuto'

/** Âncora usada pelos CTAs espalhados na página. Mora em landingLinks para o CtaBox poder
 *  usá-la sem criar ciclo de import; re-exportada aqui por conveniência de quem já importava. */
export { TYPEFORM_ANCHOR } from './landingLinks'

/**
 * Monta a URL com a origem do clique. `origem` chega na Typeform como campo oculto — mas só
 * vira dado se existir um campo oculto com esse nome no formulário. Se não existir, o
 * parâmetro é ignorado sem quebrar nada.
 */
function typeformUrl(origem: string): string {
  return `https://form.typeform.com/to/${TYPEFORM_ID}?typeform-medium=embed&origem=${encodeURIComponent(origem)}`
}

export function TypeformPanel({ origem = 'fechamento' }: { origem?: string }) {
  const [aberto, setAberto] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const abrir = useCallback(() => setAberto(true), [])
  const fechar = useCallback(() => setAberto(false), [])

  // O botão que tinha o foco some no mesmo commit; sem isto o foco cai no <body> e quem navega
  // por teclado perde o lugar. Fica num efeito preso a `aberto`, não no ref: uma arrow inline
  // como ref muda de identidade a cada render, e o React a redispara em TODO commit — o foco
  // seria roubado de volta para o iframe enquanto a pessoa faz outra coisa na página.
  useEffect(() => {
    if (aberto) iframeRef.current?.focus()
  }, [aberto])

  return (
    // A fachada tem altura natural (travá-la deixaria um vazio enorme no meio do card); só o
    // estado aberto ganha altura, porque um iframe precisa de uma. Expandir no clique é o que
    // o visitante espera — a regra de não deslocar layout vale para mudança que ninguém pediu.
    // Proporção 16:9 não serviria: em 390px daria 219px de altura, inutilizável para formulário.
    // Aberto, marca `data-aberto` — a grade da seção final usa isso para virar uma coluna só,
    // dando largura inteira ao formulário (em meia largura fica apertado) sem deixar o card do
    // Calendly órfão numa meia-coluna vazia.
    <div
      data-aberto={aberto ? '' : undefined}
      className={`relative flex flex-col border border-black/10 bg-white p-6 sm:p-8 ${aberto ? 'h-[600px] sm:h-[660px]' : ''}`}
    >
      <Corners />
      {aberto ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45`}>
              Qualificação
            </p>
            <button
              type="button"
              onClick={fechar}
              className={`${M_FONT} inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 transition hover:text-[#d13b40]`}
            >
              Fechar <X size={13} />
            </button>
          </div>
          <iframe
            ref={iframeRef}
            src={typeformUrl(origem)}
            title="Formulário de qualificação — conte o contexto da sua obra"
            className="min-h-0 flex-1 w-full border-0"
            /* Sem `allow`: o formulário é de texto. Câmera e microfone estão desligados no
               Permissions-Policy do vercel.json e não seriam liberados por aqui de qualquer forma. */
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </>
      ) : (
        <>
          <p className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45`}>
            <span className="mr-2 text-[#b42318]">[ 01 ]</span>Qualificação
          </p>
          <h3 className={`${H_FONT} mt-4 text-balance text-2xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>
            Conte o contexto da sua obra
          </h3>
          <p className="mt-3 text-sm leading-6 text-black/55">
            Poucas perguntas, {TYPEFORM_DURACAO}. A gente chega na conversa já sabendo o que você
            usa hoje, onde o dado se perde e o que precisa sair do papel primeiro.
          </p>
          <ul className={`${M_FONT} mt-5 space-y-2 text-[10px] uppercase tracking-[0.14em] text-black/40`}>
            <li>· Sem instalar nada</li>
            <li>· Sem compromisso de compra</li>
            <li>· Resposta em até 1 dia útil</li>
          </ul>
          <div className="mt-auto pt-6">
            {/* Neutro, e não primário: o vermelho da página inteira marca um caminho só — o de
                agendar. Duas caixas vermelhas lado a lado nesta seção desfariam a regra. */}
            <CtaBox onClick={abrir} className="w-full sm:w-auto">
              Responder agora
            </CtaBox>
            {/* Escape para quem prefere sair do site — e rede de segurança se o iframe for
                bloqueado por bloqueador de rastreador ou pela CSP. */}
            <p className="mt-3 text-xs leading-5 text-black/40">
              Prefere abrir em outra aba?{' '}
              <a
                href={typeformUrl(`${origem}-nova-aba`)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#b42318] underline underline-offset-2"
              >
                Abrir o formulário
              </a>
              .
            </p>
          </div>
        </>
      )}
    </div>
  )
}
