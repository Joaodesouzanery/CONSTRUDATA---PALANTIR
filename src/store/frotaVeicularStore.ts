/**
 * frotaVeicularStore.ts — operational fleet management.
 * Sprint 5: migrado para Supabase via storeSync (9 sub-entidades, 9 tabelas).
 *
 * Security:
 *  - All IDs via crypto.randomUUID()
 *  - CPF/license numbers stored only in masked form (never raw)
 *  - DELETE crítico via approval RPC
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
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
            pendingSync: [...s.pendingSync, makeOp({ entity: 'veiculo', type: 'delete', recordId: id, table: 'veiculos', approvalActionType: 'delete_veiculo' })],
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
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fuel', type: 'delete', recordId: id, table: 'fleet_fuel_records', approvalActionType: 'delete_fleet_fuel_record' })],
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
            pendingSync: [...s.pendingSync, makeOp({ entity: 'veh_maint', type: 'delete', recordId: id, table: 'fleet_vehicle_maintenance', approvalActionType: 'delete_fleet_vehicle_maintenance' })],
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
            pendingSync: [...s.pendingSync, makeOp({ entity: 'driver', type: 'delete', recordId: id, table: 'fleet_drivers', approvalActionType: 'delete_fleet_driver' })],
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
            pendingSync: [...s.pendingSync, makeOp({ entity: 'route', type: 'delete', recordId: id, table: 'fleet_routes', approvalActionType: 'delete_fleet_route' })],
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
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fleet_so', type: 'delete', recordId: id, table: 'fleet_service_orders', approvalActionType: 'delete_fleet_service_order' })],
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
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fine', type: 'delete', recordId: id, table: 'fleet_fines', approvalActionType: 'delete_fleet_fine' })],
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
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fleet_sched', type: 'delete', recordId: id, table: 'fleet_schedules', approvalActionType: 'delete_fleet_schedule' })],
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
          const v   = await pullTable<{ payload: Vehicle }>('veiculos')
          const fr  = await pullTable<{ payload: FuelRecord }>('fleet_fuel_records')
          const m   = await pullTable<{ payload: VehicleMaintenanceRecord }>('fleet_vehicle_maintenance')
          const dr  = await pullTable<{ payload: VehicleDriver }>('fleet_drivers')
          const ro  = await pullTable<{ payload: VehicleRoute }>('fleet_routes')
          const so  = await pullTable<{ payload: VehicleServiceOrder }>('fleet_service_orders')
          const fi  = await pullTable<{ payload: VehicleFine }>('fleet_fines')
          const al  = await pullTable<{ payload: FleetMaintenanceAlert }>('fleet_alerts')
          const sc  = await pullTable<{ payload: FleetScheduleEntry }>('fleet_schedules')
          if (v)  set({ vehicles:    v.map((r) => r.payload) })
          if (fr) set({ fuelRecords: fr.map((r) => r.payload) })
          if (m)  set({ maintenance: m.map((r) => r.payload) })
          if (dr) set({ drivers:     dr.map((r) => r.payload) })
          if (ro) set({ routes:      ro.map((r) => r.payload) })
          if (so) set({ orders:      so.map((r) => r.payload) })
          if (fi) set({ fines:       fi.map((r) => r.payload) })
          if (al) set({ alerts:      al.map((r) => r.payload) })
          if (sc) set({ schedules:   sc.map((r) => r.payload) })
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
