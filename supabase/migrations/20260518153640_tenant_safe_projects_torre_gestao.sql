-- Tenant-safe hardening for project, Torre de Controle and Gestao 360 links.
-- Prevents records from one organization from pointing at parent records from
-- another organization, even if the client sends a malformed payload.

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_photos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.construction_sites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_photos FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_projects_torre_gestao_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_parent_org uuid;
BEGIN
  IF TG_TABLE_NAME = 'project_documents' THEN
    SELECT p.organization_id
      INTO v_parent_org
    FROM public.projects p
    WHERE p.id = NEW.project_id;

    IF v_parent_org IS NULL OR v_parent_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Projeto % nao pertence a organizacao %.', NEW.project_id, NEW.organization_id
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'construction_sites' THEN
    IF NEW.project_id IS NOT NULL THEN
      SELECT p.organization_id
        INTO v_parent_org
      FROM public.projects p
      WHERE p.id = NEW.project_id;

      IF v_parent_org IS NULL OR v_parent_org <> NEW.organization_id THEN
        RAISE EXCEPTION 'Projeto % nao pertence a organizacao %.', NEW.project_id, NEW.organization_id
          USING ERRCODE = '23514';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'change_orders' THEN
    IF NEW.project_id IS NOT NULL THEN
      SELECT p.organization_id
        INTO v_parent_org
      FROM public.projects p
      WHERE p.id = NEW.project_id;

      IF v_parent_org IS NULL OR v_parent_org <> NEW.organization_id THEN
        RAISE EXCEPTION 'Projeto % nao pertence a organizacao %.', NEW.project_id, NEW.organization_id
          USING ERRCODE = '23514';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'change_order_photos' THEN
    SELECT co.organization_id
      INTO v_parent_org
    FROM public.change_orders co
    WHERE co.id = NEW.change_order_id;

    IF v_parent_org IS NULL OR v_parent_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Ordem de mudanca % nao pertence a organizacao %.', NEW.change_order_id, NEW.organization_id
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_projects_torre_gestao_tenant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_projects_torre_gestao_tenant() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_projects_torre_gestao_tenant() FROM authenticated;

DROP TRIGGER IF EXISTS trg_project_documents_tenant_guard ON public.project_documents;
CREATE TRIGGER trg_project_documents_tenant_guard
  BEFORE INSERT OR UPDATE OF organization_id, project_id
  ON public.project_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_projects_torre_gestao_tenant();

DROP TRIGGER IF EXISTS trg_construction_sites_tenant_guard ON public.construction_sites;
CREATE TRIGGER trg_construction_sites_tenant_guard
  BEFORE INSERT OR UPDATE OF organization_id, project_id
  ON public.construction_sites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_projects_torre_gestao_tenant();

DROP TRIGGER IF EXISTS trg_change_orders_tenant_guard ON public.change_orders;
CREATE TRIGGER trg_change_orders_tenant_guard
  BEFORE INSERT OR UPDATE OF organization_id, project_id
  ON public.change_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_projects_torre_gestao_tenant();

DROP TRIGGER IF EXISTS trg_change_order_photos_tenant_guard ON public.change_order_photos;
CREATE TRIGGER trg_change_order_photos_tenant_guard
  BEFORE INSERT OR UPDATE OF organization_id, change_order_id
  ON public.change_order_photos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_projects_torre_gestao_tenant();
