/**
 * Aba RESUMO — quem contratou, por quanto, e a conferência contra a composição.
 *
 * É aqui que a **retenção** é explicada. O cliente pediu textualmente: "escreva o que é RT, nem
 * eu entendi" — e ele tem essa coluna na própria planilha. Sigla nenhuma aparece nesta tela.
 */
import { useState } from 'react'
import { Pencil, Save, X } from 'lucide-react'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { conferirTotal } from '@/features/torre-de-controle/utils/obraMedicao'
import type { ObraContrato } from '@/types'
import type { ValoresDoContrato, SubtotaisComposicao, ConferenciaDoTotal } from '@/features/torre-de-controle/utils/obraMedicao'
import { TXT, brl, num } from './formato'
import { Campo, Linha, Aviso, BotaoSec } from './ui'

/** Campo numérico opcional: vazio vira `undefined`, não zero. */
const optNum = (v: string): number | undefined => (v.trim() === '' ? undefined : parseLocaleNumber(v))

export function AbaResumo({ contrato, valores, subtotais, salvar, obraId }: {
  /** A obra dona deste contrato. Só serve de gatilho para o reset acima. */
  obraId: string
  contrato: ObraContrato
  valores: ValoresDoContrato
  subtotais: SubtotaisComposicao
  salvar: (patch: Partial<ObraContrato>) => void
}) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<ObraContrato>(contrato)

  /**
   * ⚠️ CINTO E SUSPENSÓRIO, e o suspensório é este.
   *
   * O `ContratoCard` é montado com `key={site.id}`, então trocar de obra já remonta esta aba. Isto
   * existe porque `key` é fácil de alguém remover num refactor sem entender o que segurava — e o
   * preço do descuido aqui é o contrato de um cliente gravado dentro do de outro.
   *
   * ⚠️ Ajuste DURANTE O RENDER, não num `useEffect`. Com efeito, o rascunho da obra antiga chega a
   * renderizar um quadro antes de ser limpo — e um quadro basta para alguém clicar em Salvar.
   * Este é o padrão que o próprio React documenta para redefinir estado quando uma prop muda.
   *
   * ⚠️ E o gatilho é o ID DA OBRA, não o objeto `contrato`: em obra sem contrato o pai monta
   * `site.contrato ?? { services: [] }`, objeto novo a cada render — vigiar a identidade dele
   * cancelaria a edição a cada tecla.
   */
  const [obraDoRascunho, setObraDoRascunho] = useState(obraId)
  if (obraId !== obraDoRascunho) {
    setObraDoRascunho(obraId)
    setEditando(false)
    setRascunho(contrato)
  }

  function abrir() { setRascunho(structuredClone(contrato)); setEditando(true) }
  function confirmar() {
    // Ao gravar o valor de serviço no campo novo, o `valorTotal` antigo sai de cena — senão
    // ficariam dois números respondendo a mesma pergunta, que é o problema que este card resolve.
    salvar({ ...rascunho, valorTotal: undefined })
    setEditando(false)
  }
  const set = (patch: Partial<ObraContrato>) => setRascunho((d) => ({ ...d, ...patch }))

  const temComposicao = (contrato.services?.length ?? 0) > 0
  const confServico  = temComposicao ? conferirTotal(valores.servico, subtotais.servico) : null
  const confMaterial = temComposicao && valores.material > 0 ? conferirTotal(valores.material, subtotais.material) : null

  if (editando) {
    const valorServico = rascunho.valorServico ?? rascunho.valorTotal
    return (
      <div className="flex flex-col gap-3 pt-1">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Campo label="Contratante"      valor={rascunho.contratanteRazao}  onChange={(v) => set({ contratanteRazao: v })} />
          <Campo label="CNPJ contratante" valor={rascunho.contratanteCnpj}   onChange={(v) => set({ contratanteCnpj: v })} />
          <Campo label="Contratado"       valor={rascunho.contratadoRazao}   onChange={(v) => set({ contratadoRazao: v })} />
          <Campo label="CNPJ contratado"  valor={rascunho.contratadoCnpj}    onChange={(v) => set({ contratadoCnpj: v })} />
          <Campo label="Contato"          valor={rascunho.contratadoContato} onChange={(v) => set({ contratadoContato: v })} />
          <Campo label="Nº do contrato"   valor={rascunho.numeroContrato}    onChange={(v) => set({ numeroContrato: v })} />
          <Campo label="Aditivo"          valor={rascunho.numeroAditivo}     onChange={(v) => set({ numeroAditivo: v })} />
          <Campo label="Objeto"           valor={rascunho.objetoAditivo}     onChange={(v) => set({ objetoAditivo: v })} className="sm:col-span-2" />
          <Campo label="Local"            valor={rascunho.local}             onChange={(v) => set({ local: v })} />
          <Campo label="Período de referência" valor={rascunho.periodoReferencia} onChange={(v) => set({ periodoReferencia: v })} placeholder="texto livre, como sempre foi" />
          <Campo label="Medição nº"       valor={rascunho.numeroMedicao}     onChange={(v) => set({ numeroMedicao: v })} />
          {/* ⚠️ Vigência em DATA, não em texto.
              O campo "Vigência" daqui era o `periodoReferencia`, texto livre que nenhuma tela
              nunca leu. Com estas duas datas, o Financeiro passa a poder recortar entradas e
              saídas na janela do contrato — que era o buraco por trás de "entrada antiga
              confrontada com saída de agora". Vazias, o sistema recorre às datas da obra. */}
          <Campo label="Vigência — início" tipo="date" valor={rascunho.vigenciaInicio} onChange={(v) => set({ vigenciaInicio: v || undefined })} />
          <Campo label="Vigência — fim"    tipo="date" valor={rascunho.vigenciaFim}    onChange={(v) => set({ vigenciaFim: v || undefined })} />
        </div>
        <p className="text-[10px] text-[#6b6b6b]">
          A vigência alimenta o atalho <b>Contrato</b> dos filtros do Financeiro: com ela preenchida,
          entradas e saídas passam a ser olhadas no mesmo período. Sem ela, o sistema usa as datas de
          início e fim da obra.
        </p>

        <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-2.5">
          <p className={`mb-2 text-[11px] ${TXT.normal}`}>
            <b>Os dois valores do contrato.</b> O saldo da obra é acompanhado contra o de <b>serviço</b>;
            o material é faturado à parte e não entra nessa conta.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Valor de serviço (R$)"  numero valor={valorServico != null ? String(valorServico) : ''}
                   onChange={(v) => set({ valorServico: optNum(v) })} />
            <Campo label="Valor de material (R$)" numero valor={rascunho.valorMaterial != null ? String(rascunho.valorMaterial) : ''}
                   onChange={(v) => set({ valorMaterial: optNum(v) })} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={confirmar}
            className="inline-flex items-center gap-1 rounded-lg bg-[#f97316] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#ea580c]">
            <Save size={12} /> Salvar
          </button>
          <BotaoSec onClick={() => setEditando(false)}><X size={12} /> Cancelar</BotaoSec>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 pt-1">
      <div className="flex flex-col gap-1">
        {contrato.contratanteRazao && <Linha label="Contratante">{contrato.contratanteRazao}</Linha>}
        {contrato.contratanteCnpj  && <Linha label="CNPJ">{contrato.contratanteCnpj}</Linha>}
        {contrato.contratadoRazao  && <Linha label="Contratado">{contrato.contratadoRazao}</Linha>}
        {contrato.objetoAditivo    && <Linha label="Objeto">{contrato.objetoAditivo}</Linha>}
        {contrato.local            && <Linha label="Local">{contrato.local}</Linha>}
        {contrato.periodoReferencia && <Linha label="Vigência">{contrato.periodoReferencia}</Linha>}
        <Linha label="Valor de serviço">{brl(valores.servico)}</Linha>
        {valores.material > 0 && <Linha label="Valor de material">{brl(valores.material)}</Linha>}
      </div>

      {(confServico || confMaterial) && (
        <div className="flex flex-col gap-1.5">
          {confServico  && <SeloConferencia titulo="Serviço"  conf={confServico} />}
          {confMaterial && <SeloConferencia titulo="Material" conf={confMaterial} />}
        </div>
      )}

      {/* A explicação que o cliente pediu. Sem sigla, e com o número dele. */}
      <Aviso>
        <b>Retenção (garantia).</b> É uma parte de cada nota — em geral 5% — que o cliente não paga
        na hora: fica retida como garantia de que o serviço foi bem feito e é liberada depois da
        entrega. <b>Não é desconto — o dinheiro é seu</b>, só está segurado. Ela aparece nota a nota
        na aba Medições, soma no topo como “Retenção a liberar”, e <b>não</b> abate do saldo.
      </Aviso>

      <div><BotaoSec onClick={abrir}><Pencil size={11} /> {contrato.numeroContrato || valores.total > 0 ? 'Editar contrato' : 'Cadastrar contrato'}</BotaoSec></div>
    </div>
  )
}

/**
 * O selo de diferença entre o valor declarado e a soma da composição.
 *
 * Abaixo do limite (0,5% ou R$ 1.000) é só uma nota de rodapé: no contrato real da SUPERA a
 * diferença é de R$ 23,54 em R$ 592 mil — 0,004%, arredondamento de preço unitário. Não faz
 * sentido pintar a tela de amarelo toda vez que a obra é aberta.
 */
function SeloConferencia({ titulo, conf }: { titulo: string; conf: ConferenciaDoTotal }) {
  if (conf.diferenca === 0) return null
  const sinal = conf.diferenca > 0 ? '+' : '−'
  const valor = `${sinal} ${brl(Math.abs(conf.diferenca))} (${num(Math.abs(conf.percentual), 3)}%)`

  if (conf.arredondamento) {
    return (
      <p className={`text-[11px] ${TXT.fraco}`}>
        {titulo}: a composição soma {valor} em relação ao valor do contrato — arredondamento de preço unitário.
      </p>
    )
  }
  return (
    <Aviso tom="atencao">
      <b>{titulo}: {valor}</b> de diferença entre o valor do contrato ({brl(conf.declarado)}) e a soma
      da composição ({brl(conf.somado)}). O valor do contrato é o que vale; vale conferir a composição.
    </Aviso>
  )
}
