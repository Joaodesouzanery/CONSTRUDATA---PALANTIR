-- 0048_rdo_quality_measurement_sync.sql
-- Automatic auditable sync from finalized RDOs and Quality NCs into Medicao.

ALTER TABLE public.measurement_sources
  ADD COLUMN IF NOT EXISTS source_uid text,
  ADD COLUMN IF NOT EXISTS source_date date,
  ADD COLUMN IF NOT EXISTS quality_status text NOT NULL DEFAULT 'clear',
  ADD COLUMN IF NOT EXISTS quality_nc_id uuid REFERENCES public.quality_non_conformities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality_note text,
  ADD CONSTRAINT measurement_sources_quality_status_check
    CHECK (quality_status IN ('clear', 'pending_quality', 'blocked_by_nc', 'released', 'glosa_review'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_measurement_sources_source_uid_active
  ON public.measurement_sources(organization_id, source_uid)
  WHERE deleted_at IS NULL AND source_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_measurement_sources_org_date
  ON public.measurement_sources(organization_id, source_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_measurement_sources_quality
  ON public.measurement_sources(organization_id, quality_status, quality_nc_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.measurement_quality_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  nc_id uuid NOT NULL REFERENCES public.quality_non_conformities(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.measurement_sources(id) ON DELETE SET NULL,
  rdo_id text,
  rdo_type text,
  service_code text,
  status text NOT NULL DEFAULT 'pending',
  severity text NOT NULL DEFAULT 'medium',
  note text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT measurement_quality_flags_status_check CHECK (status IN ('pending', 'blocked', 'released', 'rejected', 'glosa_review')),
  CONSTRAINT measurement_quality_flags_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT measurement_quality_flags_rdo_type_check CHECK (rdo_type IS NULL OR rdo_type IN ('regular', 'sabesp'))
);

CREATE INDEX IF NOT EXISTS idx_measurement_quality_flags_org_nc
  ON public.measurement_quality_flags(organization_id, nc_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_measurement_quality_flags_org_source
  ON public.measurement_quality_flags(organization_id, source_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_measurement_quality_flags_updated_at ON public.measurement_quality_flags;
CREATE TRIGGER trg_measurement_quality_flags_updated_at
  BEFORE UPDATE ON public.measurement_quality_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.measurement_quality_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_quality_flags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS measurement_quality_flags_select_own_org ON public.measurement_quality_flags;
CREATE POLICY measurement_quality_flags_select_own_org ON public.measurement_quality_flags
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL);

DROP POLICY IF EXISTS measurement_quality_flags_insert_with_role ON public.measurement_quality_flags;
CREATE POLICY measurement_quality_flags_insert_with_role ON public.measurement_quality_flags
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.user_org()
    AND created_by = auth.uid()
    AND public.has_role(ARRAY['engenheiro','qualidade','gerente','diretor','owner']::public.user_role[])
  );

DROP POLICY IF EXISTS measurement_quality_flags_update_own_org ON public.measurement_quality_flags;
CREATE POLICY measurement_quality_flags_update_own_org ON public.measurement_quality_flags
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS measurement_quality_flags_delete_blocked ON public.measurement_quality_flags;
CREATE POLICY measurement_quality_flags_delete_blocked ON public.measurement_quality_flags
  FOR DELETE TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.measurement_source_quality_from_nc_status(p_nc_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_nc_status
    WHEN 'aberta' THEN 'blocked_by_nc'
    WHEN 'em_tratamento' THEN 'pending_quality'
    WHEN 'concluida' THEN 'released'
    WHEN 'ineficaz' THEN 'glosa_review'
    ELSE 'pending_quality'
  END;
$$;

CREATE OR REPLACE FUNCTION public.measurement_flag_status_from_nc_status(p_nc_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_nc_status
    WHEN 'aberta' THEN 'blocked'
    WHEN 'em_tratamento' THEN 'pending'
    WHEN 'concluida' THEN 'released'
    WHEN 'ineficaz' THEN 'glosa_review'
    ELSE 'pending'
  END;
$$;

CREATE OR REPLACE FUNCTION public.try_numeric(p_value text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean text;
BEGIN
  IF p_value IS NULL OR trim(p_value) = '' THEN
    RETURN 0;
  END IF;

  v_clean := replace(regexp_replace(p_value, '[^0-9,.-]', '', 'g'), ',', '.');
  RETURN COALESCE(v_clean::numeric, 0);
EXCEPTION WHEN others THEN
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_rdo_sabesp_to_measurement(p_rdo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rdo public.rdo_sabesp%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  SELECT * INTO v_rdo
  FROM public.rdo_sabesp
  WHERE id = p_rdo_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  UPDATE public.measurement_sources
     SET deleted_at = now(),
         updated_at = now()
   WHERE organization_id = v_rdo.organization_id
     AND rdo_type = 'sabesp'
     AND rdo_id = v_rdo.id::text
     AND source_kind = 'rdo_sabesp'
     AND deleted_at IS NULL;

  IF v_rdo.deleted_at IS NOT NULL OR v_rdo.status <> 'finalized' THEN
    RETURN 0;
  END IF;

  INSERT INTO public.measurement_sources (
    organization_id,
    created_by,
    rdo_id,
    rdo_type,
    contractor_id,
    nucleo,
    source_kind,
    source_uid,
    source_date,
    service_code,
    service_description,
    unit,
    quantity,
    amount,
    origin_label,
    source_payload
  )
  SELECT
    v_rdo.organization_id,
    v_rdo.created_by,
    v_rdo.id::text,
    'sabesp',
    link.contractor_id,
    COALESCE(NULLIF(v_rdo.criadouro, ''), NULLIF(v_rdo.criadouro_outro, '')),
    'rdo_sabesp',
    format('rdo_sabesp:%s:%s:%s', v_rdo.id, service_rows.family, service_rows.ordinality),
    v_rdo.report_date,
    NULLIF(service_rows.item->>'codigo', ''),
    COALESCE(NULLIF(service_rows.item->>'descricao', ''), 'Servico RDO Sabesp'),
    NULLIF(service_rows.item->>'unidade', ''),
    public.try_numeric(service_rows.item->>'quantidade'),
    public.try_numeric(service_rows.item->>'quantidade') * COALESCE(price.unit_price, 0),
    'RDO Sabesp',
    jsonb_build_object(
      'family', service_rows.family,
      'row_index', service_rows.ordinality,
      'service', service_rows.item,
      'report_date', v_rdo.report_date,
      'encarregado', v_rdo.encarregado,
      'rua_beco', v_rdo.rua_beco,
      'criadouro', v_rdo.criadouro,
      'criadouro_outro', v_rdo.criadouro_outro,
      'planilha_foto_path', v_rdo.planilha_foto_path,
      'assinatura_empreiteira_presente', COALESCE(v_rdo.assinatura_empreiteira_path IS NOT NULL OR v_rdo.assinatura_empreiteira_url IS NOT NULL, false),
      'assinatura_consorcio_presente', COALESCE(v_rdo.assinatura_consorcio_path IS NOT NULL OR v_rdo.assinatura_consorcio_url IS NOT NULL, false),
      'parser_status', v_rdo.parser_status,
      'parser_provider', v_rdo.parser_provider,
      'parser_model', v_rdo.parser_model
    )
  FROM (
    SELECT 'esgoto' AS family, item, ordinality
    FROM jsonb_array_elements(COALESCE(v_rdo.servicos_esgoto, '[]'::jsonb)) WITH ORDINALITY AS source(item, ordinality)
    UNION ALL
    SELECT 'agua' AS family, item, ordinality
    FROM jsonb_array_elements(COALESCE(v_rdo.servicos_agua, '[]'::jsonb)) WITH ORDINALITY AS source(item, ordinality)
  ) service_rows
  LEFT JOIN public.rdo_contractor_links link
    ON link.organization_id = v_rdo.organization_id
   AND link.rdo_type = 'sabesp'
   AND link.rdo_id = v_rdo.id::text
  LEFT JOIN public.contract_price_items price
    ON price.organization_id = v_rdo.organization_id
   AND price.code = NULLIF(service_rows.item->>'codigo', '')
   AND price.deleted_at IS NULL
  WHERE public.try_numeric(service_rows.item->>'quantidade') <> 0
     OR COALESCE(NULLIF(service_rows.item->>'codigo', ''), NULLIF(service_rows.item->>'descricao', '')) IS NOT NULL;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (
    v_rdo.organization_id,
    v_rdo.created_by,
    'sync_rdo_sabesp_measurement',
    'measurement_sources',
    v_rdo.id::text,
    jsonb_build_object('inserted_rows', v_inserted, 'rdo_id', v_rdo.id)
  );

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_regular_rdo_to_measurement(p_rdo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rdo public.rdo%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  SELECT * INTO v_rdo
  FROM public.rdo
  WHERE id = p_rdo_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  UPDATE public.measurement_sources
     SET deleted_at = now(),
         updated_at = now()
   WHERE organization_id = v_rdo.organization_id
     AND rdo_type = 'regular'
     AND rdo_id = v_rdo.id::text
     AND source_kind = 'rdo'
     AND deleted_at IS NULL;

  IF v_rdo.deleted_at IS NOT NULL OR v_rdo.closed IS NOT TRUE THEN
    RETURN 0;
  END IF;

  INSERT INTO public.measurement_sources (
    organization_id,
    created_by,
    rdo_id,
    rdo_type,
    contractor_id,
    nucleo,
    source_kind,
    source_uid,
    source_date,
    service_code,
    service_description,
    unit,
    quantity,
    amount,
    origin_label,
    source_payload
  )
  SELECT
    v_rdo.organization_id,
    v_rdo.created_by,
    v_rdo.id::text,
    'regular',
    link.contractor_id,
    COALESCE(v_rdo.payload->>'nucleo', v_rdo.payload->>'criadouro', v_rdo.payload->>'front'),
    'rdo',
    format('rdo:%s:services:%s', v_rdo.id, service_rows.ordinality),
    v_rdo.date,
    COALESCE(NULLIF(service_rows.item->>'codigo', ''), NULLIF(service_rows.item->>'code', '')),
    COALESCE(NULLIF(service_rows.item->>'descricao', ''), NULLIF(service_rows.item->>'description', ''), NULLIF(service_rows.item->>'name', ''), 'Servico RDO'),
    COALESCE(NULLIF(service_rows.item->>'unidade', ''), NULLIF(service_rows.item->>'unit', '')),
    COALESCE(
      public.try_numeric(service_rows.item->>'quantidade'),
      public.try_numeric(service_rows.item->>'quantity')
    ),
    COALESCE(
      public.try_numeric(service_rows.item->>'quantidade'),
      public.try_numeric(service_rows.item->>'quantity')
    ) * COALESCE(price.unit_price, 0),
    'RDO',
    jsonb_build_object(
      'row_index', service_rows.ordinality,
      'service', service_rows.item,
      'date', v_rdo.date,
      'responsible', v_rdo.responsible,
      'project_id', v_rdo.project_id,
      'contract_no', v_rdo.contract_no,
      'service_order_no', v_rdo.service_order_no
    )
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(v_rdo.payload->'services') = 'array' THEN v_rdo.payload->'services'
      WHEN jsonb_typeof(v_rdo.payload->'servicos') = 'array' THEN v_rdo.payload->'servicos'
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS service_rows(item, ordinality)
  LEFT JOIN public.rdo_contractor_links link
    ON link.organization_id = v_rdo.organization_id
   AND link.rdo_type = 'regular'
   AND link.rdo_id = v_rdo.id::text
  LEFT JOIN public.contract_price_items price
    ON price.organization_id = v_rdo.organization_id
   AND price.code = COALESCE(NULLIF(service_rows.item->>'codigo', ''), NULLIF(service_rows.item->>'code', ''))
   AND price.deleted_at IS NULL
  WHERE COALESCE(NULLIF(service_rows.item->>'codigo', ''), NULLIF(service_rows.item->>'code', ''), NULLIF(service_rows.item->>'descricao', ''), NULLIF(service_rows.item->>'description', ''), NULLIF(service_rows.item->>'name', '')) IS NOT NULL;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (
    v_rdo.organization_id,
    v_rdo.created_by,
    'sync_rdo_measurement',
    'measurement_sources',
    v_rdo.id::text,
    jsonb_build_object('inserted_rows', v_inserted, 'rdo_id', v_rdo.id)
  );

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_quality_nc_to_measurement(p_nc_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nc public.quality_non_conformities%ROWTYPE;
  v_flag_id uuid;
  v_source_id uuid;
  v_rdo_id text;
  v_rdo_type text;
  v_service_code text;
  v_status text;
BEGIN
  SELECT * INTO v_nc
  FROM public.quality_non_conformities
  WHERE id = p_nc_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  UPDATE public.measurement_quality_flags
     SET deleted_at = now(),
         updated_at = now()
   WHERE organization_id = v_nc.organization_id
     AND nc_id = v_nc.id
     AND deleted_at IS NULL;

  UPDATE public.measurement_sources
     SET quality_status = 'clear',
         quality_nc_id = NULL,
         quality_note = NULL,
         updated_at = now()
   WHERE organization_id = v_nc.organization_id
     AND quality_nc_id = v_nc.id
     AND deleted_at IS NULL;

  IF v_nc.deleted_at IS NOT NULL THEN
    RETURN 0;
  END IF;

  v_rdo_id := COALESCE(v_nc.payload->>'rdo_id', v_nc.payload->>'rdoId', v_nc.payload->>'rdo_sabesp_id');
  v_rdo_type := COALESCE(v_nc.payload->>'rdo_type', v_nc.payload->>'rdoType');
  v_service_code := COALESCE(v_nc.payload->>'service_code', v_nc.payload->>'serviceCode', v_nc.payload->>'codigo');
  v_status := public.measurement_source_quality_from_nc_status(v_nc.status);

  IF v_rdo_type IS NULL AND v_rdo_id IS NOT NULL THEN
    v_rdo_type := CASE
      WHEN EXISTS (
        SELECT 1 FROM public.rdo_sabesp
        WHERE organization_id = v_nc.organization_id
          AND id::text = v_rdo_id
      ) THEN 'sabesp'
      ELSE 'regular'
    END;
  END IF;

  SELECT ms.id
    INTO v_source_id
  FROM public.measurement_sources ms
  WHERE ms.organization_id = v_nc.organization_id
    AND ms.deleted_at IS NULL
    AND (v_rdo_id IS NULL OR ms.rdo_id = v_rdo_id)
    AND (v_rdo_type IS NULL OR ms.rdo_type = v_rdo_type)
    AND (v_service_code IS NULL OR ms.service_code = v_service_code)
  ORDER BY ms.created_at DESC
  LIMIT 1;

  INSERT INTO public.measurement_quality_flags (
    organization_id,
    created_by,
    nc_id,
    source_id,
    rdo_id,
    rdo_type,
    service_code,
    status,
    severity,
    note,
    payload
  )
  VALUES (
    v_nc.organization_id,
    v_nc.created_by,
    v_nc.id,
    v_source_id,
    v_rdo_id,
    v_rdo_type,
    v_service_code,
    public.measurement_flag_status_from_nc_status(v_nc.status),
    COALESCE(NULLIF(v_nc.payload->>'severity', ''), 'medium'),
    COALESCE(NULLIF(v_nc.payload->>'measurement_note', ''), NULLIF(v_nc.payload->>'note', ''), v_nc.nc_number),
    jsonb_build_object(
      'nc_number', v_nc.nc_number,
      'date', v_nc.date,
      'location', v_nc.location,
      'status', v_nc.status,
      'payload', v_nc.payload
    )
  )
  RETURNING id INTO v_flag_id;

  IF v_source_id IS NOT NULL THEN
    UPDATE public.measurement_sources
       SET quality_status = v_status,
           quality_nc_id = v_nc.id,
           quality_note = COALESCE(NULLIF(v_nc.payload->>'measurement_note', ''), NULLIF(v_nc.payload->>'note', ''), v_nc.nc_number),
           updated_at = now()
     WHERE id = v_source_id
       AND organization_id = v_nc.organization_id;
  END IF;

  INSERT INTO public.audit_log (organization_id, actor_id, action, table_name, record_id, after)
  VALUES (
    v_nc.organization_id,
    v_nc.created_by,
    'sync_quality_measurement',
    'measurement_quality_flags',
    v_flag_id::text,
    jsonb_build_object('nc_id', v_nc.id, 'source_id', v_source_id, 'quality_status', v_status)
  );

  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_rdo_sabesp_measurement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_rdo_sabesp_to_measurement(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_regular_rdo_measurement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_regular_rdo_to_measurement(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_quality_nc_measurement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_quality_nc_to_measurement(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rdo_sabesp_measurement_sync ON public.rdo_sabesp;
CREATE TRIGGER trg_rdo_sabesp_measurement_sync
  AFTER INSERT OR UPDATE OF status, deleted_at, servicos_esgoto, servicos_agua, criadouro, criadouro_outro, report_date, encarregado, rua_beco, planilha_foto_path, assinatura_empreiteira_path, assinatura_consorcio_path
  ON public.rdo_sabesp
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_rdo_sabesp_measurement();

DROP TRIGGER IF EXISTS trg_rdo_measurement_sync ON public.rdo;
CREATE TRIGGER trg_rdo_measurement_sync
  AFTER INSERT OR UPDATE OF closed, deleted_at, payload, date, responsible, project_id, contract_no, service_order_no
  ON public.rdo
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_regular_rdo_measurement();

DROP TRIGGER IF EXISTS trg_quality_nc_measurement_sync ON public.quality_non_conformities;
CREATE TRIGGER trg_quality_nc_measurement_sync
  AFTER INSERT OR UPDATE OF status, deleted_at, payload, nc_number, date, location
  ON public.quality_non_conformities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_quality_nc_measurement();

GRANT EXECUTE ON FUNCTION public.sync_rdo_sabesp_to_measurement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_regular_rdo_to_measurement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_quality_nc_to_measurement(uuid) TO authenticated;

COMMENT ON TABLE public.measurement_quality_flags IS
  'Quality impacts linked to measurement sources. Keeps NC effects auditable without deleting measured production.';

COMMENT ON FUNCTION public.sync_rdo_sabesp_to_measurement(uuid) IS
  'Rebuilds measurement_sources rows from finalized RDO Sabesp services.';

COMMENT ON FUNCTION public.sync_regular_rdo_to_measurement(uuid) IS
  'Rebuilds measurement_sources rows from closed regular RDO payload services.';

COMMENT ON FUNCTION public.sync_quality_nc_to_measurement(uuid) IS
  'Creates measurement quality flags from Quality non-conformities and marks matched measurement sources.';
