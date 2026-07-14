
-- Enums
CREATE TYPE public.hqla_tier AS ENUM ('level1', 'level2a', 'level2b');
CREATE TYPE public.liq_bucket AS ENUM ('overnight','1w','1m','3m','6m','1y','gt1y');
CREATE TYPE public.liq_direction AS ENUM ('inflow','outflow');
CREATE TYPE public.funding_source_type AS ENUM ('retail_deposits','wholesale_deposits','repo','interbank','bond','equity','other');

-- HQLA
CREATE TABLE public.liq_hqla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier public.hqla_tier NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  market_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  haircut NUMERIC(6,4) NOT NULL DEFAULT 0,
  eligible_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  encumbered BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liq_hqla TO authenticated;
GRANT ALL ON public.liq_hqla TO service_role;
ALTER TABLE public.liq_hqla ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hqla_read" ON public.liq_hqla FOR SELECT TO authenticated USING (true);
CREATE POLICY "hqla_write" ON public.liq_hqla FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "hqla_update" ON public.liq_hqla FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "hqla_delete" ON public.liq_hqla FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Cash flows
CREATE TABLE public.liq_cashflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  direction public.liq_direction NOT NULL,
  bucket public.liq_bucket NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  cashflow_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stress_factor NUMERIC(6,4) NOT NULL DEFAULT 1,
  counterparty TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liq_cashflows TO authenticated;
GRANT ALL ON public.liq_cashflows TO service_role;
ALTER TABLE public.liq_cashflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cf_read" ON public.liq_cashflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "cf_write" ON public.liq_cashflows FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "cf_update" ON public.liq_cashflows FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "cf_delete" ON public.liq_cashflows FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Funding sources
CREATE TABLE public.liq_funding_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type public.funding_source_type NOT NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  tenor_days INTEGER NOT NULL DEFAULT 30,
  stable BOOLEAN NOT NULL DEFAULT false,
  asf_factor NUMERIC(6,4) NOT NULL DEFAULT 0.5,
  rsf_factor NUMERIC(6,4) NOT NULL DEFAULT 0.5,
  counterparty TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liq_funding_sources TO authenticated;
GRANT ALL ON public.liq_funding_sources TO service_role;
ALTER TABLE public.liq_funding_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fs_read" ON public.liq_funding_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "fs_write" ON public.liq_funding_sources FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "fs_update" ON public.liq_funding_sources FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "fs_delete" ON public.liq_funding_sources FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Stress scenarios
CREATE TABLE public.liq_stress_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  retail_runoff NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  wholesale_runoff NUMERIC(6,4) NOT NULL DEFAULT 0.40,
  extra_haircut NUMERIC(6,4) NOT NULL DEFAULT 0.05,
  inflow_haircut NUMERIC(6,4) NOT NULL DEFAULT 0.25,
  results JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liq_stress_scenarios TO authenticated;
GRANT ALL ON public.liq_stress_scenarios TO service_role;
ALTER TABLE public.liq_stress_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_read" ON public.liq_stress_scenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "ss_write" ON public.liq_stress_scenarios FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "ss_update" ON public.liq_stress_scenarios FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "ss_delete" ON public.liq_stress_scenarios FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Auto-calc HQLA eligible value + updated_at
CREATE OR REPLACE FUNCTION public.liq_hqla_calc() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.eligible_value := ROUND(NEW.market_value * (1 - NEW.haircut), 2);
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER liq_hqla_biu BEFORE INSERT OR UPDATE ON public.liq_hqla
  FOR EACH ROW EXECUTE FUNCTION public.liq_hqla_calc();

CREATE OR REPLACE FUNCTION public.liq_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER liq_cf_biu BEFORE UPDATE ON public.liq_cashflows FOR EACH ROW EXECUTE FUNCTION public.liq_touch();
CREATE TRIGGER liq_fs_biu BEFORE UPDATE ON public.liq_funding_sources FOR EACH ROW EXECUTE FUNCTION public.liq_touch();
CREATE TRIGGER liq_ss_biu BEFORE UPDATE ON public.liq_stress_scenarios FOR EACH ROW EXECUTE FUNCTION public.liq_touch();
