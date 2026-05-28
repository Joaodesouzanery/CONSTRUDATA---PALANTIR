-- 0029_frotas_geo.sql
-- Sprint 5 — Frotas/Ativos + Geo: cria 18 tabelas para os 6 módulos.
--
-- Padrão: idêntico a 0019/0022.
--   - PK uuid
--   - organization_id NOT NULL FK -> organizations(id)
--   - project_id uuid REFERENCES projects(id) ON DELETE SET NULL (nullable)
--   - created_by FK -> auth.users
--   - created_at / updated_at / deleted_at (soft-delete)
--   - payload jsonb com a entidade completa serializada
-- RLS aplicada em 0030. Aprovações em 0031.

-- ════════════════════════════════════════════════════════════════════════
-- Equipamentos (2)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.equipamentos (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  code            text,
  name            text,
  type            text,
  status          text NOT NULL DEFAULT 'idle',
  lat             double precision,
  lng             double precision,
  site_name       text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_equipamentos_org          ON public.equipamentos(organization_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_org_created  ON public.equipamentos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipamentos_org_active   ON public.equipamentos(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_equipamentos_status       ON public.equipamentos(status);
CREATE INDEX IF NOT EXISTS idx_equipamentos_project      ON public.equipamentos(project_id);

CREATE TABLE IF NOT EXISTS public.equipamentos_manutencoes (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  equipment_id    uuid,
  type            text,
  status          text NOT NULL DEFAULT 'scheduled',
  scheduled_date  date,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_eq_man_org          ON public.equipamentos_manutencoes(organization_id);
CREATE INDEX IF NOT EXISTS idx_eq_man_org_created  ON public.equipamentos_manutencoes(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eq_man_org_active   ON public.equipamentos_manutencoes(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_eq_man_equipment    ON public.equipamentos_manutencoes(equipment_id);
CREATE INDEX IF NOT EXISTS idx_eq_man_status       ON public.equipamentos_manutencoes(status);

-- ════════════════════════════════════════════════════════════════════════
-- Frota Veicular (9)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.veiculos (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  plate           text,
  make            text,
  model           text,
  status          text NOT NULL DEFAULT 'active',
  current_km      integer,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_veiculos_org          ON public.veiculos(organization_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_org_created  ON public.veiculos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_veiculos_org_active   ON public.veiculos(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_veiculos_plate        ON public.veiculos(plate);

CREATE TABLE IF NOT EXISTS public.fleet_drivers (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text,
  cpf_masked      text,
  license_number  text,
  license_expiry  date,
  status          text NOT NULL DEFAULT 'active',
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fleet_drivers_org          ON public.fleet_drivers(organization_id);
CREATE INDEX IF NOT EXISTS idx_fleet_drivers_org_created  ON public.fleet_drivers(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_drivers_org_active   ON public.fleet_drivers(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fleet_fuel_records (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id      uuid,
  date            date,
  liters          numeric(10,2),
  total_cost      numeric(12,2),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fleet_fuel_org          ON public.fleet_fuel_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_fleet_fuel_org_created  ON public.fleet_fuel_records(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_fuel_org_active   ON public.fleet_fuel_records(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_fuel_vehicle      ON public.fleet_fuel_records(vehicle_id);

CREATE TABLE IF NOT EXISTS public.fleet_vehicle_maintenance (
  id                uuid PRIMARY KEY,
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id        uuid,
  service_date      date,
  next_service_date date,
  status            text,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by        uuid NOT NULL REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fleet_vmaint_org          ON public.fleet_vehicle_maintenance(organization_id);
CREATE INDEX IF NOT EXISTS idx_fleet_vmaint_org_created  ON public.fleet_vehicle_maintenance(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_vmaint_org_active   ON public.fleet_vehicle_maintenance(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_vmaint_vehicle      ON public.fleet_vehicle_maintenance(vehicle_id);

CREATE TABLE IF NOT EXISTS public.fleet_routes (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id      uuid,
  driver_id       uuid,
  date            date,
  status          text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fleet_routes_org          ON public.fleet_routes(organization_id);
CREATE INDEX IF NOT EXISTS idx_fleet_routes_org_created  ON public.fleet_routes(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_routes_org_active   ON public.fleet_routes(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_routes_vehicle      ON public.fleet_routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_routes_date         ON public.fleet_routes(date);

CREATE TABLE IF NOT EXISTS public.fleet_service_orders (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id      uuid,
  code            text,
  status          text,
  priority        text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fleet_so_org          ON public.fleet_service_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_fleet_so_org_created  ON public.fleet_service_orders(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_so_org_active   ON public.fleet_service_orders(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_so_vehicle      ON public.fleet_service_orders(vehicle_id);

CREATE TABLE IF NOT EXISTS public.fleet_fines (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id      uuid,
  driver_id       uuid,
  date            date,
  status          text,
  due_date        date,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fleet_fines_org          ON public.fleet_fines(organization_id);
CREATE INDEX IF NOT EXISTS idx_fleet_fines_org_created  ON public.fleet_fines(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_fines_org_active   ON public.fleet_fines(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fleet_alerts (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id      uuid,
  severity        text,
  is_active       boolean DEFAULT true,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fleet_alerts_org          ON public.fleet_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_fleet_alerts_org_created  ON public.fleet_alerts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_alerts_org_active   ON public.fleet_alerts(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fleet_schedules (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id      uuid,
  scheduled_date  date,
  status          text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fleet_sched_org          ON public.fleet_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_fleet_sched_org_created  ON public.fleet_schedules(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_sched_org_active   ON public.fleet_schedules(organization_id) WHERE deleted_at IS NULL;

-- ════════════════════════════════════════════════════════════════════════
-- Otimização Frota (3) — outputs/histórico das engines
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.otimizacao_routing_recommendations (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  equipment_id    uuid,
  priority        text,
  accepted        boolean,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_otrr_org          ON public.otimizacao_routing_recommendations(organization_id);
CREATE INDEX IF NOT EXISTS idx_otrr_org_created  ON public.otimizacao_routing_recommendations(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otrr_org_active   ON public.otimizacao_routing_recommendations(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.otimizacao_health_scores (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  equipment_id    uuid,
  risk_level      text,
  health_score    integer,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_oths_org          ON public.otimizacao_health_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_oths_org_created  ON public.otimizacao_health_scores(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oths_org_active   ON public.otimizacao_health_scores(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_oths_equipment    ON public.otimizacao_health_scores(equipment_id);

CREATE TABLE IF NOT EXISTS public.otimizacao_buy_lease_analyses (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  equipment_type  text,
  recommendation  text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_otbl_org          ON public.otimizacao_buy_lease_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_otbl_org_created  ON public.otimizacao_buy_lease_analyses(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otbl_org_active   ON public.otimizacao_buy_lease_analyses(organization_id) WHERE deleted_at IS NULL;

-- ════════════════════════════════════════════════════════════════════════
-- Mapa Interativo (1) — 1 row por mapa, payload contém nodes/segments/layers
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mapas_interativos (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name            text,
  map_mode        text,        -- 'saneamento'|'construcao'|null
  basemap         text,        -- 'satellite'|'streets'|'dark'|'light'|'outdoors'
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { nodes[], segments[], layers[] }
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mapas_org          ON public.mapas_interativos(organization_id);
CREATE INDEX IF NOT EXISTS idx_mapas_org_created  ON public.mapas_interativos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mapas_org_active   ON public.mapas_interativos(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mapas_project      ON public.mapas_interativos(project_id);

-- ════════════════════════════════════════════════════════════════════════
-- Rede 360 (3)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rede_ativos (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  asset_type      text NOT NULL,   -- 'network'|'circuit'|'device'|'weather'|'customer'|'structure'|'vegetation'|'hardening'
  code            text,
  name            text,
  lat             double precision,
  lng             double precision,
  network_type    text,
  status          text,
  risk_level      text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_rede_ativos_org          ON public.rede_ativos(organization_id);
CREATE INDEX IF NOT EXISTS idx_rede_ativos_org_created  ON public.rede_ativos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rede_ativos_org_active   ON public.rede_ativos(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rede_ativos_type         ON public.rede_ativos(asset_type);
CREATE INDEX IF NOT EXISTS idx_rede_ativos_status       ON public.rede_ativos(status);

CREATE TABLE IF NOT EXISTS public.rede_service_orders (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id        uuid,
  code            text,
  status          text,
  priority        text,
  scheduled_date  date,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_rede_so_org          ON public.rede_service_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_rede_so_org_created  ON public.rede_service_orders(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rede_so_org_active   ON public.rede_service_orders(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rede_so_asset        ON public.rede_service_orders(asset_id);

CREATE TABLE IF NOT EXISTS public.rede_outages (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type            text,
  status          text,
  start_time      timestamptz,
  resolved_time   timestamptz,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_rede_outages_org          ON public.rede_outages(organization_id);
CREATE INDEX IF NOT EXISTS idx_rede_outages_org_created  ON public.rede_outages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rede_outages_org_active   ON public.rede_outages(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rede_outages_status       ON public.rede_outages(status);
