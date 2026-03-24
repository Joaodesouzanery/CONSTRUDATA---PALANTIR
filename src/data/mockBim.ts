/**
 * mockBim.ts — synthetic pipe network demo data for the BIM 3D/4D/5D module.
 * Simulates a PolyLineZ Shapefile already parsed into BimSegment objects.
 * Coordinates are in a local Cartesian system (meters from origin).
 */
import type { BimSegment, BimLayer, BimProject } from '@/types'

// ─── Segments ─────────────────────────────────────────────────────────────────

export const MOCK_BIM_SEGMENTS: BimSegment[] = [
  // ── Main collector (T01) ───────────────────────────────────────────────────
  {
    id: 'seg-01', trechoCode: 'T01', phase: 'Coletor Principal',
    vertices: [[0,0,-2.0],[30,0,-2.1],[60,0,-2.2],[90,0,-2.3],[120,0,-2.4]],
    attributes: { DIAMETER: 400, MATERIAL: 'PVC', DEPTH: 2.2, DN: 'DN400' },
    lengthM: 120, avgDepthM: 2.2, diameter: 400, material: 'PVC',
    unitCostBRL: 210, totalCostBRL: 120 * 210,
    constructionDate: '2025-03-10',
  },
  {
    id: 'seg-02', trechoCode: 'T01', phase: 'Coletor Principal',
    vertices: [[120,0,-2.4],[150,0,-2.5],[180,0,-2.6],[210,0,-2.7],[240,0,-2.8]],
    attributes: { DIAMETER: 400, MATERIAL: 'PVC', DEPTH: 2.6, DN: 'DN400' },
    lengthM: 120, avgDepthM: 2.6, diameter: 400, material: 'PVC',
    unitCostBRL: 210, totalCostBRL: 120 * 210,
    constructionDate: '2025-03-15',
  },
  // ── Branch A (T02) ────────────────────────────────────────────────────────
  {
    id: 'seg-03', trechoCode: 'T02', phase: 'Ramal A',
    vertices: [[60,0,-2.2],[60,30,-2.0],[60,60,-1.8]],
    attributes: { DIAMETER: 200, MATERIAL: 'PVC', DEPTH: 2.0, DN: 'DN200' },
    lengthM: 60, avgDepthM: 2.0, diameter: 200, material: 'PVC',
    unitCostBRL: 85, totalCostBRL: 60 * 85,
    constructionDate: '2025-04-01',
  },
  {
    id: 'seg-04', trechoCode: 'T02', phase: 'Ramal A',
    vertices: [[60,60,-1.8],[60,90,-1.7],[60,120,-1.6]],
    attributes: { DIAMETER: 200, MATERIAL: 'PVC', DEPTH: 1.7, DN: 'DN200' },
    lengthM: 60, avgDepthM: 1.7, diameter: 200, material: 'PVC',
    unitCostBRL: 85, totalCostBRL: 60 * 85,
    constructionDate: '2025-04-10',
  },
  // ── Branch B (T03) ────────────────────────────────────────────────────────
  {
    id: 'seg-05', trechoCode: 'T03', phase: 'Ramal B',
    vertices: [[120,0,-2.4],[120,30,-2.2],[120,60,-2.0]],
    attributes: { DIAMETER: 200, MATERIAL: 'FoFo', DEPTH: 2.2, DN: 'DN200' },
    lengthM: 60, avgDepthM: 2.2, diameter: 200, material: 'FoFo',
    unitCostBRL: 95, totalCostBRL: 60 * 95,
    constructionDate: '2025-04-15',
  },
  {
    id: 'seg-06', trechoCode: 'T03', phase: 'Ramal B',
    vertices: [[120,60,-2.0],[120,90,-1.8],[120,120,-1.6]],
    attributes: { DIAMETER: 200, MATERIAL: 'FoFo', DEPTH: 1.8, DN: 'DN200' },
    lengthM: 60, avgDepthM: 1.8, diameter: 200, material: 'FoFo',
    unitCostBRL: 95, totalCostBRL: 60 * 95,
    constructionDate: '2025-05-01',
  },
  // ── Cross connector (T04) ─────────────────────────────────────────────────
  {
    id: 'seg-07', trechoCode: 'T04', phase: 'Interligação',
    vertices: [[60,60,-1.8],[90,60,-1.7],[120,60,-2.0]],
    attributes: { DIAMETER: 150, MATERIAL: 'PVC', DEPTH: 1.8, DN: 'DN150' },
    lengthM: 60, avgDepthM: 1.8, diameter: 150, material: 'PVC',
    unitCostBRL: 72, totalCostBRL: 60 * 72,
    constructionDate: '2025-05-10',
  },
  // ── Secondary branches (T05) ───────────────────────────────────────────────
  {
    id: 'seg-08', trechoCode: 'T05', phase: 'Sub-Ramais',
    vertices: [[30,0,-2.05],[30,25,-1.9],[30,50,-1.7]],
    attributes: { DIAMETER: 100, MATERIAL: 'PVC', DEPTH: 1.9, DN: 'DN100' },
    lengthM: 50, avgDepthM: 1.9, diameter: 100, material: 'PVC',
    unitCostBRL: 55, totalCostBRL: 50 * 55,
    constructionDate: '2025-05-20',
  },
  {
    id: 'seg-09', trechoCode: 'T05', phase: 'Sub-Ramais',
    vertices: [[90,0,-2.25],[90,25,-2.1],[90,50,-1.9]],
    attributes: { DIAMETER: 100, MATERIAL: 'PVC', DEPTH: 2.1, DN: 'DN100' },
    lengthM: 50, avgDepthM: 2.1, diameter: 100, material: 'PVC',
    unitCostBRL: 55, totalCostBRL: 50 * 55,
    constructionDate: '2025-05-25',
  },
  {
    id: 'seg-10', trechoCode: 'T05', phase: 'Sub-Ramais',
    vertices: [[150,0,-2.45],[150,30,-2.3],[150,60,-2.1]],
    attributes: { DIAMETER: 100, MATERIAL: 'AC', DEPTH: 2.3, DN: 'DN100' },
    lengthM: 60, avgDepthM: 2.3, diameter: 100, material: 'AC',
    unitCostBRL: 62, totalCostBRL: 60 * 62,
    constructionDate: '2025-06-01',
  },
  // ── Extension (T06) ────────────────────────────────────────────────────────
  {
    id: 'seg-11', trechoCode: 'T06', phase: 'Extensão Norte',
    vertices: [[240,0,-2.8],[270,0,-3.0],[300,0,-3.2]],
    attributes: { DIAMETER: 300, MATERIAL: 'PVC', DEPTH: 3.0, DN: 'DN300' },
    lengthM: 60, avgDepthM: 3.0, diameter: 300, material: 'PVC',
    unitCostBRL: 140, totalCostBRL: 60 * 140,
    constructionDate: '2025-06-15',
  },
  {
    id: 'seg-12', trechoCode: 'T06', phase: 'Extensão Norte',
    vertices: [[300,0,-3.2],[330,0,-3.3],[360,0,-3.5]],
    attributes: { DIAMETER: 300, MATERIAL: 'PVC', DEPTH: 3.3, DN: 'DN300' },
    lengthM: 60, avgDepthM: 3.3, diameter: 300, material: 'PVC',
    unitCostBRL: 140, totalCostBRL: 60 * 140,
    constructionDate: '2025-07-01',
  },
  {
    id: 'seg-13', trechoCode: 'T07', phase: 'Extensão Norte',
    vertices: [[180,0,-2.6],[180,40,-2.4],[180,80,-2.2]],
    attributes: { DIAMETER: 150, MATERIAL: 'FoFo', DEPTH: 2.4, DN: 'DN150' },
    lengthM: 80, avgDepthM: 2.4, diameter: 150, material: 'FoFo',
    unitCostBRL: 78, totalCostBRL: 80 * 78,
    constructionDate: '2025-07-15',
  },
  {
    id: 'seg-14', trechoCode: 'T07', phase: 'Extensão Norte',
    vertices: [[210,0,-2.7],[210,40,-2.5],[210,80,-2.3]],
    attributes: { DIAMETER: 150, MATERIAL: 'AC', DEPTH: 2.5, DN: 'DN150' },
    lengthM: 80, avgDepthM: 2.5, diameter: 150, material: 'AC',
    unitCostBRL: 82, totalCostBRL: 80 * 82,
    constructionDate: '2025-07-20',
  },
  {
    id: 'seg-15', trechoCode: 'T08', phase: 'Interligação Sul',
    vertices: [[0,0,-2.0],[0,50,-1.8],[0,100,-1.6]],
    attributes: { DIAMETER: 100, MATERIAL: 'PVC', DEPTH: 1.8, DN: 'DN100' },
    lengthM: 100, avgDepthM: 1.8, diameter: 100, material: 'PVC',
    unitCostBRL: 55, totalCostBRL: 100 * 55,
    constructionDate: '2025-08-01',
  },
]

// ─── Layers ───────────────────────────────────────────────────────────────────

export const MOCK_BIM_LAYERS: BimLayer[] = [
  { id: 'layer-pvc',  name: 'PVC',          visible: true,  color: '#3b82f6', attribute: 'MATERIAL' },
  { id: 'layer-fofo', name: 'Ferro Fundido', visible: true,  color: '#f59e0b', attribute: 'MATERIAL' },
  { id: 'layer-ac',   name: 'Aço Carbon.',  visible: true,  color: '#10b981', attribute: 'MATERIAL' },
  { id: 'layer-dn400',name: 'DN400',        visible: true,  color: '#8b5cf6', attribute: 'DIAMETER' },
  { id: 'layer-dn300',name: 'DN300',        visible: true,  color: '#6366f1', attribute: 'DIAMETER' },
  { id: 'layer-dn200',name: 'DN200',        visible: true,  color: '#0ea5e9', attribute: 'DIAMETER' },
  { id: 'layer-dn150',name: 'DN150',        visible: true,  color: '#22c55e', attribute: 'DIAMETER' },
  { id: 'layer-dn100',name: 'DN100',        visible: true,  color: '#f97316', attribute: 'DIAMETER' },
]

// ─── Project ──────────────────────────────────────────────────────────────────

export const MOCK_BIM_PROJECT: BimProject = {
  id:                  'bim-proj-01',
  name:                'Rede Pluvial — Demo',
  segments:            MOCK_BIM_SEGMENTS,
  layers:              MOCK_BIM_LAYERS,
  uploadedAt:          '2025-01-10T10:00:00.000Z',
  shapefileSourceName: 'rede_pluvial_demo.shp',
}
