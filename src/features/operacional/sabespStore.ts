/** Estado do contrato Sabesp. Deliberadamente separado de Manutenções/Predial.
 * A persistência usa app_state, que já aplica RLS por organização; cada registro leva contrato,
 * data e status para a futura promoção a tabelas próprias sem misturar domínios. */
import { create } from 'zustand'
import { attachBlobSync } from '@/lib/blobSync'

export type SabespStatus = 'aberto' | 'programado' | 'em_execucao' | 'concluido' | 'cancelado'
export interface SabespContract { id: string; name: string; region: 'BER' | 'SAN' | 'GUA'; active: boolean }
export interface SabespPrice { id: string; contractId: string; key: string; description: string; unit: string; value: number }
export interface SabespCall { id: string; contractId: string; number: string; address: string; service: string; status: SabespStatus; scheduledFor?: string }
export interface SabespOrder { id: string; contractId: string; callId: string; number: string; serviceKey?: string; status: SabespStatus; beforePhotos: string[]; afterPhotos: string[]; pavementRestored: boolean; completedAt?: string }
export interface SabespCrew { id: string; contractId: string; name: string; role: string; cnhCategory?: string; cnhExpiresAt?: string }
export interface SabespLog { id: string; contractId: string; orderId: string; date: string; crewId?: string; quantity: number; material?: string }
export interface SabespImportBatch { id: string; filename: string; createdAt: string; recognized: string[]; unpromoted: string[]; created: number; updated: number; unchanged: number }
interface State { contracts: SabespContract[]; prices: SabespPrice[]; calls: SabespCall[]; orders: SabespOrder[]; crews: SabespCrew[]; logs: SabespLog[]; imports: SabespImportBatch[]; upsertCall: (x: Omit<SabespCall, 'id'> & { id?: string }) => void; upsertOrder: (x: Omit<SabespOrder, 'id'> & { id?: string }) => void; setSlice: (x: Partial<State>) => void }
const id = () => crypto.randomUUID()
export const useSabespStore = create<State>((set) => ({
  contracts: [{ id: 'sabesp-ber', name: 'Sabesp Bertioga', region: 'BER', active: true }, { id: 'sabesp-san', name: 'Sabesp Santos', region: 'SAN', active: true }], prices: [], calls: [], orders: [], crews: [], logs: [], imports: [],
  upsertCall: (x) => set((s) => { const found = s.calls.find((v) => v.id === x.id || (v.contractId === x.contractId && v.number === x.number)); const row = { ...x, id: found?.id ?? x.id ?? id() } as SabespCall; return { calls: found ? s.calls.map((v) => v.id === found.id ? row : v) : [...s.calls, row] } }),
  upsertOrder: (x) => set((s) => { const found = s.orders.find((v) => v.id === x.id || (v.contractId === x.contractId && v.number === x.number)); const row = { ...x, id: found?.id ?? x.id ?? id() } as SabespOrder; return { orders: found ? s.orders.map((v) => v.id === found.id ? row : v) : [...s.orders, row] } }),
  setSlice: (x) => set(x),
}))
attachBlobSync(useSabespStore, { key: 'operacional-sabesp-v1', getSlice: (s) => ({ contracts: s.contracts, prices: s.prices, calls: s.calls, orders: s.orders, crews: s.crews, logs: s.logs, imports: s.imports }), applySlice: (slice) => useSabespStore.getState().setSlice(slice as Partial<State>) })
