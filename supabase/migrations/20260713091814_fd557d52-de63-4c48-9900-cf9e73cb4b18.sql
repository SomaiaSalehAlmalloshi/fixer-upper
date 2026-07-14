
CREATE TYPE public.stress_type AS ENUM (
  'economic_crisis','inflation','interest_shock','currency_collapse',
  'mass_withdrawal','pandemic','oil_price_crash','political_crisis','custom'
);
CREATE TYPE public.stress_severity AS ENUM ('mild','moderate','severe','extreme');

CREATE TABLE public.stress_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  stress_type public.stress_type NOT NULL DEFAULT 'custom',
  severity public.stress_severity NOT NULL DEFAULT 'moderate',
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stress_scenarios TO authenticated;
GRANT ALL ON public.stress_scenarios TO service_role;
ALTER TABLE public.stress_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_read" ON public.stress_scenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "ss_insert" ON public.stress_scenarios FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "ss_update" ON public.stress_scenarios FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "ss_delete" ON public.stress_scenarios FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.stress_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES public.stress_scenarios(id) ON DELETE SET NULL,
  scenario_name TEXT NOT NULL,
  stress_type public.stress_type NOT NULL,
  severity public.stress_severity NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis TEXT,
  run_by UUID REFERENCES auth.users(id),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stress_runs TO authenticated;
GRANT ALL ON public.stress_runs TO service_role;
ALTER TABLE public.stress_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_read" ON public.stress_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "sr_insert" ON public.stress_runs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "sr_update" ON public.stress_runs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "sr_delete" ON public.stress_runs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.stress_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER stress_scen_biu BEFORE UPDATE ON public.stress_scenarios FOR EACH ROW EXECUTE FUNCTION public.stress_touch();

-- Seed presets
INSERT INTO public.stress_scenarios (name, description, stress_type, severity, is_preset, parameters) VALUES
('Global Economic Crisis','Broad recession across all asset classes','economic_crisis','severe',true,
  '{"gdp_shock":-0.05,"equity_shock":-0.35,"fx_shock":-0.15,"ir_shock_bp":150,"commodity_shock":-0.20,"oil_shock":-0.30,"pd_multiplier":2.5,"lgd_uplift":0.10,"deposit_runoff":0.20,"hqla_haircut":0.10}'),
('High Inflation','Sustained inflation, rate hikes, real income drop','inflation','moderate',true,
  '{"gdp_shock":-0.02,"equity_shock":-0.15,"fx_shock":-0.05,"ir_shock_bp":300,"commodity_shock":0.25,"oil_shock":0.30,"pd_multiplier":1.5,"lgd_uplift":0.05,"deposit_runoff":0.10,"hqla_haircut":0.05}'),
('Interest Rate Shock','Central bank +400bp emergency hike','interest_shock','severe',true,
  '{"ir_shock_bp":400,"equity_shock":-0.10,"fx_shock":0.05,"commodity_shock":-0.05,"oil_shock":0,"pd_multiplier":1.8,"lgd_uplift":0.05,"deposit_runoff":0.15,"hqla_haircut":0.03}'),
('Currency Collapse','Home currency devaluation 30%','currency_collapse','extreme',true,
  '{"fx_shock":-0.30,"ir_shock_bp":500,"equity_shock":-0.25,"commodity_shock":0.10,"oil_shock":0.15,"pd_multiplier":2.0,"lgd_uplift":0.15,"deposit_runoff":0.30,"hqla_haircut":0.15}'),
('Mass Deposit Withdrawal','Bank-run scenario, 40% retail run-off','mass_withdrawal','extreme',true,
  '{"fx_shock":-0.05,"ir_shock_bp":100,"equity_shock":-0.10,"commodity_shock":0,"oil_shock":0,"pd_multiplier":1.2,"lgd_uplift":0.05,"deposit_runoff":0.40,"hqla_haircut":0.20}'),
('Global Pandemic','Extended lockdowns, service sector collapse','pandemic','severe',true,
  '{"gdp_shock":-0.07,"equity_shock":-0.30,"fx_shock":-0.08,"ir_shock_bp":-100,"commodity_shock":-0.15,"oil_shock":-0.50,"pd_multiplier":3.0,"lgd_uplift":0.10,"deposit_runoff":0.15,"hqla_haircut":0.05}'),
('Oil Price Crash','Oil down 60%, energy sector distress','oil_price_crash','severe',true,
  '{"oil_shock":-0.60,"commodity_shock":-0.25,"equity_shock":-0.15,"fx_shock":-0.10,"ir_shock_bp":50,"pd_multiplier":1.8,"lgd_uplift":0.08,"deposit_runoff":0.08,"hqla_haircut":0.03}'),
('Political Crisis','Sovereign risk, capital flight','political_crisis','severe',true,
  '{"fx_shock":-0.20,"ir_shock_bp":250,"equity_shock":-0.20,"commodity_shock":0.05,"oil_shock":0.10,"pd_multiplier":2.0,"lgd_uplift":0.10,"deposit_runoff":0.25,"hqla_haircut":0.10}');
