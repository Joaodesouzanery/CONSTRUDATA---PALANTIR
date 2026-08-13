import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useAppModeStore } from '@/store/appModeStore'
import {
  normalizarDefinicaoProcesso,
  normalizarEventoProcesso,
  type DefinicaoProcesso,
  type EventoProcesso,
  type LinhaDefinicaoProcesso,
  type LinhaEventoProcesso,
  type LinhaSnapshotDescoberta,
  type ObjetoJson,
  type ResultadoDescoberta,
  type ResumoCasoProcesso,
} from './core/index.ts'
import { DEMO_PROCESSOS } from './demo/fixture.ts'

export interface SnapshotProcessos {
  id: string
  definitionVersion: number
  algorithmKey: string
  algorithmVersion: string
  inputChecksum: string
  generatedAt: string
  result: ResultadoDescoberta
}

interface LinhaResumoCasoBanco {
  organization_id: string
  process_definition_id: string
  case_id: string
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  event_count: number
  activity_count: number
  variant_key: string
  has_loop: boolean
  has_rework: boolean
  has_deviation: boolean
  has_anomaly: boolean
  has_possible_concurrency: boolean
  terminal_lifecycle: EventoProcesso['lifecycle']
  metadata_summary: ObjetoJson
}

function normalizarResumo(row: LinhaResumoCasoBanco): ResumoCasoProcesso {
  return {
    organizationId: row.organization_id,
    processDefinitionId: row.process_definition_id,
    caseId: row.case_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    eventCount: row.event_count,
    activityCount: row.activity_count,
    variantKey: row.variant_key,
    hasLoop: row.has_loop,
    hasRework: row.has_rework,
    hasDeviation: row.has_deviation,
    hasAnomaly: row.has_anomaly,
    hasPossibleConcurrency: row.has_possible_concurrency,
    terminalLifecycle: row.terminal_lifecycle,
    metadataSummary: row.metadata_summary,
  }
}

export function useDadosProcessos() {
  const isDemoMode = useAppModeStore((state) => state.isDemoMode)
  const organizationId = useAuth((state) => state.profile?.organization_id ?? null)
  const [definitions, setDefinitions] = useState<DefinicaoProcesso[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotProcessos[]>([])
  const [selectedDefinitionId, setSelectedDefinitionId] = useState('')
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('')
  const [caseSummaries, setCaseSummaries] = useState<ResumoCasoProcesso[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [caseEvents, setCaseEvents] = useState<EventoProcesso[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalCases, setTotalCases] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedScope, setLoadedScope] = useState<string | null>(null)
  const pageSize = 25

  useEffect(() => {
    let active = true
    if (isDemoMode) {
      const demoSnapshot: SnapshotProcessos = {
        id: 'demo-local',
        definitionVersion: DEMO_PROCESSOS.definition.version,
        algorithmKey: DEMO_PROCESSOS.result.algorithmKey,
        algorithmVersion: DEMO_PROCESSOS.result.algorithmVersion,
        inputChecksum: DEMO_PROCESSOS.result.input.inputChecksum,
        generatedAt: '2026-08-13T00:00:00.000Z',
        result: DEMO_PROCESSOS.result,
      }
      queueMicrotask(() => {
        if (!active) return
        setDefinitions([DEMO_PROCESSOS.definition])
        setSnapshots([demoSnapshot])
        setCaseSummaries([])
        setCaseEvents([])
        setSelectedDefinitionId(DEMO_PROCESSOS.definition.id)
        setSelectedSnapshotId(demoSnapshot.id)
        setSelectedCaseId('')
        setPage(0)
        setError(null)
        setLoadedScope('demo')
        setLoading(false)
      })
      return () => { active = false }
    }
    if (!organizationId) {
      queueMicrotask(() => {
        if (!active) return
        setDefinitions([])
        setSnapshots([])
        setCaseSummaries([])
        setCaseEvents([])
        setSelectedDefinitionId('')
        setSelectedSnapshotId('')
        setSelectedCaseId('')
        setLoadedScope(null)
        setLoading(false)
      })
      return () => { active = false }
    }
    queueMicrotask(() => {
      if (!active) return
      setDefinitions([])
      setSnapshots([])
      setCaseSummaries([])
      setCaseEvents([])
      setSelectedDefinitionId('')
      setSelectedSnapshotId('')
      setSelectedCaseId('')
      setPage(0)
      setError(null)
      setLoadedScope(null)
      setLoading(true)
    })
    void supabase
      .from('process_definitions')
      .select('id, organization_id, process_key, version, name, description, timezone, case_object_type, source_mappings, feature_mappings, process_model, objective, kpi_definitions, sla_definitions')
      .eq('organization_id', organizationId)
      .order('name')
      .order('version', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) setError(queryError.message)
        const values = (data ?? []).map((row) => normalizarDefinicaoProcesso(row as LinhaDefinicaoProcesso))
        setDefinitions(values)
        setSelectedDefinitionId(values[0]?.id ?? '')
        setLoadedScope(organizationId)
        setLoading(false)
      })
    return () => { active = false }
  }, [isDemoMode, organizationId])

  useEffect(() => {
    let active = true
    if (isDemoMode || !organizationId || !selectedDefinitionId) return () => { active = false }
    queueMicrotask(() => {
      if (!active) return
      setSnapshots([])
      setSelectedSnapshotId('')
      setLoading(true)
    })
    void supabase
      .from('process_discovery_snapshots')
      .select('id, organization_id, process_definition_id, definition_version, algorithm_key, algorithm_version, input_checksum, parameters, parameters_checksum, status, result_schema_version, result, input_event_count, input_case_count, started_at, completed_at, generated_at, error_code, error_message')
      .eq('organization_id', organizationId)
      .eq('process_definition_id', selectedDefinitionId)
      .eq('status', 'ready')
      .order('generated_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) setError(queryError.message)
        const values = (data ?? []).map((raw) => {
          const row = raw as LinhaSnapshotDescoberta
          return {
            id: row.id,
            definitionVersion: row.definition_version,
            algorithmKey: row.algorithm_key,
            algorithmVersion: row.algorithm_version,
            inputChecksum: row.input_checksum,
            generatedAt: row.generated_at ?? row.started_at,
            result: row.result!,
          }
        })
        setSnapshots(values)
        setSelectedSnapshotId(values[0]?.id ?? '')
        setLoading(false)
      })
    return () => { active = false }
  }, [isDemoMode, organizationId, selectedDefinitionId])

  useEffect(() => {
    let active = true
    if (!selectedSnapshotId) return () => { active = false }
    if (isDemoMode) {
      const normalizedSearch = search.trim().toLowerCase()
      const filtered = DEMO_PROCESSOS.cases
        .map(({ summary }) => summary)
        .filter(({ caseId }) => caseId.toLowerCase().includes(normalizedSearch))
      queueMicrotask(() => {
        if (!active) return
        setSelectedCaseId('')
        setCaseEvents([])
        setTotalCases(filtered.length)
        setCaseSummaries(filtered.slice(page * pageSize, (page + 1) * pageSize))
      })
      return () => { active = false }
    }
    if (!organizationId) return () => { active = false }
    queueMicrotask(() => {
      if (!active) return
      setCaseSummaries([])
      setSelectedCaseId('')
      setCaseEvents([])
      setLoading(true)
    })
    let query = supabase
      .from('process_case_summaries')
      .select('organization_id, process_definition_id, case_id, started_at, ended_at, duration_ms, event_count, activity_count, variant_key, has_loop, has_rework, has_deviation, has_anomaly, has_possible_concurrency, terminal_lifecycle, metadata_summary', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('snapshot_id', selectedSnapshotId)
      .order('started_at', { ascending: false })
      .order('case_id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (search.trim()) query = query.ilike('case_id', `%${search.trim()}%`)
    void query.then(({ data, count, error: queryError }) => {
      if (!active) return
      if (queryError) setError(queryError.message)
      setCaseSummaries((data ?? []).map((row) => normalizarResumo(row as LinhaResumoCasoBanco)))
      setTotalCases(count ?? 0)
      setLoading(false)
    })
    return () => { active = false }
  }, [isDemoMode, organizationId, page, search, selectedSnapshotId])

  const selecionarCaso = useCallback((caseId: string) => {
    setSelectedCaseId(caseId)
    setCaseEvents([])
    if (isDemoMode) {
      setCaseEvents(DEMO_PROCESSOS.cases.find(({ summary }) => summary.caseId === caseId)?.events ?? [])
      return
    }
    if (!organizationId || !selectedDefinitionId) return
    void supabase
      .from('process_events')
      .select('event_id, event_schema_version, organization_id, process_definition_id, case_id, activity, lifecycle, occurred_at, sequence_number, actor_id, object_type, object_id, source_system, source_event_id, metadata')
      .eq('organization_id', organizationId)
      .eq('process_definition_id', selectedDefinitionId)
      .eq('case_id', caseId)
      .order('occurred_at', { ascending: true })
      .order('sequence_number', { ascending: true, nullsFirst: false })
      .order('event_id', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (queryError) setError(queryError.message)
        setCaseEvents((data ?? []).map((row) => normalizarEventoProcesso(row as LinhaEventoProcesso)))
      })
  }, [isDemoMode, organizationId, selectedDefinitionId])

  const expectedScope = isDemoMode ? 'demo' : organizationId
  const scopeMatches = loadedScope !== null && loadedScope === expectedScope
  const visibleDefinitions = scopeMatches ? definitions : []
  const visibleSnapshots = scopeMatches ? snapshots : []
  const selectedDefinition = visibleDefinitions.find(({ id }) => id === selectedDefinitionId) ?? null
  const selectedSnapshot = visibleSnapshots.find(({ id }) => id === selectedSnapshotId) ?? null

  return {
    isDemoMode,
    definitions: visibleDefinitions,
    snapshots: visibleSnapshots,
    selectedDefinition,
    selectedSnapshot,
    selectedDefinitionId,
    selectedSnapshotId,
    setSelectedDefinitionId,
    setSelectedSnapshotId,
    caseSummaries: scopeMatches ? caseSummaries : [],
    selectedCaseId,
    caseEvents: scopeMatches ? caseEvents : [],
    selecionarCaso,
    search,
    setSearch: (value: string) => { setSearch(value); setPage(0) },
    page,
    setPage,
    pageSize,
    totalCases: scopeMatches ? totalCases : 0,
    loading,
    error,
  }
}
