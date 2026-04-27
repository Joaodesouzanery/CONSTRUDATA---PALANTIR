import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { ResumoNucleo, ConsolidadoTrecho, MaterialItem, MaterialNucleo } from '@/data/mockPlanilhasConsolidadas'

export type DbRede = 'AG' | 'ESG'
export type DbStatus = 'exec' | 'pend' | 'cad'

export interface SuprimentosOperacionalItem {
  id: string
  nucleo: string
  rua: string
  material: string
  unidade: string
  quantidade: number
  rede: DbRede
  status: DbStatus
  kmExec: number
  kmPend: number
  auxiliares: MaterialItem[]
}

export interface SuprimentosOrdem {
  id: string
  codigo: string
  status: string
  totalItens: number
  itens: SuprimentosOperacionalItem[]
  createdAt: string
}

export interface LoadedSuprimentosPlanilhas {
  resumo: ResumoNucleo[]
  trechos: ConsolidadoTrecho[]
  materiais: MaterialNucleo[]
  operacional: SuprimentosOperacionalItem[]
  ordens: SuprimentosOrdem[]
}

export interface ImportSuprimentosPlanilhasPayload {
  resumo?: ResumoNucleo[]
  trechos?: ConsolidadoTrecho[]
  materiais?: MaterialNucleo[]
}

export interface ManualNucleoInput {
  nome: string
  tipo: DbRede
}

export interface ManualRuaInput {
  nucleoId: string
  nome: string
}

export interface ManualItemInput {
  ruaId: string
  material: string
  unidade: string
  quantidade: number
  rede: DbRede
  status: DbStatus
  kmExec: number
  kmPend: number
}

export interface ManualOptions {
  nucleos: { id: string; nome: string; tipo: DbRede }[]
  ruas: { id: string; nome: string; nucleoId: string; nucleo: string; tipo: DbRede }[]
}

type DbNucleo = {
  id: string
  organization_id: string
  nome: string
  tipo: DbRede | null
  tr_total: number | string | null
  tr_obra: number | string | null
  tr_cad: number | string | null
  tr_exec: number | string | null
  tr_pend: number | string | null
  km_obra: number | string | null
  km_exec: number | string | null
  km_pend: number | string | null
  km_cad: number | string | null
  km_real: number | string | null
  ratio: string | null
  pct_exec: number | string | null
}

type DbRua = {
  id: string
  organization_id: string
  nucleo_id: string
  nome: string
}

type DbItem = {
  id: string
  organization_id: string
  rua_id: string
  material: string
  unidade: string | null
  quantidade: number | string | null
  rede: DbRede | null
  status: DbStatus
  km_exec: number | string | null
  km_pend: number | string | null
  auxiliares: MaterialItem[] | null
  payload: Record<string, unknown> | null
}

type DbOrdem = {
  id: string
  codigo: string
  status: string
  itens: SuprimentosOperacionalItem[] | null
  total_itens: number | null
  created_at: string
}

function table(name: string) {
  return supabase.from(name as never)
}

async function context() {
  const auth = useAuth.getState()
  if (!auth.profile && auth.user) await auth.refreshProfile()

  const userId = useAuth.getState().user?.id
  const orgId = useAuth.getState().profile?.organization_id
  if (!userId || !orgId) {
    throw new Error('Organizacao nao carregada para salvar dados de Suprimentos.')
  }
  return { userId, orgId }
}

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const raw = String(v ?? '').replace(/R\$/g, '').replace(/\s/g, '').trim()
  if (!raw) return 0
  if (raw.includes(',') && raw.includes('.')) {
    const comma = raw.lastIndexOf(',')
    const dot = raw.lastIndexOf('.')
    return Number.parseFloat(comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')) || 0
  }
  return Number.parseFloat(raw.replace(',', '.')) || 0
}

function redeToDb(value: unknown): DbRede {
  const s = String(value ?? '').toUpperCase()
  return s.includes('AG') || s.includes('AGUA') || s.includes('ÁGUA') ? 'AG' : 'ESG'
}

function redeToUi(value: unknown): ResumoNucleo['tipo'] {
  return redeToDb(value) === 'AG' ? 'AGUA' : 'ESGOTO'
}

function statusToDb(value: unknown): DbStatus {
  const s = String(value ?? '').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (s.includes('exec')) return 'exec'
  if (s.includes('cad')) return 'cad'
  return 'pend'
}

function statusToUi(value: unknown): ConsolidadoTrecho['status'] {
  const status = statusToDb(value)
  if (status === 'exec') return 'EXECUTADO'
  if (status === 'cad') return 'CADASTRO'
  return 'PENDENTE'
}

function metragemKm(value: string | null | undefined): number {
  if (!value) return 0
  return num(value.replace(/[^\d,.-]/g, '')) / 1000
}

function makeRatio(kmReal: number, kmObra: number) {
  if (!kmObra) return '0.0x'
  return `${(kmReal / kmObra).toFixed(1)}x`
}

async function upsertNucleo(
  nome: string,
  tipo: DbRede,
  patch: Partial<Record<string, unknown>> = {},
  cache?: Map<string, DbNucleo>,
) {
  const { orgId, userId } = await context()
  const key = `${nome}|${tipo}`
  if (cache?.has(key) && Object.keys(patch).length === 0) return cache.get(key)!

  const { data, error } = await table('suprimentos_nucleos')
    .upsert({
      organization_id: orgId,
      nome,
      tipo,
      created_by: userId,
      ...patch,
    } as never, { onConflict: 'organization_id,nome,tipo' })
    .select('*')
    .single()

  if (error) throw error
  const row = data as unknown as DbNucleo
  cache?.set(key, row)
  return row
}

async function upsertRua(nucleo: DbNucleo, nome: string, cache?: Map<string, DbRua>) {
  const { orgId, userId } = await context()
  const key = `${nucleo.id}|${nome}`
  if (cache?.has(key)) return cache.get(key)!

  const { data, error } = await table('suprimentos_ruas')
    .upsert({
      organization_id: orgId,
      nucleo_id: nucleo.id,
      nome: nome || 'Sem Rua',
      created_by: userId,
    } as never, { onConflict: 'organization_id,nucleo_id,nome' })
    .select('*')
    .single()

  if (error) throw error
  const row = data as unknown as DbRua
  cache?.set(key, row)
  return row
}

async function upsertItem(input: {
  rua: DbRua
  material: string
  unidade?: string
  quantidade?: number
  rede: DbRede
  status?: DbStatus
  kmExec?: number
  kmPend?: number
  auxiliares?: MaterialItem[]
  payload?: Record<string, unknown>
}) {
  const { orgId, userId } = await context()
  const { data, error } = await table('suprimentos_itens')
    .upsert({
      organization_id: orgId,
      rua_id: input.rua.id,
      material: input.material || 'Item planejado',
      unidade: input.unidade || 'un',
      quantidade: input.quantidade ?? 0,
      rede: input.rede,
      status: input.status ?? 'pend',
      km_exec: input.kmExec ?? 0,
      km_pend: input.kmPend ?? 0,
      auxiliares: input.auxiliares ?? [],
      payload: input.payload ?? {},
      created_by: userId,
    } as never, { onConflict: 'organization_id,rua_id,material,rede,status' })
    .select('*')
    .single()

  if (error) throw error
  return data as unknown as DbItem
}

export async function loadSuprimentosPlanilhas(): Promise<LoadedSuprimentosPlanilhas> {
  const { orgId } = await context()

  const [{ data: nucleos, error: nError }, { data: ruas, error: rError }, { data: itens, error: iError }, { data: ordens, error: oError }] = await Promise.all([
    table('suprimentos_nucleos').select('*').eq('organization_id', orgId).is('deleted_at', null).order('nome'),
    table('suprimentos_ruas').select('*').eq('organization_id', orgId).is('deleted_at', null).order('nome'),
    table('suprimentos_itens').select('*').eq('organization_id', orgId).is('deleted_at', null).order('material'),
    table('suprimentos_ordens').select('*').eq('organization_id', orgId).is('deleted_at', null).order('created_at', { ascending: false }),
  ])

  if (nError) throw nError
  if (rError) throw rError
  if (iError) throw iError
  if (oError) throw oError

  const nRows = (nucleos ?? []) as unknown as DbNucleo[]
  const rRows = (ruas ?? []) as unknown as DbRua[]
  const iRows = (itens ?? []) as unknown as DbItem[]
  const oRows = (ordens ?? []) as unknown as DbOrdem[]

  const ruaById = new Map(rRows.map((r) => [r.id, r]))
  const nucleoById = new Map(nRows.map((n) => [n.id, n]))

  const itemByNucleo = new Map<string, DbItem[]>()
  for (const item of iRows) {
    const rua = ruaById.get(item.rua_id)
    if (!rua) continue
    const list = itemByNucleo.get(rua.nucleo_id) ?? []
    list.push(item)
    itemByNucleo.set(rua.nucleo_id, list)
  }

  const resumo: ResumoNucleo[] = nRows.map((n) => {
    const grouped = itemByNucleo.get(n.id) ?? []
    const kmExecAgg = grouped.reduce((s, i) => s + num(i.km_exec), 0)
    const kmPendAgg = grouped.reduce((s, i) => s + num(i.km_pend), 0)
    const trExecAgg = grouped.filter((i) => i.status === 'exec').length
    const trPendAgg = grouped.filter((i) => i.status === 'pend').length
    const trCadAgg = grouped.filter((i) => i.status === 'cad').length
    const kmExec = num(n.km_exec) || kmExecAgg
    const kmPend = num(n.km_pend) || kmPendAgg
    const trExec = num(n.tr_exec) || trExecAgg
    const trPend = num(n.tr_pend) || trPendAgg
    const trCad = num(n.tr_cad) || trCadAgg
    const trObra = num(n.tr_obra) || trExec + trPend
    const kmObra = num(n.km_obra) || kmExec + kmPend
    const kmReal = num(n.km_real)
    return {
      nucleo: n.nome,
      tipo: redeToUi(n.tipo),
      trTotal: num(n.tr_total) || trObra + trCad,
      trObra,
      trCad,
      trExec,
      trPend,
      kmObra,
      kmExec,
      kmPend,
      kmCad: num(n.km_cad),
      kmReal,
      ratio: n.ratio || makeRatio(kmReal, kmObra),
      pctExec: num(n.pct_exec) || (trObra > 0 ? Math.round((trExec / trObra) * 100) : 0),
    }
  })

  const operacional: SuprimentosOperacionalItem[] = iRows.map((item) => {
    const rua = ruaById.get(item.rua_id)
    const nucleo = rua ? nucleoById.get(rua.nucleo_id) : undefined
    return {
      id: item.id,
      nucleo: nucleo?.nome ?? 'Sem Nucleo',
      rua: rua?.nome ?? 'Sem Rua',
      material: item.material,
      unidade: item.unidade ?? 'un',
      quantidade: num(item.quantidade),
      rede: item.rede ?? redeToDb(nucleo?.tipo),
      status: item.status,
      kmExec: num(item.km_exec),
      kmPend: num(item.km_pend),
      auxiliares: item.auxiliares ?? [],
    }
  })

  const trechos: ConsolidadoTrecho[] = iRows.map((item, index) => {
    const rua = ruaById.get(item.rua_id)
    const nucleo = rua ? nucleoById.get(rua.nucleo_id) : undefined
    const payload = item.payload ?? {}
    const extM = num(payload.extM) || (num(item.km_exec) + num(item.km_pend)) * 1000 || num(item.quantidade)
    return {
      nucleo: nucleo?.nome ?? 'Sem Nucleo',
      tipo: redeToUi(item.rede ?? nucleo?.tipo),
      rua: rua?.nome ?? 'Sem Rua',
      ns: String(payload.ns ?? `ITEM-${String(index + 1).padStart(4, '0')}`),
      pvMont: String(payload.pvMont ?? ''),
      pvJus: payload.pvJus ? String(payload.pvJus) : null,
      dnMm: payload.dnMm == null ? null : num(payload.dnMm),
      extM,
      mat: String(payload.mat ?? item.material),
      ctMont: payload.ctMont == null ? null : num(payload.ctMont),
      ctJus: payload.ctJus == null ? null : num(payload.ctJus),
      declPml: payload.declPml == null ? null : num(payload.declPml),
      status: statusToUi(item.status),
      dataExec: payload.dataExec ? String(payload.dataExec) : null,
    }
  })

  const materialMap = new Map<string, Map<string, MaterialItem[]>>()
  for (const item of operacional) {
    const ruas = materialMap.get(item.nucleo) ?? new Map<string, MaterialItem[]>()
    const rows = ruas.get(item.rua) ?? []
    rows.push({
      id: item.id,
      material: item.material,
      un: item.unidade,
      rede: item.rede,
      qtd: item.quantidade,
      metragem: item.kmPend > 0 ? `${(item.kmPend * 1000).toFixed(1)}m` : null,
      isSubItem: false,
      status: item.status,
      kmExec: item.kmExec,
      kmPend: item.kmPend,
      auxiliares: item.auxiliares,
    })
    for (const aux of item.auxiliares) rows.push({ ...aux, isSubItem: true })
    ruas.set(item.rua, rows)
    materialMap.set(item.nucleo, ruas)
  }

  const materiais: MaterialNucleo[] = [...materialMap.entries()].map(([nucleo, ruaMap]) => ({
    nucleo,
    ruas: [...ruaMap.entries()].map(([rua, items]) => ({ rua, items })),
  }))

  return {
    resumo,
    trechos,
    materiais,
    operacional,
    ordens: oRows.map((o) => ({
      id: o.id,
      codigo: o.codigo,
      status: o.status,
      totalItens: o.total_itens ?? o.itens?.length ?? 0,
      itens: o.itens ?? [],
      createdAt: o.created_at,
    })),
  }
}

export async function importSuprimentosPlanilhas(payload: ImportSuprimentosPlanilhasPayload) {
  const nucleoCache = new Map<string, DbNucleo>()
  const ruaCache = new Map<string, DbRua>()

  for (const r of payload.resumo ?? []) {
    await upsertNucleo(r.nucleo, redeToDb(r.tipo), {
      tr_total: r.trTotal,
      tr_obra: r.trObra,
      tr_cad: r.trCad,
      tr_exec: r.trExec,
      tr_pend: r.trPend,
      km_obra: r.kmObra,
      km_exec: r.kmExec,
      km_pend: r.kmPend,
      km_cad: r.kmCad,
      km_real: r.kmReal,
      ratio: r.ratio,
      pct_exec: r.pctExec,
    }, nucleoCache)
  }

  for (const trecho of payload.trechos ?? []) {
    const rede = redeToDb(trecho.tipo)
    const status = statusToDb(trecho.status)
    const nucleo = await upsertNucleo(trecho.nucleo, rede, {}, nucleoCache)
    const rua = await upsertRua(nucleo, trecho.rua || 'Sem Rua', ruaCache)
    await upsertItem({
      rua,
      material: trecho.mat || `Trecho ${trecho.ns}`,
      unidade: 'm',
      quantidade: trecho.extM,
      rede,
      status,
      kmExec: status === 'exec' ? trecho.extM / 1000 : 0,
      kmPend: status === 'pend' ? trecho.extM / 1000 : 0,
      payload: {
        source: 'consolidado',
        ns: trecho.ns,
        pvMont: trecho.pvMont,
        pvJus: trecho.pvJus,
        dnMm: trecho.dnMm,
        extM: trecho.extM,
        mat: trecho.mat,
        ctMont: trecho.ctMont,
        ctJus: trecho.ctJus,
        declPml: trecho.declPml,
        dataExec: trecho.dataExec,
      },
    })
  }

  for (const nucleoGroup of payload.materiais ?? []) {
    for (const ruaGroup of nucleoGroup.ruas) {
      let current: MaterialItem | null = null
      let auxiliares: MaterialItem[] = []

      async function flush() {
        if (!current) return
        const rede = redeToDb(current.rede)
        const nucleo = await upsertNucleo(nucleoGroup.nucleo, rede, {}, nucleoCache)
        const rua = await upsertRua(nucleo, ruaGroup.rua || 'Sem Rua', ruaCache)
        await upsertItem({
          rua,
          material: current.material,
          unidade: current.un,
          quantidade: current.qtd,
          rede,
          status: 'pend',
          kmPend: metragemKm(current.metragem),
          auxiliares,
          payload: { source: 'materiais_pendentes', metragem: current.metragem },
        })
      }

      for (const item of ruaGroup.items) {
        const isAux = item.isSubItem || !item.rede || item.material.trim().startsWith('•')
        if (isAux) {
          auxiliares.push({ ...item, isSubItem: true })
          continue
        }
        await flush()
        current = item
        auxiliares = []
      }
      await flush()
    }
  }

  return loadSuprimentosPlanilhas()
}

export async function createManualNucleo(input: ManualNucleoInput) {
  return upsertNucleo(input.nome.trim(), input.tipo)
}

export async function loadManualOptions(): Promise<ManualOptions> {
  const { orgId } = await context()
  const [{ data: nucleos, error: nError }, { data: ruas, error: rError }] = await Promise.all([
    table('suprimentos_nucleos').select('*').eq('organization_id', orgId).is('deleted_at', null).order('nome'),
    table('suprimentos_ruas').select('*').eq('organization_id', orgId).is('deleted_at', null).order('nome'),
  ])
  if (nError) throw nError
  if (rError) throw rError
  const nRows = (nucleos ?? []) as unknown as DbNucleo[]
  const rRows = (ruas ?? []) as unknown as DbRua[]
  const byId = new Map(nRows.map((n) => [n.id, n]))
  return {
    nucleos: nRows.map((n) => ({ id: n.id, nome: n.nome, tipo: redeToDb(n.tipo) })),
    ruas: rRows.map((r) => {
      const nucleo = byId.get(r.nucleo_id)
      return {
        id: r.id,
        nome: r.nome,
        nucleoId: r.nucleo_id,
        nucleo: nucleo?.nome ?? 'Sem Nucleo',
        tipo: redeToDb(nucleo?.tipo),
      }
    }),
  }
}

export async function createManualRua(input: ManualRuaInput) {
  const { orgId } = await context()
  const { data: nucleo, error } = await table('suprimentos_nucleos')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', input.nucleoId)
    .single()
  if (error) throw error
  return upsertRua(nucleo as unknown as DbNucleo, input.nome.trim())
}

export async function createManualItem(input: ManualItemInput) {
  const { orgId } = await context()
  const { data: rua, error } = await table('suprimentos_ruas')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', input.ruaId)
    .single()
  if (error) throw error
  await upsertItem({
    rua: rua as unknown as DbRua,
    material: input.material.trim(),
    unidade: input.unidade.trim() || 'un',
    quantidade: input.quantidade,
    rede: input.rede,
    status: input.status,
    kmExec: input.kmExec,
    kmPend: input.kmPend,
    payload: { source: 'manual' },
  })
  return loadSuprimentosPlanilhas()
}

export async function createSuprimentosOrdem(itemIds: string[]) {
  if (itemIds.length === 0) throw new Error('Selecione ao menos um item para gerar a ordem de compra.')
  const { orgId, userId } = await context()
  const snapshot = await loadSuprimentosPlanilhas()
  const selected = snapshot.operacional.filter((item) => itemIds.includes(item.id))
  if (selected.length === 0) throw new Error('Itens selecionados nao encontrados no Supabase.')

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const codigo = `OC-SUP-${today}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const { error } = await table('suprimentos_ordens')
    .insert({
      organization_id: orgId,
      codigo,
      status: 'aberta',
      itens: selected,
      total_itens: selected.length,
      created_by: userId,
    } as never)

  if (error) throw error
  return loadSuprimentosPlanilhas()
}
