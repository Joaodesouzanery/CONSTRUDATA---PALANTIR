/**
 * "Todas as informações que foram preenchidas no RDO precisam estar no PDF. TODAS."
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────────
 * O gerador antigo do RDO Compizzo (`rdoCompizzoPdf.ts`, 166 linhas) imprimia um documento com
 * texto colado na borda, seções cortadas ao meio, e **faltando quase tudo**: a produção saía com
 * as seis linhas padrão em branco afogando a quantidade real, a mão de obra dizia "Total de
 * colaboradores: 0" porque lia só a lista nominal, e não havia contrato, HH, RUP, unidade,
 * previsto, custo de material, origem do estoque nem status de rascunho.
 *
 * Um relatório que perde campo em silêncio é pior que um que quebra: ninguém percebe até a folha
 * estar na mão de alguém, numa reunião. Este teste preenche **um RDO com tudo** e exige que cada
 * valor apareça no HTML. Ele é puro — `buildRdosReportHtml` é string entra, string sai.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { RDO } from '@/types'
import { buildRdosReportHtml, contarPessoas } from './rdosReportExport'

/** Um RDO Compizzo com TODO campo preenchido — a fixture é a especificação. */
const CHEIO: RDO = {
  id: 'r1', number: 41, status: 'finalizado',
  date: '2026-09-03', responsible: 'Vinicius de Carvalho Martins',
  weather: { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 27 } as RDO['weather'],
  manpower: { foremanCount: 1, officialCount: 3, helperCount: 2, operatorCount: 1, employeeNames: ['Ana', 'Bruno'] },
  equipment: [{ id: 'e1', name: 'Compressor', quantity: 1, hours: 8, operator: 'Carlos' }],
  services: [], trechos: [],
  materials: [],
  geolocation: { lat: '-15.79', lng: '-47.88' },
  observations: '', incidents: '',
  photos: [{ id: 'f1', base64: 'data:image/jpeg;base64,AAAA', label: 'Garagem bloco D' } as RDO['photos'][number]],
  numeroOS: 'OS-2026-77',
  nomeEmpreiteira: 'Compizzo Servicos',
  createdAt: '', updatedAt: '',
  template: 'compizzo',
  compizzo: {
    obra: 'SQS 314 Bloco D',
    numeroContrato: 'CT-9911',
    bacOrcamentoBRL: 195900.65,
    servicoContratado: 'Demarcacao e pintura de piso',
    precoM2: 42.5,
    periodoInicio: '2026-07-01',
    periodoFim: '2026-12-31',
    diaObra: '03',
    condicaoClimatica: 'sol',
    servicos: { preparacaoPiso: true } as never,
    servicosExtra: [{ nome: 'Selagem de junta', quantidade: '30', unidade: 'm' }],
    descricaoServicos: 'Foi dado inicio ao servico com a demarcacao do piso.',
    producao: [
      { servico: 'Pintura Vermelha (m²)', quantidade: '' },
      { servico: 'Faixa Branca (m)', quantidade: '' },
      { servico: 'Retirada de Piso Epoxi Antigo', quantidade: '750', unidade: 'm²', quantidadePrevista: 750 },
    ],
    horasTrabalhadas: 60,
    materiais: [{ material: 'Tinta Amarela', quantidade: '12', custoUnitario: 89.9, stockItemId: 'i1' }],
    ocorrencias: { outros: true } as never,
    observacoes: 'Instalacao eletrica teve que ser revisada por eletricista externo',
    planejamentoProximoDia: 'Dar continuidade nas areas liberadas',
    responsavelNome: 'Vinicius de Carvalho Martins',
    responsavelData: '2026-09-03',
  } as RDO['compizzo'],
}

/**
 * ⚠️ As fotos chegam pelo canal `fotosPorRdo`, indexadas pelo id do RDO — e não de `rdo.photos`.
 *
 * É deliberado: resolver `storagePath` em base64 é assíncrono e vai à rede, e o construtor precisa
 * ser PURO para poder ser conferido aqui. Quem resolve é `imprimirRelatorioRdos`.
 */
const FOTOS = { [CHEIO.id]: CHEIO.photos }

const html = () => buildRdosReportHtml(
  [{ tipo: 'torre', rdo: CHEIO }],
  { periodo: 'set/2026', fotosPorRdo: FOTOS },
)

describe('buildRdosReportHtml — nenhum campo preenchido pode sumir', () => {
  const casos: [string, string][] = [
    ['número do RDO', '41'],
    ['responsável', 'Vinicius de Carvalho Martins'],
    ['obra', 'SQS 314 Bloco D'],
    ['nº do contrato', 'CT-9911'],
    ['nº da OS', 'OS-2026-77'],
    ['empreiteira', 'Compizzo Servicos'],
    ['serviço contratado', 'Demarcacao e pintura de piso'],
    ['geolocalização', '-15.79'],
    ['dia da obra', 'Dia da obra'],
    ['serviço extra', 'Selagem de junta'],
    ['descrição dos serviços', 'Foi dado inicio ao servico'],
    ['a quantidade produzida', '750'],
    ['a unidade da produção', 'm²'],
    ['equipamento', 'Compressor'],
    ['operador do equipamento', 'Carlos'],
    ['material', 'Tinta Amarela'],
    ['custo do material', '89,90'],
    ['observações', 'eletricista externo'],
    ['planejamento do próximo dia', 'Dar continuidade nas areas liberadas'],
    ['legenda da foto', 'Garagem bloco D'],
    ['a foto em si', 'data:image/jpeg;base64,AAAA'],
  ]
  for (const [oQue, esperado] of casos) {
    it(`imprime ${oQue}`, () => {
      assert.ok(html().includes(esperado), `"${esperado}" não apareceu no documento`)
    })
  }

  it('imprime o BAC do contrato formatado', () => {
    assert.match(html(), /195\.900,65/)
  })

  it('imprime o preço por m²', () => {
    assert.match(html(), /42,50/)
  })

  it('imprime o período do contrato nas duas pontas', () => {
    const h = html()
    assert.ok(h.includes('01/07/2026') && h.includes('31/12/2026'))
  })
})

describe('as correções específicas do gerador antigo', () => {
  /**
   * ⚠️ O gerador antigo imprimia as SEIS linhas padrão em branco, e o 750 real se perdia no meio
   * de uma tabela quase vazia. É o que o print do cliente mostrava.
   */
  it('não imprime as linhas de produção em branco', () => {
    const h = html()
    assert.ok(!h.includes('Pintura Vermelha'), 'linha padrão vazia foi impressa')
    assert.ok(!h.includes('Faixa Branca'), 'linha padrão vazia foi impressa')
    assert.ok(h.includes('Retirada de Piso Epoxi Antigo'), 'a linha com quantidade sumiu')
  })

  /** ⚠️ "Total de colaboradores: 0" saía em todo RDO que contasse a equipe por função. */
  it('conta a equipe pelas funções, não só pela lista de nomes', () => {
    assert.equal(contarPessoas({ tipo: 'torre', rdo: CHEIO }), 7)
    assert.match(html(), /Encarregados/)
    assert.match(html(), /7 pessoa\(s\)/)
  })

  it('imprime o HH e a RUP calculada sobre a ÁREA', () => {
    const h = html()
    assert.match(h, /60,0 HH/)
    // 60 HH ÷ 750 m² = 0,08 HH/m²
    assert.match(h, /0,08 HH\/m²/)
  })

  /** ⚠️ RUP é HH por metro quadrado — num dia só de faixa linear ela não existe. */
  it('sem produção em m², diz que a RUP não se aplica em vez de inventar', () => {
    const soLinear: RDO = {
      ...CHEIO,
      compizzo: { ...CHEIO.compizzo!, producao: [{ servico: 'Faixa Branca (m)', quantidade: '200' }] },
    }
    const h = buildRdosReportHtml([{ tipo: 'torre', rdo: soLinear }], { periodo: 'set/2026' })
    assert.match(h, /RUP não se aplica/)
  })

  it('mostra a origem do material — estoque ou fora dele', () => {
    assert.match(html(), /estoque/)
  })

  /** ⚠️ Um rascunho impresso era indistinguível de um documento fechado. */
  it('marca RASCUNHO no papel', () => {
    const rascunho: RDO = { ...CHEIO, status: 'rascunho' }
    const h = buildRdosReportHtml([{ tipo: 'torre', rdo: rascunho }], { periodo: 'set/2026' })
    assert.match(h, /RASCUNHO/)
    assert.ok(!html().includes('RASCUNHO'), 'o finalizado não pode levar o selo')
  })
})

describe('a diagramação que fazia o texto sair cortado', () => {
  const h = html()
  it('a página tem largura máxima e respiro — não texto colado na borda', () => {
    assert.match(h, /max-width:\s*210mm/)
    assert.match(h, /@page/)
  })

  it('as seções não podem ser cortadas ao meio', () => {
    assert.match(h, /break-inside:\s*avoid/)
  })

  it('tem rodapé com numeração de página', () => {
    assert.match(h, /counter\(page\)/)
  })

  it('o cabeçalho da tabela repete nas páginas seguintes', () => {
    assert.match(h, /table-header-group/)
  })
})
