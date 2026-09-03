/**
 * A chave de acesso da NF-e / NFC-e — 44 dígitos que se conferem sozinhos.
 *
 * ─── POR QUE ESTE ARQUIVO É O ALICERCE DA ABA NOTA FISCAL ─────────────────────
 *
 * Fotografar um cupom e "deixar o sistema entender" tem dois lados muito
 * diferentes, e misturá-los é o jeito mais rápido de gravar dinheiro errado:
 *
 *   · o QR Code devolve a CHAVE, e a chave é **certeza** — ela carrega o próprio
 *     dígito verificador, então um dígito trocado é recusado em vez de virar dado;
 *   · o valor e os itens vêm de OCR, e OCR em papel térmico acerta cerca de 60%
 *     dos caracteres. Isso é **proposta**, e proposta se confirma com gente.
 *
 * Este arquivo cuida só do primeiro lado. Ele é puro: sem React, sem rede, sem
 * DOM — dá para conferir de mesa, e é conferido (veja `chaveNfe.test.ts`, que
 * troca **cada um dos 44 dígitos por cada um dos outros 9** e exige que as 396
 * mutações sejam recusadas).
 *
 * ─── O LAYOUT, MEDIDO NUMA NOTA REAL ──────────────────────────────────────────
 *
 *   53260855737356000102650020000021871005967012
 *   53 | 2608 | 55737356000102 | 65 | 002 | 000002187 | 1 | 00596701 | 2
 *   UF   AAMM   CNPJ do emitente  mod  série   número    tp   cNF      DV
 *
 * Naquela nota, todos os campos bateram com o impresso — inclusive o cNF, que o
 * cupom repete entre parênteses no rodapé. E um detalhe que resume a razão de
 * tudo isto existir: a série impressa parecia "003" na foto borrada, e a chave
 * dizia 002. **A chave venceu.**
 */

/** Códigos de UF do IBGE. Fora desta tabela, a chave não é chave. */
const UFS: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
}

/** Os modelos que esta aba aceita. Ver `MODELOS_RECUSADOS` para o resto. */
const MODELOS: Record<string, string> = { '55': 'NF-e', '65': 'NFC-e' }

/**
 * ⚠️ Modelos que TAMBÉM têm 44 dígitos e **precisam ser recusados pelo nome**.
 *
 * O CF-e do SAT (modelo 59) é o caso perigoso: mesmo comprimento, layout
 * parecido, e se a gente só olhasse o tamanho ele passaria — produzindo um CNPJ
 * plausível e errado, que é bem pior do que não ler nada. O DV dele nem sempre
 * fecha pela mesma conta, mas contar com isso seria contar com sorte.
 */
const MODELOS_RECUSADOS: Record<string, string> = {
  '57': 'CT-e (conhecimento de transporte)',
  '58': 'MDF-e (manifesto de documentos fiscais)',
  '59': 'CF-e do SAT — outro documento, com layout próprio',
  '67': 'CT-e OS',
}

/** Só os dígitos. É assim que a chave é guardada e comparada — nunca formatada. */
export function digitosDaChave(bruta?: string | null): string {
  return (bruta ?? '').replace(/\D/g, '')
}

/**
 * O dígito verificador: módulo 11, pesos 2..9 ciclando da direita para a esquerda.
 *
 * ⚠️ **Resto 0 e resto 1 dão DV `0`.** Este é o `off-by-one` que erra
 * aproximadamente 2 em cada 11 chaves e só aparece em produção, com uma nota de
 * verdade na mão de alguém. Há teste para os dois casos.
 */
export function dvDaChave(primeiros43: string): number {
  let soma = 0
  let peso = 2
  for (let i = primeiros43.length - 1; i >= 0; i--) {
    soma += Number(primeiros43[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  return resto === 0 || resto === 1 ? 0 : 11 - resto
}

export type MotivoChaveInvalida =
  | 'vazia' | 'tamanho' | 'dv' | 'uf' | 'modelo' | 'modelo-outro-documento'

export interface ChaveNfe {
  /** 44 dígitos, sem formatação. */
  chave: string
  cUF: string
  uf: string
  /** `yyyy-MM` — garantido pela chave. A data COMPLETA não está nela. */
  competencia: string
  ano: number
  mes: number
  /** 14 dígitos, sem pontuação. */
  cnpj: string
  cnpjFormatado: string
  modelo: string
  /** 'NF-e' ou 'NFC-e'. */
  modeloNome: string
  serie: number
  numero: number
  tpEmis: number
  cNF: string
  cDV: number
}

export type LeituraDaChave =
  | { ok: true; dados: ChaveNfe; avisos: string[] }
  | { ok: false; motivo: MotivoChaveInvalida; detalhe: string }

const CNPJ_FMT = /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/

/**
 * Lê a chave e devolve os nove campos — ou o motivo de ter recusado.
 *
 * A ordem das recusas é de propósito: primeiro o que é barato e conclusivo
 * (tamanho, DV), depois o que é interpretação (UF, modelo). Assim a mensagem que
 * chega na tela é a mais útil possível: "falta ou sobra um número" é acionável;
 * "modelo inválido" numa chave que nem fecha o DV, não.
 */
export function lerChaveNfe(bruta: string): LeituraDaChave {
  const chave = digitosDaChave(bruta)
  if (!chave) return { ok: false, motivo: 'vazia', detalhe: 'Nenhum dígito encontrado.' }
  if (chave.length !== 44) {
    return {
      ok: false,
      motivo: 'tamanho',
      detalhe: `A chave tem 44 dígitos; esta tem ${chave.length}.`,
    }
  }

  const cDV = Number(chave[43])
  const calculado = dvDaChave(chave.slice(0, 43))
  if (cDV !== calculado) {
    return {
      ok: false,
      motivo: 'dv',
      detalhe: 'Os 44 dígitos não fecham o dígito verificador — falta ou sobra um número.',
    }
  }

  const cUF = chave.slice(0, 2)
  const uf = UFS[cUF]
  if (!uf) return { ok: false, motivo: 'uf', detalhe: `Não existe estado com o código ${cUF}.` }

  const modelo = chave.slice(20, 22)
  if (MODELOS_RECUSADOS[modelo]) {
    return {
      ok: false,
      motivo: 'modelo-outro-documento',
      detalhe: `Isto é um ${MODELOS_RECUSADOS[modelo]}, não uma nota fiscal.`,
    }
  }
  const modeloNome = MODELOS[modelo]
  if (!modeloNome) {
    return { ok: false, motivo: 'modelo', detalhe: `Modelo ${modelo} não é NF-e nem NFC-e.` }
  }

  const ano = 2000 + Number(chave.slice(2, 4))
  const mes = Number(chave.slice(4, 6))
  const cnpj = chave.slice(6, 20)

  /**
   * ⚠️ Daqui para baixo é AVISO, nunca recusa.
   *
   * O DV passou, então os dígitos estão certos: a chave é o que é. Mês 13 ou
   * emissão no futuro é anomalia para a pessoa olhar, não motivo para o sistema
   * jogar fora um documento fiscal válido.
   */
  const avisos: string[] = []
  if (mes < 1 || mes > 12) avisos.push(`A chave diz mês ${mes}, que não existe.`)
  if (ano < 2006) avisos.push(`A chave diz ${ano} — antes da NF-e existir.`)

  return {
    ok: true,
    avisos,
    dados: {
      chave,
      cUF,
      uf,
      competencia: `${ano}-${String(mes).padStart(2, '0')}`,
      ano,
      mes,
      cnpj,
      cnpjFormatado: cnpj.replace(CNPJ_FMT, '$1.$2.$3/$4-$5'),
      modelo,
      modeloNome,
      serie: Number(chave.slice(22, 25)),
      numero: Number(chave.slice(25, 34)),
      tpEmis: Number(chave.slice(34, 35)),
      cNF: chave.slice(35, 43),
      cDV,
    },
  }
}

/**
 * Acha chaves válidas dentro de um texto qualquer.
 *
 * Serve para as três formas em que a chave chega na vida real:
 *   · 44 dígitos crus, digitados ou colados;
 *   · o payload do QR na versão 2 — `chNFe|nVersao|tpAmb|cIdToken|cHashQRCode`;
 *   · a URL de consulta da SEFAZ, `...?p=<chave>|2|1|1|<hash>`.
 *
 * ⚠️ **Só aceita sequências de EXATAMENTE 44 dígitos.** A tentação é varrer com
 * janela deslizante dentro de sequências maiores, e ela produz chave fantasma: o
 * `cHashQRCode` é um SHA-1 que, em hexadecimal só de números, pode ter dezenas de
 * dígitos seguidos — e dentro dele alguma janela de 44 fecharia o DV por acaso, um
 * dia. Uma chave inventada com DV correto é o pior resultado possível aqui.
 */
export function chavesNoTexto(texto: string): string[] {
  const achadas: string[] = []
  for (const corrida of (texto ?? '').match(/\d+/g) ?? []) {
    if (corrida.length !== 44) continue
    if (lerChaveNfe(corrida).ok && !achadas.includes(corrida)) achadas.push(corrida)
  }
  return achadas
}

/** Onze grupos de quatro, como o cupom imprime. Só para exibir. */
export function formatarChave(chave: string): string {
  const d = digitosDaChave(chave)
  return d.length === 44 ? (d.match(/.{4}/g) ?? []).join(' ') : d
}
