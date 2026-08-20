/**
 * modeloCompizzo.ts — o modelo de rotinas da Compizzo.
 *
 * ─── ESCOPO ───────────────────────────────────────────────────────────────────────────────────
 * Este modelo é semeado SOMENTE na organização Compizzo, por escolha explícita do cliente. Outra
 * empresa que instalar o produto começa com a lista vazia e um botão para carregar o modelo se
 * quiser — o que se adapta é a operação de cada cliente, não a plataforma.
 *
 * O gate está em `ORGANIZACAO_DO_MODELO`, comparado pelo NOME da organização em minúsculas. Nome,
 * e não id, porque o id do tenant muda entre o banco de desenvolvimento e o de produção, e um id
 * chumbado aqui simplesmente nunca casaria em produção.
 *
 * ─── RESPONSÁVEL É TEXTO ──────────────────────────────────────────────────────────────────────
 * A empresa usa uma conta só para todo mundo. O nome aqui diz DE QUEM É a tarefa; quem marcou foi
 * a conta da empresa. Fingir precisão maior do que essa seria inventar um dado.
 */
import type { Rotina } from '@/store/rotinasStore'

/** Nome da organização (minúsculas, sem acento) que recebe a semente automática. */
export const ORGANIZACAO_DO_MODELO = 'compizzo'

export function ehAOrganizacaoDoModelo(nome?: string | null): boolean {
  if (!nome) return false
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .includes(ORGANIZACAO_DO_MODELO)
}

type ModeloRotina = Omit<Rotina, 'id'>

/**
 * As rotinas do modelo, na ordem em que a operação as faz.
 *
 * `ordem` cresce de 10 em 10 dentro de cada frequência: assim dá para encaixar uma tarefa nova
 * entre duas existentes sem renumerar a lista inteira.
 */
export const MODELO_COMPIZZO: ModeloRotina[] = [
  // ── Todo dia ────────────────────────────────────────────────────────────────
  { titulo: 'Lançar o RDO de cada obra',                  descricao: 'Uma obra sem produção também precisa ser marcada — o alerta do Dashboard do RDO mostra quais faltam.', modulo: '/app/rdo',           frequencia: 'diaria', responsavel: 'Encarregado da obra', ordem: 10, ativa: true },
  { titulo: 'Conferir presença e faltas do dia',          descricao: 'Falta não registrada vira dia pago na folha.',                                                        modulo: '/app/mao-de-obra',   frequencia: 'diaria', responsavel: 'Vinicius',            ordem: 20, ativa: true },
  { titulo: 'Registrar as retiradas do almoxarifado',     descricao: 'Quem retirou, quanto e quando — a ficha de retirada no Suprimentos.',                                 modulo: '/app/suprimentos',   frequencia: 'diaria', responsavel: 'Valim',               ordem: 30, ativa: true },
  { titulo: 'Olhar os alertas da Torre de Controle',      descricao: 'Riscos ativos e obras sem movimento.',                                                                modulo: '/app/torre-de-controle', frequencia: 'diaria', responsavel: 'Eduardo',        ordem: 40, ativa: true },

  // ── Toda semana ─────────────────────────────────────────────────────────────
  { titulo: 'Reunião de obra com o Gestão 360',           descricao: 'Selecionar a semana no painel e exportar a pauta.',                                                   modulo: '/app/gestao-360',    frequencia: 'semanal', responsavel: 'Eduardo',            ordem: 10, ativa: true },
  { titulo: 'Conferir estoque mínimo e fazer os pedidos', descricao: 'O Dashboard de Suprimentos lista o que está no mínimo e o que está chegando perto.',                   modulo: '/app/suprimentos',   frequencia: 'semanal', responsavel: 'Valim',              ordem: 20, ativa: true },
  { titulo: 'Atualizar o cronograma da semana',           descricao: 'O que foi entregue, o que atrasou e por quê.',                                                        modulo: '/app/planejamento',  frequencia: 'semanal', responsavel: 'Eduardo',            ordem: 30, ativa: true },
  { titulo: 'Revisar as não conformidades abertas',       descricao: 'NC parada é obra parada mais tarde.',                                                                 modulo: '/app/qualidade',     frequencia: 'semanal', responsavel: 'Qualidade',          ordem: 40, ativa: true },
  { titulo: 'Conferir contas a pagar da semana',          descricao: 'Boletos que vencem nos próximos sete dias.',                                                          modulo: '/app/financeiro',    frequencia: 'semanal', responsavel: 'Financeiro',         ordem: 50, ativa: true },
  // A planilha do estoque é CONFERÊNCIA de prateleira, não registro de movimento — e conferência
  // vale semanal. A retirada em si é registrada no ato, na ficha (rotina diária acima): é o único
  // momento em que se sabe quem levou. Na ficha de papel do cliente, 2 de 7 retiradas ficaram sem
  // colaborador identificado justamente por terem sido anotadas depois.
  { titulo: 'Conferir o estoque com a planilha',          descricao: 'Subir a planilha atualizada em Suprimentos. A diferença contra o sistema é o material que saiu sem ficha.', modulo: '/app/suprimentos', frequencia: 'semanal', responsavel: 'Valim',        ordem: 60, ativa: true },

  // ── A cada quinzena ─────────────────────────────────────────────────────────
  { titulo: 'Avaliação da equipe',                        descricao: 'A avaliação por funcionário, que fecha junto com a quinzena da folha.',                                modulo: '/app/mao-de-obra',   frequencia: 'quinzenal', responsavel: 'Vinicius',         ordem: 10, ativa: true },
  { titulo: 'Conferir a produtividade por funcionário',   descricao: 'Comparar com a quinzena anterior — dias úteis, não o total bruto.',                                    modulo: '/app/mao-de-obra',   frequencia: 'quinzenal', responsavel: 'Eduardo',          ordem: 20, ativa: true },
  { titulo: 'Fechar o inventário da quinzena',            descricao: 'Contagem física dos itens de maior valor, para pegar o que a conferência semanal não pega.',           modulo: '/app/suprimentos',   frequencia: 'quinzenal', responsavel: 'Valim',            ordem: 30, ativa: true },

  // ── Todo mês ────────────────────────────────────────────────────────────────
  { titulo: 'Fechar a folha de pagamento',                descricao: 'Conferir faltas, horas e descontos antes de gerar.',                                                   modulo: '/app/mao-de-obra',   frequencia: 'mensal', responsavel: 'Financeiro',          ordem: 10, ativa: true },
  { titulo: 'Fechar a medição do mês',                    descricao: 'O que foi executado e o que será faturado.',                                                          modulo: '/app/medicao',       frequencia: 'mensal', responsavel: 'Eduardo',             ordem: 20, ativa: true },
  { titulo: 'Conferir o custo de cada obra',              descricao: 'Orçado × realizado, e o que explica a diferença.',                                                    modulo: '/app/gestao-360',    frequencia: 'mensal', responsavel: 'Eduardo',             ordem: 30, ativa: true },
  { titulo: 'Revisar contratos e fornecedores',           descricao: 'Preço, prazo de entrega e o que atrasou no mês.',                                                     modulo: '/app/suprimentos',   frequencia: 'mensal', responsavel: 'Valim',               ordem: 40, ativa: true },
  { titulo: 'Conferir manutenções dos equipamentos',      descricao: 'O que venceu e o que vence no mês que vem.',                                                          modulo: '/app/manutencoes',   frequencia: 'mensal', responsavel: 'Eduardo',             ordem: 50, ativa: true },
]
