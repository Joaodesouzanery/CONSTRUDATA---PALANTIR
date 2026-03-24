# CONSTRUDATA Platform — Module Documentation

Complete reference for every module in the CONSTRUDATA platform.

---

## Table of Contents

1. [Relatório 360](#1-relatório-360)
2. [Agenda / Cronograma](#2-agenda--cronograma)
3. [Equipamentos](#3-equipamentos)
4. [Projetos (BIM 3D/4D/5D)](#4-projetos-bim-3d4d5d)
5. [Torre de Controle](#5-torre-de-controle)
6. [Mapa Interativo](#6-mapa-interativo)
7. [Pré-Construção](#7-pré-construção)
8. [Suprimentos (Three-Way Match)](#8-suprimentos-three-way-match)
9. [Mão de Obra](#9-mão-de-obra)
10. [Planejamento](#10-planejamento)
11. [LPS / Lean](#11-lps--lean)
12. [RDO](#12-rdo)
13. [Quantitativos](#13-quantitativos)
14. [BIM 3D/4D/5D (Standalone)](#14-bim-3d4d5d-standalone)
15. [Frota](#15-frota)
16. [Gestão 360](#16-gestão-360)

---

## 1. Relatório 360

**Purpose:** Executive dashboard giving a 360° view of all active projects in a single page.

**What it does:**
- Displays real-time KPI cards: total budgeted cost, total spent, overall physical progress, active alerts
- S-Curve chart comparing planned vs. actual progress over time
- Alert feed: delays, budget overruns, pending approvals, weather incidents
- Per-project status matrix: RAG (Red/Amber/Green) with last RDO date and delay days
- Financial summary: total approved change orders, pending invoices, cost-at-completion forecast

**Solves:**
- Eliminates the need for weekly PowerPoint status reports
- Gives directors a single-screen snapshot of the portfolio's health
- Surfaces hidden risks (cost overrun + schedule slip combinations) before they escalate

---

## 2. Agenda / Cronograma

**Purpose:** Calendar-based milestone and deadline tracker across all projects.

**What it does:**
- Monthly/weekly calendar views with color-coded events per project
- Milestone categories: contrato, licença, marco técnico, entrega parcial, vistoria
- Drag-and-drop rescheduling with automatic conflict detection
- Integration with Planejamento module: Gantt phase end dates appear as calendar events
- Export to iCal / PDF

**Solves:**
- Prevents milestone collisions across concurrent projects
- Gives field and office teams a shared calendar without relying on email chains
- Auto-populates from the schedule engine so calendar never goes stale

---

## 3. Equipamentos

**Purpose:** Equipment registry, allocation tracking, and preventive maintenance control.

**What it does:**
- Equipment catalog with type, model, plate/serial, ownership (own vs. rented), and daily cost
- Allocation board: assign equipment to projects by date range
- Maintenance log: record service events, oil changes, tire changes, with next-service alerts
- Utilization report: days active vs. idle vs. under maintenance per month
- Cost allocation: equipment hours charged back to project cost centers

**Solves:**
- Eliminates double-booking equipment across simultaneous job sites
- Reduces reactive maintenance costs through preventive scheduling
- Provides accurate equipment cost-per-project for JobCosting

---

## 4. Projetos (BIM 3D/4D/5D)

**Purpose:** Full project lifecycle management with integrated BIM visualization.

**What it does:**

### Project Registry
- Create and manage construction projects with metadata: name, location, type, start/end dates, contract value
- Budget structure: budgeted vs. projected vs. spent breakdown
- Execution phases with individual progress percentages
- Demand/resource items (quantity, unit, unit cost, total estimated cost)

### BIM Visualization (Sub-tabs: 3D / 4D / 5D)

**3D — Structural Model:**
- Three.js WebGL renderer renders the building as a stack of floor elements
- Color coding by progress: gray (not started), blue (in progress), green (complete), red (delayed)
- Orbit with mouse drag, zoom with scroll, reset with keyboard
- Shows floor labels and overall average progress

**4D — Timeline Simulation:**
- Date slider from project start to end date
- Elements appear on the canvas as their scheduled start date is reached
- Color mode: date-based gradient from early (blue) to late (orange)
- Enables "walk through construction" scenario review

**5D — Cost Heatmap:**
- Elements colored by unit cost: low (green) → medium (yellow) → high (red)
- Side panel: budget comparison table (orçado × projetado × gasto) per cost category
- Total cost-at-completion forecast updated in real-time

**Solves:**
- Replaces expensive standalone BIM tools (Revit, Navisworks) for basic project visualization
- Integrates schedule and cost in the same model — no need to export to separate tools
- Makes BIM accessible to engineers and clients without specialized training

---

## 5. Torre de Controle

**Purpose:** Mission-control view for multi-project portfolio management.

**What it does:**
- Full-screen portfolio overview with project cards arranged by status severity
- Live KPI tiles: total projects, on-track count, at-risk count, critical count
- Drill-down: click any project card to open its detail panel inline
- Comparison charts: cost performance index (CPI) and schedule performance index (SPI) per project
- Action items list: flagged issues requiring director attention with assignment and due date

**Solves:**
- Directors managing 10+ concurrent projects need a "war room" view — not 10 separate spreadsheets
- CPI/SPI metrics provide early warning before deadlines are missed
- Action items prevent issues from being buried in email threads

---

## 6. Mapa Interativo

**Purpose:** Leaflet-based interactive map editor for infrastructure networks (sewer, water, drainage, civil).

**What it does:**

### Map Editor
- Basemap options: Satellite, Streets, Dark (OpenStreetMap tiles)
- Tools: Add Node, Connect Nodes, Delete Node/Segment, Measure Distance, Structure Mode
- Node types: junction, endpoint, structure — with elevation and label metadata
- Segment types: sewer (esgoto), water (água), drainage (drenagem), civil, generic
- Each segment carries: diameter, material, depth, color, label
- Layers panel: toggle visibility per network type with color legend
- Undo history with full state stack

### UTM Import
- Import `.txt`/`.csv` files with `easting,northing[,elevation]` columns — no headers required
- **Auto-detection**: if values exceed lat/lng range (`|col1| > 360 || |col2| > 90`), UTM is detected automatically
- Zone and hemisphere selectors appear automatically (default: 24S for Southeast Brazil)
- Converts using the Karney UTM→WGS84 approximation
- Auto-generates node labels: `PV-01`, `PV-02`, ...
- **Connect as pipeline**: checkbox to create sequential segments between consecutive points (PV-01→PV-02→...→PV-39)
- Preview: shows point count and segment count before importing

### Analytics Panel (3D/4D/5D)
Toggle via "Análise 3D/4D/5D" button in the toolbar.

**Perfil 3D (Elevation):**
- SVG elevation profile chart along the network path
- Follows network topology (from/to node chains), falls back to node order
- KPIs: min/max/average elevation, total path length in km
- Cumulative distance on X axis, elevation (m) on Y axis

**Execução 4D (Timeline):**
- Lazy-loads `planejamentoStore` — no hard dependency
- Matches map segment labels to Planejamento trecho codes
- Displays Gantt bars for matched segments
- Falls back to full schedule if no label matches found

**Custo 5D (Cost):**
- Estimates cost from Haversine segment lengths × reference R$/m by network type
- Bar chart per network type with color coding
- Detail table: trechos count, extension (km), R$/m rate, estimated total cost
- Grand total KPIs: total R$, average R$/m, total km

### Other Features
- Save/Load JSON snapshots of the full map state
- Import from BIM module: converts BIM segments to map network elements
- Import from Planejamento: creates synthetic network from trecho list
- UTM Zone selector (18S–25S, 23N–24N)
- CRS Transform modal: convert a single UTM point for verification

**Solves:**
- Field engineers can import survey data (39+ points) directly from topographic instruments
- No GIS software required to visualize and edit sewer/water networks
- 3D/4D/5D analysis connects the physical network to the project schedule and budget

---

## 7. Pré-Construção

**Purpose:** Pre-construction due diligence, geotechnical data, and project feasibility.

**What it does:**
- Site characterization: soil profiles, borehole logs (SPT/CPT), groundwater levels
- Topographic survey import and visualization
- Feasibility checklist: permits, environmental licences, utility interference surveys
- Stakeholder register with contact details and approval status
- Risk matrix: pre-construction risks with probability × impact scoring
- Budget estimation at the conceptual phase (before detailed design)

**Solves:**
- Centralizes pre-construction documentation that typically lives in disconnected folders
- Ensures permit and licence status is always visible before construction starts
- Links geotechnical data to the execution plan to flag soil-related risks early

---

## 8. Suprimentos (Three-Way Match)

**Purpose:** Full procurement lifecycle with automated Three-Way Match validation.

**What it does:**

### Purchase Orders (PO)
- Create POs with line items, quantities, unit prices, and supplier data
- Approval workflow: draft → pending approval → approved → issued
- Link POs to cost centers and projects for automatic budget tracking

### Goods Receipts (GRN)
- Record deliveries against POs with actual received quantities and delivery date
- Flag partial deliveries and back-orders
- Condition notes and incident logging at receipt

### Invoices (NF)
- Register supplier invoices (Nota Fiscal) against POs
- Automatic Three-Way Match: compares PO quantity × GRN quantity × Invoice quantity
- Discrepancy detection: quantity variance, price variance, unmatched items
- Match status: ✓ Matched, ⚠ Partial Match, ✗ Mismatch

### Analytics
- Spend by supplier, by category, by project
- On-time delivery rate per supplier
- Payment aging: invoices pending approval past due date
- Price variance trend: contracted price vs. actual invoiced price

**Solves:**
- Eliminates manual spreadsheet comparison of PO/GRN/NF — a process that takes hours per week
- Prevents payment of invoices for goods not yet received
- Detects price inflation between approved PO and final invoice automatically

---

## 9. Mão de Obra

**Purpose:** Labor force management from registry to payroll generation.

**What it does:**

### Worker Registry
- Full worker profile: CPF, CTPS, function (cargo), CBO, admission date, base salary
- Contract type: CLT, temporary, subcontracted
- Active certifications (NR-10, NR-35, ASO) with expiry alerts

### Daily Allocation
- Allocate workers to projects and activities by day
- Absenteeism register: falta justificada, falta injustificada, licença médica, férias
- Hours by activity type: normal, extra (50%), extra (100%), noturno

### Payroll
- Monthly payroll calculation: base salary + extras + adicional noturno − INSS − IRRF − faltas
- INSS/IRRF progressive table applied automatically
- DSR (Descanso Semanal Remunerado) computation
- PDF payroll slip (holerite) generation per worker
- Aggregated payroll report by project and cost center

**Solves:**
- Replaces manual Excel payroll sheets that are error-prone and time-consuming
- Tracks certification expirations to prevent workers operating without valid safety certifications
- Allocates labor costs accurately to projects for JobCosting

---

## 10. Planejamento

**Purpose:** Schedule planning with a full Gantt editor, S-Curve analytics, and a deterministic schedule engine.

**What it does:**

### Trecho Registry
- Define work packages (trechos) with: code, description, predecessor dependencies, duration, required team type
- Productivity table: production rates per team type (m²/day, m³/day, m/day, etc.)
- Work calendars: configurable working days per week, national holidays

### Schedule Engine
- Forward-pass CPM scheduling: assigns work days considering team availability and dependencies
- **Delay simulation**: pass `TrechoDelay[]` to inject delays into specific trechos and see cascading impacts
- Outputs: `ganttRows[]`, `projectEndDate`, `workDays[]`, `totalCostBRL`

### Gantt View
- Interactive Gantt chart with bars per trecho, color-coded by status
- Critical path highlighting
- Zoom: day / week / month resolution
- Baseline comparison: original plan vs. current plan vs. actual progress

### S-Curve
- Planned vs. actual cumulative progress (% physical + % financial)
- Forecast at completion based on current SPI
- Export to PDF

### ABC Analysis
- Rank trechos by cost (Pareto): Class A (top 20% of items = 80% of cost), B, C
- Helps prioritize procurement and resource allocation

**Solves:**
- Replaces MS Project for basic critical-path scheduling without licensing costs
- Delay simulation answers "what if?" questions in real time without rebuilding the schedule manually
- S-Curve gives instant earned-value visibility without ERP integration

---

## 11. LPS / Lean

**Purpose:** Last Planner System implementation for collaborative, reliable production planning.

**What it does:**

### LookAhead (6-Week Rolling Plan)
- Weekly card board showing planned activities for the next 6 weeks
- Each card: trecho code, responsible team, start date, duration, constraints
- Status: Planned / Committed / Completed / Not Done
- Drag cards between weeks to reschedule

### PPC (Percent Plan Complete)
- Weekly PPC calculation: completed commitments ÷ total commitments × 100
- Trend chart: PPC over the last 12 weeks with control limits
- Root cause analysis for failures: design issue, supply delay, labor shortage, weather, etc.

### Restrições (Constraint Register)
- Log constraints blocking future activities: design drawings, material delivery, equipment, permit
- Fields: description, blocking trecho, responsible person, promised resolution date, status
- Traffic light: 🟢 resolved, 🟡 in progress, 🔴 overdue
- Weekly constraint review meeting support

### Analytics
- Failure reason breakdown (Pareto of root causes)
- Team reliability index per responsible crew
- Constraint closure rate over time

**Solves:**
- Reduces variability in weekly production by making commitments and constraints visible before the work week starts
- PPC metric is the simplest leading indicator of project health — it predicts schedule delays weeks in advance
- Constraint register prevents "I didn't know it was blocked" situations

---

## 12. RDO

**Purpose:** Digital Daily Field Report (Relatório Diário de Obra) replacing paper forms.

**What it does:**
- Date-stamped daily report with: project, responsible engineer, weather conditions
- Labor summary: workers present by trade with hours worked
- Equipment summary: machines on site with active/idle hours
- Activities log: what was built today (trecho, quantity, unit)
- Material deliveries: received materials with NF number and quantity
- Occurrence log: incidents, non-conformances, visitor notes, photographic evidence links
- Sign-off workflow: engineer → supervisor → client representative

**Solves:**
- Eliminates paper/PDF RDOs that are hard to aggregate for monthly progress reports
- Creates an auditable, timestamped record of daily production that is legally valid
- Feeds actual quantities back to the Planejamento module for progress updates

---

## 13. Quantitativos

**Purpose:** Bill of quantities with a unit cost library and automated cost estimation.

**What it does:**
- Item library: maintain a database of work items with unit (m, m², m³, kg, un, vb) and reference unit costs (SINAPI, SICRO, or custom)
- BOM (Bill of Materials): assemble quantities per project by linking items to design areas
- Cost estimation: auto-calculate total cost from quantity × unit cost
- Revision history: track changes in quantity estimates as design evolves
- Export: Excel-compatible CSV with item codes, quantities, unit costs, totals

**Solves:**
- Creates a single source of truth for quantities that feeds both the budget (Projetos) and procurement (Suprimentos)
- SINAPI/SICRO reference costs ensure estimates are market-aligned
- Revision tracking shows how the scope evolved from conceptual to detailed design

---

## 14. BIM 3D/4D/5D (Standalone)

**Purpose:** Standalone BIM viewer independent of the Projetos module.

**What it does:**
- Upload/import IFC-like project data or use synthetic data from the Projetos store
- Same Three.js renderer as the Projetos BIM tab (floors, colors, labels)
- Full 3D/4D/5D panel set: canvas + Bim4DPanel (timeline) + Bim5DPanel (cost)
- Color modes: default (per-segment color), date (4D temporal), cost (5D heatmap)
- Layer visibility control: show/hide structural, MEP, civil elements independently
- Camera presets: top view, front view, isometric, reset orbit

**Solves:**
- Allows BIM review without navigating through the full project management interface
- Supports standalone presentations to clients and stakeholders

---

## 15. Frota

**Purpose:** Fleet management for owned and rented heavy equipment and light vehicles.

**What it does:**
- Vehicle/equipment catalog: plate, model, year, type (truck, crane, excavator, car), ownership, daily cost
- Trip log: origin, destination, driver, km start/end, purpose
- Fuel log: date, liters, cost, km reading — auto-calculates consumption rate (km/L)
- Maintenance plan: scheduled services (oil, filters, tires) with alert 30 days before due
- Cost summary: fuel + maintenance + rental per vehicle per month, allocated to projects
- Driver registry with CNH category and validity tracking

**Solves:**
- Prevents untracked fuel costs that inflate project expenses
- CNH and maintenance alerts reduce legal and safety risks
- Accurate fleet cost per project feeds the JobCosting dashboard

---

## 16. Gestão 360

**Purpose:** Advanced project control: job costing, change order management, command center, and delay simulation.

**What it does:**

### JobCosting
- Real-time cost tracking by work breakdown structure (WBS) element
- CPI (Cost Performance Index) and SPI per WBS node
- Earned Value Management: BCWS, BCWP, ACWP, EAC, ETC
- Drill-down from portfolio → project → WBS → cost element
- Budget variance alerts when any element exceeds 10%

### Change Orders (Ordens de Mudança)
- Log scope changes with: description, requester, justification, cost impact, schedule impact
- Approval workflow: draft → under review → approved → rejected
- Cumulative change order value vs. original contract value
- Impact analysis: links change orders to affected Planejamento trechos

### Centro de Comando (Command Center)
- Full project dashboard: KPIs, progress bars, active alerts, team assignments
- Cross-module action feed: late deliveries (Suprimentos), expired certifications (Mão de Obra), unresolved constraints (LPS), overdue RDOs
- One-click navigation to the source of any alert

### Simulação de Atrasos (Delay Simulation)
- "What-if" analysis: add N days of delay to any trecho and instantly see the impact
- Runs `generateSchedule()` twice (base + with delays) and diffs the results
- KPI cards: original end date, new end date, total delay days, cost impact in R$
- SVG Gantt comparison: base schedule (gray) vs. delayed schedule (orange) side-by-side
- Multiple delays: stack delays on different trechos to simulate compound scenarios

**Solves:**
- JobCosting gives site managers real-time earned value without waiting for monthly accounting reports
- Change order tracking prevents scope creep from being absorbed silently into the budget
- Delay simulation answers contractual "what if?" questions in seconds — critical for penalty clause analysis

---

*CONSTRUDATA Platform Documentation — generated 2026-03-24*
