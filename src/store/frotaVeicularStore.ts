/**
 * frotaVeicularStore.ts — operational fleet management.
 * Sprint 5: migrado para Supabase via storeSync (9 sub-entidades, 9 tabelas).
 *
 * Security:
 *  - All IDs via crypto.randomUUID()
 *  - CPF/license numbers stored only in masked form (never raw)
 *  - Exclusão = soft delete (`deleted_at`) gravado direto; a RLS das 9 tabelas
 *    bloqueia DELETE físico e o SELECT já filtra `deleted_at IS NULL`.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type {
  Vehicle,
  FuelRecord,
  VehicleMaintenanceRecord,
  VehicleDriver,
  VehicleRoute,
  VehicleServiceOrder,
  VehicleFine,
  FleetMaintenanceAlert,
  FleetScheduleEntry,
} from '@/types'
import {
  MOCK_VEHICLES,
  MOCK_VEHICLE_DRIVERS,
  MOCK_FUEL_RECORDS,
  MOCK_MAINTENANCE,
  MOCK_VEHICLE_ROUTES,
  MOCK_SERVICE_ORDERS,
  MOCK_VEHICLE_FINES,
  MOCK_FLEET_ALERTS,
  MOCK_FLEET_SCHEDULES,
} from '@/data/mockFrotaVeicular'

// ─── Mappers ──────────────────────────────────────────────────────────────────
function vehicleToRow(v: Vehicle, orgId: string, userId: string) {
  return {
    id: v.id, organization_id: orgId, project_id: null,
    plate: v.plate, make: v.make, model: v.model,
    status: v.status ?? 'active', current_km: v.currentKm,
    payload: v as unknown as Record<string, unknown>, created_by: userId,
  }
}
function driverToRow(d: VehicleDriver, orgId: string, userId: string) {
  return {
    id: d.id, organization_id: orgId,
    name: d.name, cpf_masked: d.cpfMasked, license_number: d.licenseNumber,
    license_expiry: d.licenseExpiry, status: d.status ?? 'active',
    payload: d as unknown as Record<string, unknown>, created_by: userId,
  }
}
function fuelToRow(r: FuelRecord, orgId: string, userId: string) {
  return {
    id: r.id, organization_id: orgId,
    vehicle_id: r.vehicleId, date: r.date, liters: r.liters, total_cost: r.totalCost,
    payload: r as unknown as Record<string, unknown>, created_by: userId,
  }
}
function vehMaintToRow(m: VehicleMaintenanceRecord, orgId: string, userId: string) {
  return {
    id: m.id, organization_id: orgId,
    vehicle_id: m.vehicleId, service_date: m.serviceDate, next_service_date: m.nextServiceDate,
    status: m.status,
    payload: m as unknown as Record<string, unknown>, created_by: userId,
  }
}
function routeToRow(r: VehicleRoute, orgId: string, userId: string) {
  return {
    id: r.id, organization_id: orgId,
    vehicle_id: r.vehicleId, driver_id: r.driverId, date: r.date, status: r.status,
    payload: r as unknown as Record<string, unknown>, created_by: userId,
  }
}
function serviceOrderToRow(o: VehicleServiceOrder, orgId: string, userId: string) {
  return {
    id: o.id, organization_id: orgId,
    vehicle_id: o.vehicleId, code: o.code, status: o.status, priority: o.priority,
    payload: o as unknown as Record<string, unknown>, created_by: userId,
  }
}
function fineToRow(f: VehicleFine, orgId: string, userId: string) {
  return {
    id: f.id, organization_id: orgId,
    vehicle_id: f.vehicleId, driver_id: f.driverId, date: f.date,
    status: f.status, due_date: f.dueDate,
    payload: f as unknown as Record<string, unknown>, created_by: userId,
  }
}
function alertToRow(a: FleetMaintenanceAlert, orgId: string, userId: string) {
  return {
    id: a.id, organization_id: orgId,
    vehicle_id: a.vehicleId, severity: a.severity, is_active: a.isActive,
    payload: a as unknown as Record<string, unknown>, created_by: userId,
  }
}
function scheduleToRow(s: FleetScheduleEntry, orgId: string, userId: string) {
  return {
    id: s.id, organization_id: orgId,
    vehicle_id: s.vehicleId, scheduled_date: s.scheduledDate, status: s.status,
    payload: s as unknown as Record<string, unknown>, created_by: userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

// ─── State ─────────────────────────────────────────────────────────────────────

interface FrotaVeicularState {
  vehicles:    Vehicle[]
  fuelRecords: FuelRecord[]
  maintenance: VehicleMaintenanceRecord[]
  drivers:     VehicleDriver[]
  routes:      VehicleRoute[]
  orders:      VehicleServiceOrder[]
  fines:       VehicleFine[]
  alerts:      FleetMaintenanceAlert[]
  schedules:   FleetScheduleEntry[]

  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  addVehicle:    (v: Omit<Vehicle, 'id'>) => void
  updateVehicle: (id: string, updates: Partial<Omit<Vehicle, 'id'>>) => void
  removeVehicle: (id: string) => void

  addFuelRecord:    (r: Omit<FuelRecord, 'id'>) => void
  updateFuelRecord: (id: string, updates: Partial<Omit<FuelRecord, 'id'>>) => void
  removeFuelRecord: (id: string) => void

  addMaintenance:    (m: Omit<VehicleMaintenanceRecord, 'id'>) => void
  updateMaintenance: (id: string, updates: Partial<Omit<VehicleMaintenanceRecord, 'id'>>) => void
  removeMaintenance: (id: string) => void

  addDriver:    (d: Omit<VehicleDriver, 'id'>) => void
  updateDriver: (id: string, updates: Partial<Omit<VehicleDriver, 'id'>>) => void
  removeDriver: (id: string) => void

  addRoute:    (r: Omit<VehicleRoute, 'id'>) => void
  updateRoute: (id: string, updates: Partial<Omit<VehicleRoute, 'id'>>) => void
  removeRoute: (id: string) => void

  addOrder:    (o: Omit<VehicleServiceOrder, 'id' | 'code'>) => void
  updateOrder: (id: string, updates: Partial<Omit<VehicleServiceOrder, 'id'>>) => void
  removeOrder: (id: string) => void

  addFine:    (f: Omit<VehicleFine, 'id'>) => void
  updateFine: (id: string, updates: Partial<Omit<VehicleFine, 'id'>>) => void
  removeFine: (id: string) => void

  addAlert:     (a: Omit<FleetMaintenanceAlert, 'id' | 'createdAt'>) => void
  dismissAlert: (id: string) => void

  addSchedule:    (s: Omit<FleetScheduleEntry, 'id'>) => void
  updateSchedule: (id: string, updates: Partial<Omit<FleetScheduleEntry, 'id'>>) => void
  removeSchedule: (id: string) => void

  loadDemoData: () => void
  clearData:    () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useFrotaVeicularStore = create<FrotaVeicularState>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))

      // Helper genérico para reduzir repetição em update
      function patchOf(row: Record<string, unknown>): Record<string, unknown> {
        return Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      }

      return {
        vehicles:    [], fuelRecords: [], maintenance: [], drivers: [],
        routes: [], orders: [], fines: [], alerts: [], schedules: [],
        pendingSync: [], syncStatus: 'idle', lastSyncedAt: null, syncError: null,

        // ── Vehicles ─────────────────────────────────────────────────────────────
        addVehicle: (v) => {
          const id = crypto.randomUUID()
          const newV: Vehicle = { ...v, id }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            vehicles: [...s.vehicles, newV],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'veiculo', type: 'insert', recordId: id, row: vehicleToRow(newV, orgId, userId), table: 'veiculos' })],
          }))
          void get().flush()
        },
        updateVehicle: (id, updates) => {
          set((s) => ({ vehicles: s.vehicles.map((v) => v.id === id ? { ...v, ...updates } : v) }))
          const target = get().vehicles.find((v) => v.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            enqueue(makeOp({ entity: 'veiculo', type: 'update', recordId: id, patch: patchOf(vehicleToRow(target, orgId, userId)), table: 'veiculos' }))
            void get().flush()
          }
        },
        removeVehicle: (id) => {
          set((s) => ({
            vehicles: s.vehicles.filter((v) => v.id !== id),
            // Era `type: 'delete'` com `approvalActionType`, que chama o RPC `request_action`:
            // aquilo só CRIA UM PEDIDO em `pending_actions` e não apaga nada. A op saía da fila
            // como concluída e o veículo voltava no pull seguinte — de volta na frota, e voltando
            // a puxar abastecimentos, multas e OS para os indicadores de custo. Como o cliente usa
            // uma conta só, não existe o segundo aprovador que `approve_pending_action` exige.
            // Escrevemos direto o mesmo `deleted_at` que aquele RPC gravaria; `veiculos_update_role`
            // aceita a escrita (papéis engenheiro/planejador/gerente/diretor/owner).
            pendingSync: [...s.pendingSync, makeOp({ entity: 'veiculo', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'veiculos' })],
          }))
          void get().flush()
        },

        // ── Fuel ─────────────────────────────────────────────────────────────────
        addFuelRecord: (r) => {
          const id = crypto.randomUUID()
          const newR: FuelRecord = { ...r, id }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            fuelRecords: [...s.fuelRecords, newR],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fuel', type: 'insert', recordId: id, row: fuelToRow(newR, orgId, userId), table: 'fleet_fuel_records' })],
          }))
          void get().flush()
        },
        updateFuelRecord: (id, updates) => {
          set((s) => ({ fuelRecords: s.fuelRecords.map((r) => r.id === id ? { ...r, ...updates } : r) }))
          const target = get().fuelRecords.find((r) => r.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            enqueue(makeOp({ entity: 'fuel', type: 'update', recordId: id, patch: patchOf(fuelToRow(target, orgId, userId)), table: 'fleet_fuel_records' }))
            void get().flush()
          }
        },
        removeFuelRecord: (id) => {
          set((s) => ({
            fuelRecords: s.fuelRecords.filter((r) => r.id !== id),
            // Era `type: 'delete'` com `approvalActionType`, que só abre um pedido de aprovação
            // e devolve a op como concluída sem apagar nada. Um abastecimento lançado errado
            // sumia da tela e voltava no pull, somando litros e custo de novo no consumo do
            // veículo. Soft delete direto: `ffr_update_role` aceita a escrita.
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fuel', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'fleet_fuel_records' })],
          }))
          void get().flush()
        },

        // ── Maintenance ──────────────────────────────────────────────────────────
        addMaintenance: (m) => {
          const id = crypto.randomUUID()
          const newM: VehicleMaintenanceRecord = { ...m, id }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            maintenance: [...s.maintenance, newM],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'veh_maint', type: 'insert', recordId: id, row: vehMaintToRow(newM, orgId, userId), table: 'fleet_vehicle_maintenance' })],
          }))
          void get().flush()
        },
        updateMaintenance: (id, updates) => {
          set((s) => ({ maintenance: s.maintenance.map((m) => m.id === id ? { ...m, ...updates } : m) }))
          const target = get().maintenance.find((m) => m.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            enqueue(makeOp({ entity: 'veh_maint', type: 'update', recordId: id, patch: patchOf(vehMaintToRow(target, orgId, userId)), table: 'fleet_vehicle_maintenance' }))
            void get().flush()
          }
        },
        removeMaintenance: (id) => {
          set((s) => ({
            maintenance: s.maintenance.filter((m) => m.id !== id),
            // Era `type: 'delete'` com `approvalActionType`: pedido de aprovação que ninguém
            // aprova (conta única), e a manutenção reaparecia no pull. Pior aqui, porque ela
            // carrega `next_service_date` — o registro voltava e ressuscitava a revisão futura
            // e o alerta dela. Soft delete direto via `fvm_update_role`.
            pendingSync: [...s.pendingSync, makeOp({ entity: 'veh_maint', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'fleet_vehicle_maintenance' })],
          }))
          void get().flush()
        },

        // ── Drivers ──────────────────────────────────────────────────────────────
        addDriver: (d) => {
          const id = crypto.randomUUID()
          const newD: VehicleDriver = { ...d, id }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            drivers: [...s.drivers, newD],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'driver', type: 'insert', recordId: id, row: driverToRow(newD, orgId, userId), table: 'fleet_drivers' })],
          }))
          void get().flush()
        },
        updateDriver: (id, updates) => {
          set((s) => ({ drivers: s.drivers.map((d) => d.id === id ? { ...d, ...updates } : d) }))
          const target = get().drivers.find((d) => d.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            enqueue(makeOp({ entity: 'driver', type: 'update', recordId: id, patch: patchOf(driverToRow(target, orgId, userId)), table: 'fleet_drivers' }))
            void get().flush()
          }
        },
        removeDriver: (id) => {
          set((s) => ({
            drivers: s.drivers.filter((d) => d.id !== id),
            // Era `type: 'delete'` com `approvalActionType`, que não apaga — só registra o
            // pedido. O motorista desligado voltava na lista de escolha de rota no pull
            // seguinte, e junto voltavam CPF mascarado e CNH que deveriam ter saído de cena.
            // Soft delete direto: `fd_update_role` aceita a escrita.
            pendingSync: [...s.pendingSync, makeOp({ entity: 'driver', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'fleet_drivers' })],
          }))
          void get().flush()
        },

        // ── Routes ───────────────────────────────────────────────────────────────
        addRoute: (r) => {
          const id = crypto.randomUUID()
          const newR: VehicleRoute = { ...r, id }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            routes: [...s.routes, newR],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'route', type: 'insert', recordId: id, row: routeToRow(newR, orgId, userId), table: 'fleet_routes' })],
          }))
          void get().flush()
        },
        updateRoute: (id, updates) => {
          set((s) => ({ routes: s.routes.map((r) => r.id === id ? { ...r, ...updates } : r) }))
          const target = get().routes.find((r) => r.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            enqueue(makeOp({ entity: 'route', type: 'update', recordId: id, patch: patchOf(routeToRow(target, orgId, userId)), table: 'fleet_routes' }))
            void get().flush()
          }
        },
        removeRoute: (id) => {
          set((s) => ({
            routes: s.routes.filter((r) => r.id !== id),
            // Era `type: 'delete'` com `approvalActionType` — pedido de aprovação, não exclusão.
            // Uma rota cancelada voltava no pull e reocupava veículo e motorista naquela data,
            // fazendo a agenda mostrar conflito com a rota que a substituiu. Soft delete direto
            // via `fr_update_role`.
            pendingSync: [...s.pendingSync, makeOp({ entity: 'route', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'fleet_routes' })],
          }))
          void get().flush()
        },

        // ── Service Orders ───────────────────────────────────────────────────────
        addOrder: (o) => {
          const id = crypto.randomUUID()
          const code = `OS-${String(get().orders.length + 1).padStart(4, '0')}`
          const newO: VehicleServiceOrder = { ...o, id, code }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            orders: [...s.orders, newO],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fleet_so', type: 'insert', recordId: id, row: serviceOrderToRow(newO, orgId, userId), table: 'fleet_service_orders' })],
          }))
          void get().flush()
        },
        updateOrder: (id, updates) => {
          set((s) => ({ orders: s.orders.map((o) => o.id === id ? { ...o, ...updates } : o) }))
          const target = get().orders.find((o) => o.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            enqueue(makeOp({ entity: 'fleet_so', type: 'update', recordId: id, patch: patchOf(serviceOrderToRow(target, orgId, userId)), table: 'fleet_service_orders' }))
            void get().flush()
          }
        },
        removeOrder: (id) => {
          set((s) => ({
            orders: s.orders.filter((o) => o.id !== id),
            // Era `type: 'delete'` com `approvalActionType`: virava pedido em `pending_actions`
            // e a OS voltava no pull, de volta na fila de serviço da oficina. Note que `addOrder`
            // numera pelo tamanho da lista, então a OS ressuscitada ainda colide de código com a
            // que foi criada depois dela. Soft delete direto via `fso_update_role`.
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fleet_so', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'fleet_service_orders' })],
          }))
          void get().flush()
        },

        // ── Fines ────────────────────────────────────────────────────────────────
        addFine: (f) => {
          const id = crypto.randomUUID()
          const newF: VehicleFine = { ...f, id }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            fines: [...s.fines, newF],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fine', type: 'insert', recordId: id, row: fineToRow(newF, orgId, userId), table: 'fleet_fines' })],
          }))
          void get().flush()
        },
        updateFine: (id, updates) => {
          set((s) => ({ fines: s.fines.map((f) => f.id === id ? { ...f, ...updates } : f) }))
          const target = get().fines.find((f) => f.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            enqueue(makeOp({ entity: 'fine', type: 'update', recordId: id, patch: patchOf(fineToRow(target, orgId, userId)), table: 'fleet_fines' }))
            void get().flush()
          }
        },
        removeFine: (id) => {
          set((s) => ({
            fines: s.fines.filter((f) => f.id !== id),
            // Era `type: 'delete'` com `approvalActionType`, que só pede aprovação. A multa
            // lançada em duplicidade voltava no pull, com o mesmo `due_date`, e continuava
            // pesando como pendência no motorista e no veículo. Soft delete direto: a policy
            // `ff_update_role` aceita a escrita.
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fine', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'fleet_fines' })],
          }))
          void get().flush()
        },

        // ── Alerts ───────────────────────────────────────────────────────────────
        addAlert: (a) => {
          const id = crypto.randomUUID()
          const newA: FleetMaintenanceAlert = { ...a, id, createdAt: new Date().toISOString() }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            alerts: [...s.alerts, newA],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fleet_alert', type: 'insert', recordId: id, row: alertToRow(newA, orgId, userId), table: 'fleet_alerts' })],
          }))
          void get().flush()
        },
        dismissAlert: (id) => {
          set((s) => ({ alerts: s.alerts.map((a) => a.id === id ? { ...a, isActive: false } : a) }))
          const target = get().alerts.find((a) => a.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            enqueue(makeOp({ entity: 'fleet_alert', type: 'update', recordId: id, patch: patchOf(alertToRow(target, orgId, userId)), table: 'fleet_alerts' }))
            void get().flush()
          }
        },

        // ── Schedules ────────────────────────────────────────────────────────────
        addSchedule: (s_) => {
          const id = crypto.randomUUID()
          const newS: FleetScheduleEntry = { ...s_, id }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            schedules: [...s.schedules, newS],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fleet_sched', type: 'insert', recordId: id, row: scheduleToRow(newS, orgId, userId), table: 'fleet_schedules' })],
          }))
          void get().flush()
        },
        updateSchedule: (id, updates) => {
          set((s) => ({ schedules: s.schedules.map((sc) => sc.id === id ? { ...sc, ...updates } : sc) }))
          const target = get().schedules.find((sc) => sc.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            enqueue(makeOp({ entity: 'fleet_sched', type: 'update', recordId: id, patch: patchOf(scheduleToRow(target, orgId, userId)), table: 'fleet_schedules' }))
            void get().flush()
          }
        },
        removeSchedule: (id) => {
          set((s) => ({
            schedules: s.schedules.filter((sc) => sc.id !== id),
            // Era `type: 'delete'` com `approvalActionType` — pedido de aprovação sem ninguém
            // para aprovar. O agendamento desmarcado voltava no pull e reservava o veículo de
            // novo naquela `scheduled_date`, bloqueando quem tentasse usá-lo. Soft delete
            // direto via `fs_update_role`.
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fleet_sched', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'fleet_schedules' })],
          }))
          void get().flush()
        },

        // ── Demo / Clear ─────────────────────────────────────────────────────────
        loadDemoData: () => set({
          vehicles: MOCK_VEHICLES, fuelRecords: MOCK_FUEL_RECORDS, maintenance: MOCK_MAINTENANCE,
          drivers: MOCK_VEHICLE_DRIVERS, routes: MOCK_VEHICLE_ROUTES, orders: MOCK_SERVICE_ORDERS,
          fines: MOCK_VEHICLE_FINES, alerts: MOCK_FLEET_ALERTS, schedules: MOCK_FLEET_SCHEDULES,
        }),
        clearData: () => set({
          vehicles: [], fuelRecords: [], maintenance: [], drivers: [],
          routes: [], orders: [], fines: [], alerts: [], schedules: [],
          pendingSync: [], syncError: null,
        }),

        // ── Sync ─────────────────────────────────────────────────────────────────
        flush: async () => {
          const queue = get().pendingSync
          if (queue.length === 0) return
          if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
          const { profile } = useAuth.getState()
          if (!profile) { set({ syncStatus: 'unauth' }); return }
          set({ syncStatus: 'syncing', syncError: null })
          const result = await flushQueue(queue)
          set((s) => ({
            pendingSync: s.pendingSync
              .filter((p) => !result.completed.includes(p.id))
              .map((p) => result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p),
            syncStatus:   result.lastError ? 'error' : 'idle',
            lastSyncedAt: new Date().toISOString(),
            syncError:    result.lastError ?? null,
          }))
        },

        pull: async () => {
          // Em paralelo: as tabelas não dependem uma da outra, e em série cada uma esperava a anterior.
          const [v, fr, m, dr, ro, so, fi, al, sc] = await Promise.all([
            pullTable<{ payload: Vehicle }>('veiculos'),
            pullTable<{ payload: FuelRecord }>('fleet_fuel_records'),
            pullTable<{ payload: VehicleMaintenanceRecord }>('fleet_vehicle_maintenance'),
            pullTable<{ payload: VehicleDriver }>('fleet_drivers'),
            pullTable<{ payload: VehicleRoute }>('fleet_routes'),
            pullTable<{ payload: VehicleServiceOrder }>('fleet_service_orders'),
            pullTable<{ payload: VehicleFine }>('fleet_fines'),
            pullTable<{ payload: FleetMaintenanceAlert }>('fleet_alerts'),
            pullTable<{ payload: FleetScheduleEntry }>('fleet_schedules'),
          ])
          set((s) => ({
            vehicles:    mergePull(v?.map((r) => r.payload) ?? null,  s.vehicles,    s.pendingSync, 'veiculos'),
            fuelRecords: mergePull(fr?.map((r) => r.payload) ?? null, s.fuelRecords, s.pendingSync, 'fleet_fuel_records'),
            maintenance: mergePull(m?.map((r) => r.payload) ?? null,  s.maintenance, s.pendingSync, 'fleet_vehicle_maintenance'),
            drivers:     mergePull(dr?.map((r) => r.payload) ?? null, s.drivers,     s.pendingSync, 'fleet_drivers'),
            routes:      mergePull(ro?.map((r) => r.payload) ?? null, s.routes,      s.pendingSync, 'fleet_routes'),
            orders:      mergePull(so?.map((r) => r.payload) ?? null, s.orders,      s.pendingSync, 'fleet_service_orders'),
            fines:       mergePull(fi?.map((r) => r.payload) ?? null, s.fines,       s.pendingSync, 'fleet_fines'),
            alerts:      mergePull(al?.map((r) => r.payload) ?? null, s.alerts,      s.pendingSync, 'fleet_alerts'),
            schedules:   mergePull(sc?.map((r) => r.payload) ?? null, s.schedules,   s.pendingSync, 'fleet_schedules'),
          }))
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-frota-veicular',
      partialize: (s) => ({
        vehicles:    s.vehicles, fuelRecords: s.fuelRecords, maintenance: s.maintenance,
        drivers:     s.drivers,  routes:      s.routes,      orders:      s.orders,
        fines:       s.fines,    alerts:      s.alerts,      schedules:   s.schedules,
        pendingSync: s.pendingSync, lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useFrotaVeicularStore.getState().flush()
  })
}
