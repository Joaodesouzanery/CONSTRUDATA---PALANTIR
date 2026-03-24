/**
 * BimCanvas.tsx
 * Three.js WebGL renderer mounted in a div via useRef + useEffect.
 * Handles two project types:
 *   - sanitation / generic: TubeGeometry per segment (pipes underground)
 *   - building: BoxGeometry (slabs/walls) + CylinderGeometry (columns)
 * Raycaster handles click-to-select.
 */
import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useBimStore } from '@/store/bimStore'
import type { BimProject, BimSegment } from '@/types'

// ─── Color helpers ─────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t, 0, 1)
}

function colorForSegment(
  seg: BimSegment,
  mode: string,
  activeDate: string,
  maxDepth: number,
  maxCostPerM: number,
  isSelected: boolean,
  project: BimProject | null,
): THREE.Color {
  if (isSelected) return new THREE.Color(0xfbbf24) // amber

  if (mode === 'depth') {
    const t = Math.min(seg.avgDepthM / maxDepth, 1)
    return new THREE.Color(lerp(0.2, 1.0, t), lerp(0.6, 0.1, t), lerp(1.0, 0.1, t))
  }

  if (mode === 'date') {
    const date = seg.constructionDate ?? ''
    if (!date) return new THREE.Color(0x4b5563)
    if (date > activeDate) return new THREE.Color(0x4b5563)
    const diff = (new Date(activeDate).getTime() - new Date(date).getTime()) / 86400000
    if (diff < 30) return new THREE.Color(0xf59e0b)
    return new THREE.Color(0x22c55e)
  }

  if (mode === 'cost') {
    const costPerM = seg.lengthM > 0 ? seg.totalCostBRL / seg.lengthM : 0
    const t = Math.min(costPerM / maxCostPerM, 1)
    return new THREE.Color(lerp(0.9, 1.0, t), lerp(0.9, 0.2, t), lerp(0.9, 0.1, t))
  }

  // default: color by material for sanitation / phase for building
  if (project?.type === 'building') {
    const phase = seg.phase?.toLowerCase() ?? ''
    if (phase.includes('fundação')) return new THREE.Color(0x78350f)
    if (phase.includes('estrutura')) return new THREE.Color(0x475569)
    if (phase.includes('fechamento')) return new THREE.Color(0xb45309)
    if (phase.includes('cobertura')) return new THREE.Color(0x1d4ed8)
    return new THREE.Color(0x64748b)
  }

  const mat = seg.material?.toLowerCase() ?? ''
  if (mat.includes('fofo') || mat.includes('ferro')) return new THREE.Color(0xf59e0b)
  if (mat.includes('ac') || mat.includes('aço')) return new THREE.Color(0x10b981)
  return new THREE.Color(0x6366f1) // PVC default
}

// ─── Camera auto-fit ──────────────────────────────────────────────────────────

function fitCamera(
  project: BimProject,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
) {
  const isBuilding = project.type === 'building'
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  project.segments.forEach((seg) => {
    seg.vertices.forEach(([x, y, z]) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    })
  })

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  if (isBuilding) {
    // Building: z is height. Three.js Y = z, Three.js Z = y
    const hMin = minZ, hMax = maxZ
    const ch = (hMin + hMax) / 2
    const size = Math.max(maxX - minX, maxY - minY, hMax - hMin, 1)
    controls.target.set(cx, ch, cy)
    camera.position.set(cx + size * 0.8, ch + size * 0.6, cy + size * 1.5)
  } else {
    // Pipe network: z is depth (rendered as -z*10 in Y axis)
    const depthScale = 10
    const maxY3 = Math.abs(minZ) * depthScale
    const size = Math.max(maxX - minX, maxY - minY, maxY3, 1)
    controls.target.set(cx, maxY3 / 4, cy)
    camera.position.set(cx + size * 0.3, size * 0.5, cy + size * 0.8)
  }

  camera.lookAt(controls.target)
  controls.update()
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function BimCanvas() {
  const containerRef   = useRef<HTMLDivElement>(null)
  const rendererRef    = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef       = useRef<THREE.Scene | null>(null)
  const cameraRef      = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef    = useRef<OrbitControls | null>(null)
  const frameRef       = useRef<number>(0)
  const meshMapRef     = useRef<Map<string, THREE.Mesh>>(new Map())
  const prevProjectId  = useRef<string | null>(null)

  const project    = useBimStore((s) => s.project)
  const selectedId = useBimStore((s) => s.selectedSegmentId)
  const colorMode  = useBimStore((s) => s.colorMode)
  const activeDate = useBimStore((s) => s.activeDate)
  const layers     = useBimStore((s) => s.layers)
  const selectSegment = useBimStore((s) => s.selectSegment)

  // ── Init Three.js once ────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x111827)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(200, 300, 200)
    scene.add(dir)
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.3)
    dir2.position.set(-100, 100, -100)
    scene.add(dir2)
    const grid = new THREE.GridHelper(800, 40, 0x1f2937, 0x1f2937)
    scene.add(grid)
    sceneRef.current = scene

    const aspect = container.clientWidth / container.clientHeight
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 8000)
    camera.position.set(180, 220, 320)
    camera.lookAt(180, 0, 60)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(180, 0, 60)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controlsRef.current = controls

    function animate() {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [])

  // ── Build/update pipe meshes when project or display params change ─────────
  useEffect(() => {
    const scene    = sceneRef.current
    const camera   = cameraRef.current
    const controls = controlsRef.current
    if (!scene) return

    // Dispose old meshes
    meshMapRef.current.forEach((mesh) => {
      scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    })
    meshMapRef.current.clear()

    if (!project) return

    // Auto-fit camera when project changes
    if (camera && controls && project.id !== prevProjectId.current) {
      fitCamera(project, camera, controls)
      prevProjectId.current = project.id
    }

    const segments   = project.segments
    const isBuilding = project.type === 'building'
    const maxDepth   = Math.max(...segments.map((s) => s.avgDepthM), 1)
    const maxCostPerM = Math.max(
      ...segments.map((s) => (s.lengthM > 0 ? s.totalCostBRL / s.lengthM : 0)),
      1,
    )

    // Build visibility sets from layers
    const visibleMaterials = new Set(
      layers.filter((l) => l.visible && l.attribute === 'MATERIAL').map((l) => l.name.toLowerCase()),
    )
    const visibleDiameters = new Set(
      layers.filter((l) => l.visible && l.attribute === 'DIAMETER').map((l) => l.name.replace('DN', '')),
    )
    const visiblePhases = new Set(
      layers.filter((l) => l.visible && l.attribute === 'PHASE').map((l) => l.name),
    )
    const hasMatFilter  = layers.some((l) => l.attribute === 'MATERIAL')
    const hasDiamFilter = layers.some((l) => l.attribute === 'DIAMETER')
    const hasPhaseFilter = layers.some((l) => l.attribute === 'PHASE')

    segments.forEach((seg) => {
      // Layer visibility
      if (hasMatFilter) {
        const mat = seg.material?.toLowerCase() ?? ''
        if (![...visibleMaterials].some((m) => mat.includes(m))) return
      }
      if (hasDiamFilter && !visibleDiameters.has(String(seg.diameter))) return
      if (hasPhaseFilter) {
        const phase = seg.phase ?? ''
        if (![...visiblePhases].some((p) => phase.includes(p))) return
      }

      const elType = seg.elementType ?? 'pipe'
      const color  = colorForSegment(seg, colorMode, activeDate, maxDepth, maxCostPerM, seg.id === selectedId, project)

      let geometry: THREE.BufferGeometry
      let mesh: THREE.Mesh

      if (elType === 'column') {
        // ── Cylinder column (building)
        if (seg.vertices.length < 2) return
        const [x0, y0, z0] = seg.vertices[0]
        const [, , z1] = seg.vertices[1]
        const height = Math.abs(z1 - z0) || 0.1
        const radius = Math.max((seg.diameter / 2000) * 2.5, 0.15)
        geometry = new THREE.CylinderGeometry(radius, radius, height, 8)
        const mat = new THREE.MeshPhongMaterial({ color, shininess: 40 })
        mesh = new THREE.Mesh(geometry, mat)
        mesh.position.set(x0, (z0 + z1) / 2, y0)

      } else if (elType === 'slab' || elType === 'wall' || elType === 'beam') {
        // ── Box element (building)
        if (seg.vertices.length < 2) return
        const [x0, y0, z0] = seg.vertices[0]
        const [x1, y1, z1] = seg.vertices[1]
        const w = Math.abs(x1 - x0) || 0.2
        const d = Math.abs(y1 - y0) || 0.2
        const h = Math.abs(z1 - z0) || 0.3
        geometry = new THREE.BoxGeometry(w, h, d)
        const mat = new THREE.MeshPhongMaterial({ color, shininess: 20, transparent: elType === 'slab', opacity: elType === 'slab' ? 0.85 : 1 })
        mesh = new THREE.Mesh(geometry, mat)
        mesh.position.set((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2)

      } else {
        // ── TubeGeometry pipe (sanitation / default)
        if (seg.vertices.length < 2) return
        const points = isBuilding
          ? seg.vertices.map(([x, y, z]) => new THREE.Vector3(x, z, y))
          : seg.vertices.map(([x, y, z]) => new THREE.Vector3(x, -z * 10, y))
        const curve  = new THREE.CatmullRomCurve3(points)
        const radius = Math.max(seg.diameter / 2000, 0.3)
        geometry = new THREE.TubeGeometry(curve, Math.max(points.length * 4, 12), radius, 8, false)
        const mat = new THREE.MeshPhongMaterial({ color, shininess: 40 })
        mesh = new THREE.Mesh(geometry, mat)
      }

      mesh.userData['segId'] = seg.id
      scene.add(mesh)
      meshMapRef.current.set(seg.id, mesh)
    })
  }, [project, colorMode, activeDate, selectedId, layers])

  // ── Raycaster click ────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current
      const renderer  = rendererRef.current
      const camera    = cameraRef.current
      const scene     = sceneRef.current
      if (!container || !renderer || !camera || !scene) return

      const rect = container.getBoundingClientRect()
      const x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      const y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      const hits = raycaster.intersectObjects([...meshMapRef.current.values()])
      if (hits.length > 0) {
        const segId = hits[0].object.userData['segId'] as string
        selectSegment(segId === selectedId ? null : segId)
      } else {
        selectSegment(null)
      }
    },
    [selectSegment, selectedId],
  )

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 relative cursor-crosshair"
      onClick={handleClick}
    >
      {!project && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
          <p className="text-gray-600 text-sm">Selecione um projeto demo ou importe um arquivo</p>
          <p className="text-gray-700 text-xs">Use o modo Demo para carregar os projetos de exemplo</p>
        </div>
      )}
    </div>
  )
}
