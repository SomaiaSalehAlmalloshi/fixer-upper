/*
# Reference Data: add Basel risk weights table, broaden write policies, add updated_at triggers

## Purpose
The reference tables (ref_currencies, ref_countries, ref_branches, etc.) already
exist in the database from a prior migration. This migration:
1. Creates the missing `ref_basel_risk_weights` table.
2. Broadens INSERT/UPDATE/DELETE policies on all ref_* tables to allow the
   `analyst` role in addition to `admin` (so analysts can manage reference data
   via the in-app Reference Data module, replacing the old Excel import).
3. Adds `updated_at` touch triggers to all ref_* tables that don't already have one.

## New Table
- **ref_basel_risk_weights** — Basel risk weight lookups. Natural key `code`.
  Columns: code, category, asset_class, counterparty_type, rating, risk_weight,
  description, active, notes, created_by, created_at, updated_at.

## Security
- All ref_* tables: SELECT for authenticated; INSERT/UPDATE/DELETE for admin + analyst.
- ref_basel_risk_weights: same pattern, 4 separate policies.

## Notes
- Existing table schemas are preserved (they use `label`/`name`/`notes` columns
  from the prior migration). No columns are added or removed on existing tables.
- Idempotent: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
*/

-- ============================================================
-- 1. Create ref_basel_risk_weights
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ref_basel_risk_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  counterparty_type TEXT,
  rating TEXT,
  risk_weight NUMERIC(6,4) NOT NULL CHECK (risk_weight >= 0 AND risk_weight <= 12.5),
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_basel_rw_lookup ON public.ref_basel_risk_weights (category, asset_class);
CREATE INDEX IF NOT EXISTS idx_ref_basel_rw_active ON public.ref_basel_risk_weights (active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ref_basel_risk_weights TO authenticated;
GRANT ALL ON public.ref_basel_risk_weights TO service_role;
ALTER TABLE public.ref_basel_risk_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ref_basel_risk_weights_select" ON public.ref_basel_risk_weights;
CREATE POLICY "ref_basel_risk_weights_select" ON public.ref_basel_risk_weights FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ref_basel_risk_weights_insert" ON public.ref_basel_risk_weights;
CREATE POLICY "ref_basel_risk_weights_insert" ON public.ref_basel_risk_weights FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
DROP POLICY IF EXISTS "ref_basel_risk_weights_update" ON public.ref_basel_risk_weights;
CREATE POLICY "ref_basel_risk_weights_update" ON public.ref_basel_risk_weights FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
DROP POLICY IF EXISTS "ref_basel_risk_weights_delete" ON public.ref_basel_risk_weights;
CREATE POLICY "ref_basel_risk_weights_delete" ON public.ref_basel_risk_weights FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));

-- ============================================================
-- 2. Broaden write policies on all existing ref_* tables to allow analyst
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'ref_currencies','ref_countries','ref_regions','ref_cities','ref_branches',
    'ref_departments','ref_customer_categories','ref_product_types','ref_loan_types',
    'ref_account_types','ref_asset_classes','ref_risk_categories',
    'ref_rating_grades','ref_collateral_types','ref_employment_types','ref_job_titles'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''analyst''));',
      t || '_insert', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''analyst''))
      WITH CHECK (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''analyst''));',
      t || '_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''analyst''));',
      t || '_delete', t);
  END LOOP;
END $$;

-- ============================================================
-- 3. updated_at trigger function + per-table triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.ref_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'ref_currencies','ref_countries','ref_regions','ref_cities','ref_branches',
    'ref_departments','ref_customer_categories','ref_product_types','ref_loan_types',
    'ref_account_types','ref_asset_classes','ref_risk_categories','ref_basel_risk_weights',
    'ref_rating_grades','ref_collateral_types','ref_employment_types','ref_job_titles'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_touch ON public.%s;
       CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON public.%s
         FOR EACH ROW EXECUTE FUNCTION public.ref_touch_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.ref_touch_updated_at() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 4. Seed ref_basel_risk_weights from the existing risk_weight_rules data
-- ============================================================
INSERT INTO public.ref_basel_risk_weights (code, category, asset_class, counterparty_type, rating, risk_weight, description)
SELECT
  'BRW_' || left(md5(row_number() OVER (ORDER BY category, asset_class, rating)::text), 8),
  category::text, asset_class, counterparty_type, rating, risk_weight, description
FROM public.risk_weight_rules
ON CONFLICT (code) DO NOTHING;
