-- 0015_suprimentos.sql
-- Tabelas do módulo Suprimentos: PO, recebimentos, notas fiscais, fornecedores.
-- 3-way match (PO ↔ receipt ↔ invoice) é calculado client-side após pull.

-- Espelha o type POStatus do front (src/types/index.ts)
DO $$ BEGIN
  CREATE TYPE public.po_status AS ENUM ('open','partial','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('pending','pre_approved','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ════════════════════════════════════════════════════════════════════════
-- suppliers
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.suppliers (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  cnpj            text,
  name            text          NOT NULL,
  category        text,
  contact_name    text,
  phone           text,
  email           citext,
  payment_terms   text,
  payload         jsonb         NOT NULL DEFAULT '{}'::jsonb,

  created_by      uuid          NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  CONSTRAINT suppliers_unique_cnpj_per_org UNIQUE (organization_id, cnpj)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org        ON public.suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_org_active ON public.suppliers(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_org_name   ON public.suppliers(organization_id, name);

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- purchase_orders
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                  uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid              NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  code                text              NOT NULL,
  supplier            text              NOT NULL,    -- nome livre v1; v2: FK suppliers
  responsible         text,
  issued_date         date              NOT NULL,
  expected_delivery   date,
  project_ref         text,
  status              public.po_status  NOT NULL DEFAULT 'open',
  total_brl           numeric(14,2)     NOT NULL DEFAULT 0,

  -- payload: { items: POItem[] }
  payload             jsonb             NOT NULL DEFAULT '{}'::jsonb,

  created_by          uuid              NOT NULL REFERENCES auth.users(id),
  created_at          timestamptz       NOT NULL DEFAULT now(),
  updated_at          timestamptz       NOT NULL DEFAULT now(),
  deleted_at          timestamptz,

  CONSTRAINT po_unique_code_per_org UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_po_org            ON public.purchase_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_po_org_active     ON public.purchase_orders(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_po_org_status     ON public.purchase_orders(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_po_org_issued     ON public.purchase_orders(organization_id, issued_date DESC);

DROP TRIGGER IF EXISTS trg_po_updated_at ON public.purchase_orders;
CREATE TRIGGER trg_po_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- goods_receipts
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  po_id           uuid          REFERENCES public.purchase_orders(id) ON DELETE SET NULL,

  code            text          NOT NULL,
  received_date   date          NOT NULL,
  received_by     text,
  payload         jsonb         NOT NULL DEFAULT '{}'::jsonb,    -- items: GoodsReceiptItem[]

  created_by      uuid          NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gr_org        ON public.goods_receipts(organization_id);
CREATE INDEX IF NOT EXISTS idx_gr_org_po     ON public.goods_receipts(organization_id, po_id);
CREATE INDEX IF NOT EXISTS idx_gr_org_active ON public.goods_receipts(organization_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_gr_updated_at ON public.goods_receipts;
CREATE TRIGGER trg_gr_updated_at
  BEFORE UPDATE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- invoices
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.invoices (
  id              uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid                   NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  po_id           uuid                   REFERENCES public.purchase_orders(id) ON DELETE SET NULL,

  number          text                   NOT NULL,
  supplier        text                   NOT NULL,
  issue_date      date                   NOT NULL,
  due_date        date,
  total_amount    numeric(14,2)          NOT NULL DEFAULT 0,
  status          public.invoice_status  NOT NULL DEFAULT 'pending',

  payload         jsonb                  NOT NULL DEFAULT '{}'::jsonb,    -- items: InvoiceItem[]

  created_by      uuid                   NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz            NOT NULL DEFAULT now(),
  updated_at      timestamptz            NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_inv_org        ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_inv_org_po     ON public.invoices(organization_id, po_id);
CREATE INDEX IF NOT EXISTS idx_inv_org_status ON public.invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_org_active ON public.invoices(organization_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_inv_updated_at ON public.invoices;
CREATE TRIGGER trg_inv_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.suppliers       IS 'Cadastro de fornecedores.';
COMMENT ON TABLE public.purchase_orders IS 'Pedidos de compra. payload contém os line items.';
COMMENT ON TABLE public.goods_receipts  IS 'Recebimentos físicos. Liga PO via po_id.';
COMMENT ON TABLE public.invoices        IS 'Notas fiscais. 3-way match calculado client-side.';
