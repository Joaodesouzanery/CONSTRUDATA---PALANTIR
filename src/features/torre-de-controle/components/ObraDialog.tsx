import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Trash2, AlertTriangle, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTorreStore } from '@/store/torreDeControleStore'
import { bacVemDoContrato } from '@/features/torre-de-controle/utils/obraBudget'
import { valoresDoContrato, precoMedioM2 } from '@/features/torre-de-controle/utils/obraMedicao'
import { useProjetosStore } from '@/store/projetosStore'
import { siteSchema, type SiteFormValues } from '../schemas'
import type { ObraStatus, ConstructionSite } from '@/types'

const STATUS_OPTIONS: Array<{ value: ObraStatus; label: string }> = [
  { value: 'active',    label: 'Ativa' },
  { value: 'planning',  label: 'Planejamento' },
  { value: 'paused',    label: 'Pausada' },
  { value: 'completed', label: 'Concluída' },
]

function blankDefaults(): SiteFormValues {
  return {
    code: '', name: '', company: '', owner: '', manager: '',
    description: '', status: 'active', projectId: '',
    street: '', number: '', district: '', city: '', state: '', cep: '',
    buildingType: '', totalArea: 0, floors: 0,
    numeroContrato: '', orcamentoBRL: 0, precoM2: 0,
    startDate: '', expectedEnd: '',
    lat: '', lng: '', raioPontoM: '',
  }
}

export function ObraDialog() {
  const sites      = useTorreStore((s) => s.sites)
  const editingId  = useTorreStore((s) => s.editingId)
  const setEditing = useTorreStore((s) => s.setEditing)
  const addSite    = useTorreStore((s) => s.addSite)
  const updateSite = useTorreStore((s) => s.updateSite)
  const deleteSite = useTorreStore((s) => s.deleteSite)
  const projects   = useProjetosStore((s) => s.projects)

  const [confirmDelete, setConfirmDelete] = useState(false)

  const isNew    = editingId === 'new'
  const existing = isNew ? null : sites.find((s) => s.id === editingId) ?? null
  // Com contrato cadastrado, o valor da obra tem UM dono: o card CONTRATO.
  const temContrato = bacVemDoContrato(existing)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SiteFormValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: blankDefaults(),
  })

  useEffect(() => {
    if (existing) {
      reset({
        code:         existing.code,
        name:         existing.name,
        company:      existing.company,
        owner:        existing.owner,
        manager:      existing.manager,
        description:  existing.description ?? '',
        status:       existing.status,
        projectId:    existing.projectId ?? '',
        street:       existing.street,
        number:       existing.number,
        district:     existing.district,
        city:         existing.city,
        state:        existing.state,
        cep:          existing.cep,
        buildingType: existing.buildingType,
        totalArea:    existing.totalArea,
        floors:       existing.floors,
        numeroContrato: existing.numeroContrato ?? '',
        orcamentoBRL: existing.orcamentoBRL ?? 0,
        precoM2:      existing.precoM2 ?? 0,
        startDate:    existing.startDate,
        expectedEnd:  existing.expectedEnd,
        lat:          existing.lat  != null ? String(existing.lat)  : '',
        lng:          existing.lng  != null ? String(existing.lng)  : '',
        raioPontoM:   existing.raioPontoM != null ? String(existing.raioPontoM) : '',
      })
    } else if (isNew) {
      reset(blankDefaults())
    }
    // ⚠️ A dependência é o `editingId`, NÃO o objeto `existing`.
    //
    // `existing` sai de `sites.find(...)` — um objeto NOVO a cada pull. Com ele na lista, qualquer
    // sincronização (a periódica, ou a de um colega salvando outra obra) reexecutava o `reset` e
    // jogava fora o que o usuário estava digitando, no meio da digitação. Quem preenche uma obra
    // com 25 campos perde tudo sem entender o motivo.
    //
    // Semear o formulário UMA vez por registro é o correto: `existing` continua sendo lido dentro
    // do efeito, então o valor não fica velho — só não dispara de novo. É o mesmo padrão que o
    // `ContratoCard` usa com `obraId`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, isNew, reset])

  const close = useCallback(() => {
    setEditing(null)
    setConfirmDelete(false)
  }, [setEditing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  function onSubmit(values: SiteFormValues) {
    // Parse coords com defesa contra NaN: string vazia → null, valor inválido → null
    const parsedLat = values.lat ? Number(values.lat) : null
    const parsedLng = values.lng ? Number(values.lng) : null
    const lat = parsedLat !== null && Number.isFinite(parsedLat) ? parsedLat : null
    const lng = parsedLng !== null && Number.isFinite(parsedLng) ? parsedLng : null
    // ⚠️ Vazio vira `undefined` (usa o padrão da empresa), NUNCA 0 — raio zero bloquearia todo
    // mundo, inclusive quem está dentro do canteiro.
    const parsedRaio = values.raioPontoM ? Number(values.raioPontoM) : NaN
    const raioPontoM = Number.isFinite(parsedRaio) && parsedRaio > 0 ? parsedRaio : undefined
    const payload = {
      ...values,
      code: values.code?.trim() || `OBR-${String(sites.length + 1).padStart(3, '0')}`,
      company: values.company ?? '',
      owner: values.owner ?? '',
      manager: values.manager ?? '',
      street: values.street ?? '',
      number: values.number ?? '',
      district: values.district ?? '',
      city: values.city ?? '',
      state: values.state ?? '',
      buildingType: values.buildingType ?? '',
      description: values.description ?? '',
      numeroContrato: values.numeroContrato?.trim() || undefined,
      // Zero significa "não informado": guardar 0 faria o RDO calcular faturamento zerado em vez
      // de cair no fallback do Plano de Execução.
      orcamentoBRL: values.orcamentoBRL && values.orcamentoBRL > 0 ? values.orcamentoBRL : undefined,
      precoM2: values.precoM2 && values.precoM2 > 0 ? values.precoM2 : undefined,
      serviceScope: values.buildingType ?? '',
      projectId: values.projectId || null,
      lat,
      lng,
      raioPontoM,
      risks: existing?.risks ?? [],
    }

    if (isNew) {
      addSite(payload)
    } else if (existing) {
      updateSite(existing.id, { ...payload })
    }
    close()
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (existing) deleteSite(existing.id)
    close()
  }

  if (!editingId) return null

  return (
    <div
      className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-[#525252] shrink-0">
          <h2 className="text-[#f5f5f5] font-bold text-base">
            {isNew ? 'Nova Obra' : `Editar — ${existing?.name ?? ''}`}
          </h2>
          <button onClick={close} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5" style={{ maxHeight: '72vh' }}>

            {/* Identificação */}
            <Section title="Identificação">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Código" error={errors.code?.message}>
                  <input {...register('code')} placeholder="OBR-001" className={inp(!!errors.code)} />
                </Field>
                <Field label="Status" error={errors.status?.message}>
                  <select {...register('status')} className={inp(!!errors.status)}>
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Nome da Obra *" error={errors.name?.message}>
                <input {...register('name')} placeholder="Setor de Saneamento Norte" className={inp(!!errors.name)} />
              </Field>
              <Field label="Projeto vinculado" error={errors.projectId?.message}>
                <select {...register('projectId')} className={inp(!!errors.projectId)}>
                  <option value="">— Nenhum (sem vínculo) —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p className="text-[11px] text-[#a3a3a3] mt-1">Liga a obra a um Projeto — ao selecioná-la no topo, EVM/Aditivos passam a focar nesse projeto.</p>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Tipo / Escopo da Obra" error={errors.buildingType?.message}>
                  <input
                    {...register('buildingType')}
                    list="obra-scope-options"
                    placeholder="Água, esgoto, drenagem, infraestrutura..."
                    className={inp(!!errors.buildingType)}
                  />
                  <datalist id="obra-scope-options">
                    <option value="Rede de água" />
                    <option value="Rede de esgoto" />
                    <option value="Drenagem" />
                    <option value="Saneamento integrado" />
                    <option value="Infraestrutura viária" />
                    <option value="Edificação" />
                    <option value="Torre Comercial" />
                    <option value="Outro" />
                  </datalist>
                </Field>
                {/* Contrato — os três campos que o RDO lê. `numeroContrato` e o orçamento já eram
                    lidos lá e não tinham onde ser cadastrados; o preço/m² só existia no Plano de
                    Execução, e a obra passa a ser a fonte da verdade. */}
                <Field label="Nº do contrato" error={errors.numeroContrato?.message}>
                  <input {...register('numeroContrato')} placeholder="CT-2026-000" className={inp(!!errors.numeroContrato)} />
                </Field>
                {/* Valor da obra: UM lugar por vez.
                    Com contrato cadastrado, estes dois campos viram leitura e apontam para o card
                    CONTRATO. Antes eles continuavam editáveis, e existiam dois lugares dizendo
                    quanto a obra vale — foi o cliente quem percebeu: "é o R$ 607.620 acontecendo
                    de novo". A trava (`bacVemDoContrato`) estava escrita desde 23/08 e nunca havia
                    sido ligada em lugar nenhum. */}
                {temContrato ? (
                  <ValorVemDoContrato site={existing!} />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Preço por m² (R$)" error={errors.precoM2?.message}>
                      <input type="number" min="0" step="0.01" {...register('precoM2', { setValueAs: (v) => v === '' || Number.isNaN(Number(v)) ? 0 : Number(v) })} placeholder="0,00" className={inp(!!errors.precoM2)} />
                    </Field>
                    <Field label="Orçamento contratado (R$)" error={errors.orcamentoBRL?.message}>
                      <input type="number" min="0" step="0.01" {...register('orcamentoBRL', { setValueAs: (v) => v === '' || Number.isNaN(Number(v)) ? 0 : Number(v) })} placeholder="0,00" className={inp(!!errors.orcamentoBRL)} />
                    </Field>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Área / Extensão" error={errors.totalArea?.message}>
                    <input type="number" min="0" {...register('totalArea', { setValueAs: (value) => value === '' || Number.isNaN(Number(value)) ? 0 : Number(value) })} placeholder="0" className={inp(!!errors.totalArea)} />
                  </Field>
                  <Field label="Pavimentos / Frentes" error={errors.floors?.message}>
                    <input type="number" min="0" {...register('floors', { setValueAs: (value) => value === '' || Number.isNaN(Number(value)) ? 0 : Number(value) })} placeholder="0" className={inp(!!errors.floors)} />
                  </Field>
                </div>
              </div>
            </Section>

            {/* Responsáveis */}
            <Section title="Responsáveis">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Empresa" error={errors.company?.message}>
                  <input {...register('company')} placeholder="Construtora" className={inp(!!errors.company)} />
                </Field>
                <Field label="Dono / Contratante" error={errors.owner?.message}>
                  <input {...register('owner')} placeholder="Nome ou empresa" className={inp(!!errors.owner)} />
                </Field>
                <Field label="Gerente" error={errors.manager?.message}>
                  <input {...register('manager')} placeholder="Nome do gerente" className={inp(!!errors.manager)} />
                </Field>
              </div>
            </Section>

            {/* Endereço */}
            <Section title="Endereço">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="Rua / Avenida / Referência" error={errors.street?.message}>
                    <input {...register('street')} placeholder="Setor, bairro, eixo ou referência" className={inp(!!errors.street)} />
                  </Field>
                </div>
                <Field label="Número" error={errors.number?.message}>
                  <input {...register('number')} placeholder="1578" className={inp(!!errors.number)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Bairro / Setor" error={errors.district?.message}>
                  <input {...register('district')} placeholder="Bela Vista" className={inp(!!errors.district)} />
                </Field>
                <Field label="Cidade" error={errors.city?.message}>
                  <input {...register('city')} placeholder="São Paulo" className={inp(!!errors.city)} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Estado" error={errors.state?.message}>
                    <input {...register('state')} placeholder="SP" maxLength={2} className={inp(!!errors.state)} />
                  </Field>
                  <Field label="CEP" error={errors.cep?.message}>
                    <input {...register('cep')} placeholder="01310-200" className={inp(!!errors.cep)} />
                  </Field>
                </div>
              </div>
            </Section>

            {/* Cronograma */}
            <Section title="Cronograma">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Data de Inicio" error={errors.startDate?.message}>
                  <input type="date" {...register('startDate')} className={inp(!!errors.startDate)} />
                </Field>
                <Field label="Previsao de Termino" error={errors.expectedEnd?.message}>
                  <input type="date" {...register('expectedEnd')} className={inp(!!errors.expectedEnd)} />
                </Field>
              </div>
            </Section>

            {/* Localização */}
            <Section title={<span className="flex items-center gap-1.5"><MapPin size={9} />Coordenadas no Mapa</span>}>
              <p className="text-[11px] text-[#a3a3a3] -mt-1">
                Preencha para posicionar o marcador no mapa. Pode ser ajustado arrastando o marcador depois.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Latitude" error={errors.lat?.message as string | undefined}>
                  <input type="number" step="any" {...register('lat')} placeholder="-23.5649" className={inp(!!errors.lat)} />
                </Field>
                <Field label="Longitude" error={errors.lng?.message as string | undefined}>
                  <input type="number" step="any" {...register('lng')} placeholder="-46.6527" className={inp(!!errors.lng)} />
                </Field>
              </div>

              {/* ─── A cerca do ponto ───────────────────────────────────────────────────────
                  ⚠️ O campo NÃO EXISTIA. `ConstructionSite.raioPontoM` era lido pela tela de bater
                  ponto e nenhum formulário o gravava — na prática a cerca era sempre 5 km, e o
                  próprio comentário do tipo prometia "onde for canteiro, baixe para algumas
                  centenas de metros". Não havia onde. */}
              <Field
                label="Raio da cerca do ponto (m)"
                error={errors.raioPontoM?.message as string | undefined}
              >
                <input
                  type="number" step="50" min="50" max="50000" {...register('raioPontoM')}
                  placeholder="5000" className={inp(!!errors.raioPontoM)}
                />
              </Field>
              <p className="-mt-1 text-[11px] leading-4 text-[#a3a3a3]">
                Distância máxima da obra em que o funcionário consegue bater o ponto. Em branco usa
                o padrão da empresa (5 km). ⚠️ Abaixo de umas poucas centenas de metros, o erro
                normal do GPS de celular passa a recusar quem está no canteiro — e aí toda batida
                cai na justificativa obrigatória.
              </p>
            </Section>

            {/* Descrição */}
            <Section title="Descrição">
              <Field label="Descrição do Projeto" error={errors.description?.message}>
                <textarea {...register('description')} rows={3} placeholder="Descreva o projeto, objetivos e escopo da obra" className={cn(inp(!!errors.description), 'resize-none')} />
              </Field>
            </Section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-t border-[#525252] shrink-0">
            {!isNew ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-[#ef4444]" />
                  <span className="text-xs text-[#ef4444]">Confirmar exclusão?</span>
                  <button type="button" onClick={handleDelete} className="text-xs px-2 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 font-semibold">Sim</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded bg-[#484848] text-[#a3a3a3] hover:bg-[#525252]">Não</button>
                </div>
              ) : (
                <button type="button" onClick={handleDelete} className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#ef4444] transition-colors">
                  <Trash2 size={13} />Excluir Obra
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-2">
              <button type="button" onClick={close} className="px-4 py-2 rounded-lg border border-[#525252] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors">Cancelar</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] transition-colors">
                {isNew ? 'Adicionar Obra' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * O valor da obra quando ele vem do contrato — leitura, com o caminho para editar.
 *
 * O preço por m² aqui é **derivado** (valor ÷ área), não digitado. Antes eram três campos que não
 * se falavam: nesta obra o cliente tinha preço 0, área 0 e orçamento 12.000. E é uma MÉDIA: no
 * contrato real há quatro preços diferentes (R$ 28,94 · 27,65 · 8,75 · 28,70) e a média ponderada
 * não é nenhum deles — por isso a tela diz isso em vez de fingir precisão.
 */
function ValorVemDoContrato({ site }: { site: ConstructionSite }) {
  const v = valoresDoContrato(site.contrato)
  const medio = precoMedioM2(site.contrato?.services ?? [])
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[11px] uppercase tracking-widest text-[#a3a3a3]">Valor da obra</span>
          <strong className="font-mono text-sm text-[#f5f5f5]">{brl(v.total)}</strong>
        </span>
        {v.material > 0 && (
          <span className="text-[11px] text-[#a3a3a3]">
            serviço {brl(v.servico)} · material {brl(v.material)}
          </span>
        )}
        {medio != null && (
          <span className="text-[11px] text-[#a3a3a3]">
            média {medio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 4 })}/m²
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-[#d4d4d4]">
        Vem do card <b>Contrato</b>, nos Detalhes da Obra — é lá que se edita. O preço por m² é
        calculado (valor ÷ área) e é uma média: cada serviço tem o preço dele.
      </p>
    </div>
  )
}

function inp(hasError: boolean) {
  return cn(
    // Placeholder `#9a9a9a` = 4,96:1 sobre o `#2c2c2c` do campo — medido, não estimado. O antigo
    // `#6b6b6b` dava 2,4:1 e era ele que pintava os 24 campos deste modal do cinza que o cliente
    // reclamou. Continua bem mais fraco que o valor digitado (`#f5f5f5`, 11,6:1), que é a função
    // do placeholder — só que agora legível.
    'w-full bg-[#2c2c2c] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#9a9a9a] transition-colors',
    hasError ? 'border-[#ef4444] focus:border-[#ef4444]' : 'border-[#525252] focus:border-[#f97316]'
  )
}

function Field({ label, error, children }: { label: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-widest text-[#a3a3a3] font-semibold">{label}</label>
      {children}
      {error && <span className="text-[11px] text-[#ef4444]">{error}</span>}
    </div>
  )
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-[11px] uppercase tracking-widest text-[#a3a3a3] font-semibold mb-0.5 w-full pb-1 border-b border-[#525252]">{title}</legend>
      {children}
    </fieldset>
  )
}



