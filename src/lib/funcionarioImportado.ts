/**
 * A porta por onde funcionário importado entra — e o que ela NÃO deixa passar.
 *
 * ─── POR QUE ISTO EXISTE ──────────────────────────────────────────────────────
 * `workerToRow` grava `payload: w` — o objeto inteiro, sem filtro, direto num `jsonb` do servidor.
 * É assim que os campos opcionais do `Worker` chegam ao banco sem migração, e é ótimo para isso.
 * Mas quer dizer que **qualquer chave que exista no objeto em tempo de execução vai para o banco**,
 * tenha tipo declarado ou não. Uma planilha de RH tem CPF, RG, CNH, título de eleitor e
 * antecedentes criminais na mesma linha do nome; um `...spread` distraído leva tudo junto.
 *
 * O tipo não protege: `Worker` não declara `rg`, mas `{...linha}` com um `rg` dentro compila e
 * grava. A lista abaixo é a proteção, e ela roda em tempo de execução.
 *
 * ─── POR QUE NÃO DENTRO DE `addWorker` ────────────────────────────────────────
 * ⚠️ Porque o formulário manual também passa por lá, e ele PRECISA gravar `cpfMasked` — o campo
 * existe, mascarado, e é legítimo. Sanitizar `addWorker` quebraria o cadastro à mão. Por isso a
 * importação tem a sua própria porta (`importarFuncionarios` no store), e é ela que sanitiza.
 */
import type { Worker } from '@/types'

/**
 * O que um funcionário IMPORTADO pode ter.
 *
 * ⚠️ É um `Record<keyof Worker, boolean>` de propósito: campo novo no `Worker` **para de
 * compilar** aqui até alguém decidir se ele pode vir de planilha. Uma lista de strings não
 * travaria nada — e o dia em que alguém acrescentasse `rgNumero` ao tipo, ele passaria direto.
 */
const PERMITIDO_NA_IMPORTACAO: Record<keyof Worker, boolean> = {
  // Operacional — é para isto que a importação serve.
  name: true,
  role: true,
  crewId: true,
  status: true,
  phone: true,
  email: true,
  department: true,
  registrationNumber: true,
  admissionDate: true,
  contractType: true,
  scheduleType: true,
  workFront: true,
  siteId: true,
  locationNote: true,
  hourlyRate: true,
  grossSalary: true,
  recebeVA: true,
  recebeVT: true,
  dependentesIRRF: true,
  desligamentoData: true,
  desligamentoMotivo: true,
  observacoes: true,
  /** A CATEGORIA (A/B), nunca o número. Ver `categoriaDeCnh` em `importConfigs.ts`. */
  tipoCnh: true,

  // Bloqueados.
  /**
   * A diária de HE desta pessoa é exceção negociada, decidida na tela de Cargos / Horas Extras —
   * não vem no cadastro de pessoal. A planilha de HE do cliente tem valor por DIA, não um padrão
   * por pessoa: importar dali confundiria "o que ele recebeu no sábado 08" com "o que ele sempre
   * recebe". Se um dia a planilha de funcionários ganhar essas colunas, é decisão para tomar aqui.
   */
  heSabadoOverride: false,
  heDomingoOverride: false,
  /** O id é do sistema, não da planilha. */
  id: false,
  /** ⚠️ Existe no cadastro manual, mascarado. Não se importa CPF de planilha. */
  cpfMasked: false,
  /** Certificações têm validade e origem; entram pela tela, não por coluna de planilha. */
  certifications: false,
  /** Referência opaca de biometria — nunca vem de arquivo. */
  biometricToken: false,
}

/**
 * Nomes de chave que denunciam documento pessoal.
 *
 * Rede de segurança para o que a lista acima não prevê: uma planilha pode trazer `RG`, `Titulo`,
 * `Antecedentes` — chaves que nem existem no `Worker` e por isso não aparecem no `Record`.
 */
export const PROIBIDO_NO_NOME =
  /cpf|(^|[^a-z])rg([^a-z]|$)|cnh|habilitac|titulo|eleitor|antecedent|\baso\b|exame|conta|banc|agencia|pix|\bpis\b|ctps|reservista|carteira|passaporte|biometr/i

/**
 * As chaves que a importação aceita. `tipoCnh` é a exceção declarada: casa com `cnh` no nome e é
 * permitida de propósito, porque guarda a CATEGORIA e não o número.
 */
export const CAMPOS_DO_FUNCIONARIO_IMPORTADO: string[] =
  Object.entries(PERMITIDO_NA_IMPORTACAO).filter(([, ok]) => ok).map(([k]) => k)

/**
 * Fica só com o que pode entrar. Devolve também o que foi barrado, para a tela poder dizer
 * "ignorei 4 colunas" em vez de descartar em silêncio.
 */
export function sanitizarFuncionarioImportado(
  bruto: Record<string, unknown>,
): { limpo: Record<string, unknown>; ignorados: string[] } {
  const limpo: Record<string, unknown> = {}
  const ignorados: string[] = []
  const permitido = new Set(CAMPOS_DO_FUNCIONARIO_IMPORTADO)

  for (const [chave, valor] of Object.entries(bruto)) {
    if (valor === undefined) continue
    if (!permitido.has(chave)) { ignorados.push(chave); continue }
    limpo[chave] = valor
  }
  return { limpo, ignorados }
}
