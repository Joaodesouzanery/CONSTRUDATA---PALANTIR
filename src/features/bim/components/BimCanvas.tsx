/**
 * BimCanvas.tsx
 * Three.js WebGL renderer mounted in a div via useRef + useEffect.
 * Renders pipe segments as TubeGeometry objects with color coding.
 * Raycaster handles click-to-select.
 */
import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useBimStore } from '@/store/bimStore'
import type { BimSegment } from '@/types'

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
): THREE.Color {
  if (isSelected) return new THREE.Color(0xfbbf24) // amber highlight

  if (mode === 'depth') {
    const t = Math.min(seg.avgDepthM / maxDepth, 1)
    return new THREE.Color(
      lerp(0.2, 1.0, t),
      lerp(0.6, 0.1, t),
      lerp(1.0, 0.1, t),
    )
  }

  if (mode === 'date') {
    const date = seg.constructionDate ?? ''
    if (!date) return new THREE.Color(0x4b5563) // grey — unknown
    if (date > activeDate) return new THREE.Color(0x4b5563)  // grey — future
    // rough "in progress" window: within 30 days before activeDate
    const activeMs = new Date(activeDate).getTime()
    const segMs = new Date(date).getTime()
    const diff = (activeMs - segMs) / (1000 * 60 * 60 * 24)
    if (diff < 30) return new THREE.Color(0xf59e0b) // yellow — in progress
    return new THREE.Color(0x22c55e) // green — complete
  }

  if (mode === 'cost') {
    const costPerM = seg.lengthM > 0 ? seg.totalCostBRL / seg.lengthM : 0
    const t = Math.min(costPerM / maxCostPerM, 1)
    return new THREE.Color(
      lerp(0.9, 1.0, t),
      lerp(0.9, 0.2, t),
      lerp(0.9, 0.1, t),
    )
  }

  // default: color by material
  const mat = seg.material?.toLowerCase() ?? ''
  if (mat.includes('fofo') || mat.includes('ferro')) return new THREE.Color(0xf59e0b)
  if (mat.includes('ac') || mat.includes('aço')) return new THREE.Color(0x10b981)
  return new THREE.Color(0x6366f1) // default indigo (PVC)
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function BimCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const frameRef = useRef<number>(0)
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map())

  const project = useBimStore((s) => s.project)
  const selectedId = useBimStore((s) => s.selectedSegmentId)
  const colorMode = useBimStore((s) => s.colorMode)
  const activeDate = useBimStore((s) => s.activeDate)
  const layers = useBimStore((s) => s.layers)
  const selectSegment = useBimStore((s) => s.selectSegment)

  // ── Initialise Three.js scene ──────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x111827) // gray-900
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Scene
    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(200, 300, 200)
    scene.add(dirLight)

    // Ground grid
    const grid = new THREE.GridHelper(600, 30, 0x1f2937, 0x1f2937)
    scene.add(grid)

    sceneRef.current = scene

    // Camera
    const aspect = container.clientWidth / container.clientHeight
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 5000)
    camera.position.set(180, 220, 320)
    camera.lookAt(180, 0, 60)
    cameraRef.current = camera

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(180, 0, 60)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controlsRef.current = controls

    // Animate
    function animate() {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize observer
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth
      const h = container.clientHeight
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

  // ── Build/update pipe meshes ───────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Remove old meshes
    meshMapRef.current.forEach((mesh) => {
      scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    })
    meshMapRef.current.clear()

    if (!project) return

    const segments = project.segments
    const maxDepth = Math.max(...segments.map((s) => s.avgDepthM), 1)
    const maxCostPerM = Math.max(
      ...segments.map((s) => (s.lengthM > 0 ? s.totalCostBRL / s.lengthM : 0)),
      1,
    )

    // Build a set of visible material/diameter values from layers
    const visibleMaterials = new Set(
      layers
        .filter((l) => l.visible && l.attribute === 'MATERIAL')
        .map((l) => l.name.toLowerCase()),
    )
    const visibleDiameters = new Set(
      layers
        .filter((l) => l.visible && l.attribute === 'DIAMETER')
        .map((l) => l.name.replace('DN', '')),
    )
    const hasMatFilter = layers.some((l) => l.attribute === 'MATERIAL')
    const hasDiamFilter = layers.some((l) => l.attribute === 'DIAMETER')

    segments.forEach((seg) => {
      // Layer visibility check
      if (hasMatFilter) {
        const mat = seg.material?.toLowerCase() ?? ''
        const matchesMat = [...visibleMaterials].some((m) => mat.includes(m))
        if (!matchesMat) return
      }
      if (hasDiamFilter) {
        if (!visibleDiameters.has(String(seg.diameter))) return
      }

      if (seg.vertices.length < 2) return

      // Build CatmullRomCurve3
      const points = seg.vertices.map(([x, y, z]) => new THREE.Vector3(x, -z * 10, y))
      const curve = new THREE.CatmullRomCurve3(points)
      const radius = Math.max(seg.diameter / 2000, 0.3) // diameter mm → visual radius m, min 0.3m

      const geometry = new THREE.TubeGeometry(curve, Math.max(points.length * 4, 12), radius, 8, false)
      const color = colorForSegment(seg, colorMode, activeDate, maxDepth, maxCostPerM, seg.id === selectedId)
      const material = new THREE.MeshPhongMaterial({ color, shininess: 40 })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData['segId'] = seg.id
      scene.add(mesh)
      meshMapRef.current.set(seg.id, mesh)
    })
  }, [project, colorMode, activeDate, selectedId, layers])

  // ── Click to select ────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current
      const renderer = rendererRef.current
      const camera = cameraRef.current
      const scene = sceneRef.current
      if (!container || !renderer || !camera || !scene) return

      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

      const meshes = [...meshMapRef.current.values()]
      const hits = raycaster.intersectObjects(meshes)
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
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-gray-600 text-sm">Importe um Shapefile ou ative o Modo Demo</p>
        </div>
      )}
    </div>
  )
}
