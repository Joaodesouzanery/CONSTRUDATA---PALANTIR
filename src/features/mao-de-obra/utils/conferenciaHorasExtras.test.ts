/** Nomes e salários FICTÍCIOS. Nada aqui vem do dado real. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FinanceiroEntry, Worker } from '@/types'
import { conferirHorasExtras, fatorDoDia } from './conferenciaHorasExtras'

const w = (id: string, name: string, grossSalary?: number, status: Worker['status'] = 'active'): Worker =>
  ({ id, name, role: 'x', cpfMasked: '', crewId: '', status, certifications: [], hourlyRate: 0, grossSalary } as Worker)

const he = (nome: string, data: string, valor: number): FinanceiroEntry =>
  ({ id: `${nome}-${data}`, tipo: 'saida', descricao: 'HE', valor, data, categoria: 'mao_de_obra',
     createdAt: '', origem: 'horas-extras', subcategoria: 'horas_extras', funcionarioNome: nome } as FinanceiroEntry)

// salário 2.200 → hora 10 → HE 15 (comum) / 20 (domingo)
const W = [w('1', 'Ana Beatriz Lima', 2_200), w('2', 'Pedro Alves', 2_200), w('3', 'Pedro Alves', 3_000), w('4', 'Rui Costa', undefined)]

test('domingo e feriado pagam 2,0×; dia comum 1,5×', () => {
  assert.equal(fatorDoDia('2026-08-02', new Set()), 2)            // domingo
  assert.equal(fatorDoDia('2026-08-03', new Set()), 1.5)          // segunda
  assert.equal(fatorDoDia('2026-08-03', new Set(['2026-08-03'])), 2)
})

test('horas implícitas e desvio contra 2h/dia', () => {
  // seg 03/08: R$ 30 = 2h a R$ 15 → bate na referência (30). dom 02/08: R$ 80 a R$ 20 = 4h, ref 40.
  const r = conferirHorasExtras([he('Ana Beatriz Lima', '2026-08-03', 30), he('Ana Beatriz Lima', '2026-08-02', 80)], W)
  assert.equal(r.linhas.length, 1)
  const l = r.linhas[0]
  assert.equal(l.casamento, 'exato')
  assert.equal(l.pago, 110)
  assert.equal(l.horaClt, 15)
  assert.equal(l.horasImplicitas, 6)
  assert.equal(l.referencia, 70)
  assert.ok(Math.abs(l.desvio - 40 / 70) < 1e-9)
})

test('🔴 homônimo NÃO gera linha — vira pendência ambígua com os candidatos', () => {
  const r = conferirHorasExtras([he('Pedro Alves', '2026-08-03', 30)], W)
  assert.equal(r.linhas.length, 0)
  assert.equal(r.pendencias.length, 1)
  assert.equal(r.pendencias[0].motivo, 'ambiguo')
  assert.equal(r.pendencias[0].candidatos?.length, 2)
  assert.equal(r.totalConferido, 0, 'dinheiro de casamento ambíguo não conta como conferido')
})

test('provável entra marcado; sem salário e sem cadastro viram pendência', () => {
  const r = conferirHorasExtras([he('Ana B.', '2026-08-03', 15), he('Rui Costa', '2026-08-03', 15), he('Zé', '2026-08-03', 15)], W)
  assert.equal(r.linhas.length, 1)
  assert.equal(r.linhas[0].casamento, 'provavel')
  assert.deepEqual(r.pendencias.map((p) => p.motivo).sort(), ['sem-cadastro', 'sem-salario'])
  assert.equal(r.totalPago, 45)
  assert.equal(r.totalConferido, 15)
})

test('desligado não entra no casamento', () => {
  const r = conferirHorasExtras([he('Ana Beatriz Lima', '2026-08-03', 30)], [w('1', 'Ana Beatriz Lima', 2_200, 'inactive')])
  assert.equal(r.linhas.length, 0)
  assert.equal(r.pendencias[0].motivo, 'sem-cadastro')
})
