# CONSTRUDATA — Palantir for Construction

> **An integrated platform for construction project management** — combining BIM 3D/4D/5D, interactive network mapping, lean scheduling, procurement, workforce, and full project lifecycle management in a single dark-mode interface.

---

## Overview

CONSTRUDATA is a full-stack construction management platform built for Brazilian infrastructure and building projects. It integrates every dimension of project control — from sewer network mapping and BIM models to payroll processing and lean production tracking — into a unified, real-time dashboard.

**Built with:** React 18 · TypeScript · Vite · Zustand · Three.js · Leaflet · Tailwind CSS v4

---

## Modules

| Module | Description |
|--------|-------------|
| Relatório 360 | Daily executive dashboard with KPIs, alerts, and S-curves |
| Agenda / Cronograma | Calendar view of milestones and deadlines |
| Equipamentos | Equipment registry and maintenance control |
| Projetos (BIM) | Project management with 3D/4D/5D BIM visualization |
| Torre de Controle | Mission control for multi-project oversight |
| Mapa Interativo | Leaflet-based network editor with UTM import and 3D/4D/5D analysis |
| Pré-Construção | Pre-construction planning, geotechnical data, and feasibility |
| Suprimentos | Procurement with Three-Way Match (PO × GRN × Invoice) |
| Mão de Obra | Labor registry, allocation, and payroll |
| Planejamento | Gantt editor, S-Curve, ABC analysis, schedule engine |
| LPS / Lean | Last Planner System: LookAhead, PPC, constraints, analytics |
| RDO | Daily field reports with weather, labor, and incident logging |
| Quantitativos | Bill of quantities with unit cost library |
| BIM 3D/4D/5D | Standalone BIM viewer with Three.js renderer |
| Frota | Fleet management and fuel/maintenance tracking |
| Gestão 360 | JobCosting, change orders, command center, delay simulation |

---

## Quick Start

```bash
# Clone
git clone https://github.com/your-org/construdata-palantir.git
cd construdata-palantir

# Install
npm install

# Development
npm run dev

# Production build
npm run build
npm run preview
```

**Requirements:** Node 18+, npm 9+

---

## Key Features

### BIM 3D/4D/5D (in Projetos module)
- Real-time Three.js WebGL renderer showing building floors as geometric elements
- **3D**: Structural model with floor-by-floor progress coloring
- **4D**: Timeline slider — animate construction over time, floors appear/disappear by scheduled date
- **5D**: Cost heatmap — color elements by unit cost, view orçado × projetado × gasto breakdown

### Mapa Interativo
- Leaflet canvas with satellite/streets/dark basemaps
- **UTM auto-detection**: paste or import coordinates in `easting,northing,elevation` format; the parser auto-detects UTM vs. lat/lng and converts using the Karney approximation
- Sequential pipeline creation: import 39+ survey points and auto-connect as sewer/drainage network
- **Analytics panel** (3D/4D/5D):
  - *Perfil 3D*: SVG elevation profile along the network path
  - *Execução 4D*: Gantt bars matched to Planejamento trechos
  - *Custo 5D*: Cost breakdown by network type with R$/m reference prices

### Simulação de Atrasos (Gestão 360)
- Ask "what if PVC delivery delays 3 days?" — system re-runs `generateSchedule()` with delay parameters
- Side-by-side KPI comparison: end date delta, working days delta, cost impact
- SVG Gantt comparison: base bars (gray) vs. delayed bars (orange)

### Three-Way Match (Suprimentos)
- Link purchase orders → goods receipts → invoices
- Automated discrepancy detection with R$ variance calculation
- Approval workflow with status tracking

### LPS / Last Planner System
- LookAhead board (6-week rolling window)
- PPC (Percent Plan Complete) tracking with automated analytics
- Constraint register with owner assignment and resolution status

---

## Architecture

```
src/
├── features/             # Feature modules (one folder per module)
│   ├── bim/              # Three.js BIM canvas + panels
│   ├── mapa-interativo/  # Leaflet map + UTM import + analytics
│   ├── projetos/         # Project management + BIM tabs
│   ├── planejamento/     # Gantt + schedule engine
│   ├── gestao-360/       # JobCosting + delay simulation
│   └── ...               # Other modules
├── store/                # Zustand stores (one per domain)
├── types/                # Shared TypeScript interfaces
├── utils/                # Pure utilities (utmToWgs84, formatCurrency, etc.)
└── styles/               # Global CSS + dark/light theme overrides
```

**State management:** Zustand with lazy cross-store imports to prevent circular dependencies.

**Theme:** Dark-first design using `[data-theme="dark"]` CSS selectors on `document.documentElement`. All modules default to dark; light mode overrides standard Tailwind classes via global CSS.

---

## Deployment

### Vercel (recommended)
```bash
npm run build
# Push to main branch — Vercel auto-deploys
```

The `vercel.json` handles SPA routing rewrites.

### Manual
```bash
npm run build
# Serve dist/ with any static host (Nginx, S3+CloudFront, etc.)
# Configure 404 → index.html for client-side routing
```

---

## Module Documentation

For detailed module-by-module documentation, see [docs/PLATFORM.md](docs/PLATFORM.md).

---

## License

Private — CONSTRUDATA Engenharia. All rights reserved.
