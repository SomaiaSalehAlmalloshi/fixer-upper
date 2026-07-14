
-- Market Risk module
CREATE TYPE public.market_asset_class AS ENUM ('fx','ir','commodity','equity');
CREATE TYPE public.var_method AS ENUM ('parametric','historical','monte_carlo');

-- Positions
CREATE TABLE public.market_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_class public.market_asset_class NOT NULL,
  portfolio TEXT NOT NULL DEFAULT 'trading',
  currency TEXT NOT NULL DEFAULT 'USD',
  quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
  price NUMERIC(18,6) NOT NULL DEFAULT 0,
  notional NUMERIC(18,2) NOT NULL DEFAULT 0,
  market_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- IR
  duration NUMERIC(10,4) NOT NULL DEFAULT 0,
  convexity NUMERIC(10,4) NOT NULL DEFAULT 0,
  coupon_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  maturity_date DATE,
  -- Equity
  beta NUMERIC(8,4) NOT NULL DEFAULT 1,
  -- Common risk
  volatility NUMERIC(8,4) NOT NULL DEFAULT 0.10,
  -- Derived (computed by trigger)
  dv01 NUMERIC(18,2) NOT NULL DEFAULT 0,
  delta_1pct NUMERIC(18,2) NOT NULL DEFAULT 0,
  sensitivity NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_positions TO authenticated;
GRANT ALL ON public.market_positions TO service_role;
ALTER TABLE public.market_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_positions_read" ON public.market_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "market_positions_ins" ON public.market_positions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "market_positions_upd" ON public.market_positions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "market_positions_del" ON public.market_positions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.market_position_calc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Market value: qty * price if not set, else keep provided
  IF NEW.market_value = 0 THEN
    NEW.market_value := ROUND(NEW.quantity * NEW.price, 2);
  END IF;
  IF NEW.notional = 0 THEN
    NEW.notional := NEW.market_value;
  END IF;

  -- Derived sensitivities per asset class
  IF NEW.asset_class = 'ir' THEN
    -- DV01 = MV * duration * 0.0001
    NEW.dv01 := ROUND(NEW.market_value * NEW.duration * 0.0001, 2);
    NEW.sensitivity := ROUND(NEW.market_value * NEW.duration * 0.01, 2); -- 100bp
    NEW.delta_1pct := NEW.sensitivity;
  ELSIF NEW.asset_class = 'fx' THEN
    NEW.delta_1pct := ROUND(NEW.market_value * 0.01, 2);
    NEW.sensitivity := NEW.delta_1pct;
    NEW.dv01 := 0;
  ELSIF NEW.asset_class = 'equity' THEN
    NEW.delta_1pct := ROUND(NEW.market_value * NEW.beta * 0.01, 2);
    NEW.sensitivity := NEW.delta_1pct;
    NEW.dv01 := 0;
  ELSIF NEW.asset_class = 'commodity' THEN
    NEW.delta_1pct := ROUND(NEW.market_value * 0.01, 2);
    NEW.sensitivity := NEW.delta_1pct;
    NEW.dv01 := 0;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER market_position_calc_trg BEFORE INSERT OR UPDATE ON public.market_positions
  FOR EACH ROW EXECUTE FUNCTION public.market_position_calc();

-- VaR runs
CREATE TABLE public.market_var_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  method public.var_method NOT NULL DEFAULT 'parametric',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.99,
  horizon_days INT NOT NULL DEFAULT 1,
  portfolio_mv NUMERIC(18,2) NOT NULL DEFAULT 0,
  portfolio_volatility NUMERIC(8,4) NOT NULL DEFAULT 0,
  var_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  es_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  run_by UUID NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_var_runs TO authenticated;
GRANT ALL ON public.market_var_runs TO service_role;
ALTER TABLE public.market_var_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "var_read" ON public.market_var_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "var_ins" ON public.market_var_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "var_del" ON public.market_var_runs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Scenarios / stress tests
CREATE TABLE public.market_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  -- Shocks per asset class as decimal (e.g. 0.05 = +5%)
  fx_shock NUMERIC(6,4) NOT NULL DEFAULT 0,
  ir_shock_bp NUMERIC(8,2) NOT NULL DEFAULT 0,
  equity_shock NUMERIC(6,4) NOT NULL DEFAULT 0,
  commodity_shock NUMERIC(6,4) NOT NULL DEFAULT 0,
  pnl_impact NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_scenarios TO authenticated;
GRANT ALL ON public.market_scenarios TO service_role;
ALTER TABLE public.market_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scen_read" ON public.market_scenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "scen_ins" ON public.market_scenarios FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "scen_upd" ON public.market_scenarios FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "scen_del" ON public.market_scenarios FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Portfolio summary view (respects RLS)
CREATE VIEW public.market_risk_summary WITH (security_invoker=true) AS
SELECT
  asset_class,
  COUNT(*)::int AS position_count,
  COALESCE(SUM(market_value),0) AS total_mv,
  COALESCE(SUM(notional),0) AS total_notional,
  COALESCE(SUM(dv01),0) AS total_dv01,
  COALESCE(SUM(sensitivity),0) AS total_sensitivity,
  COALESCE(AVG(volatility),0) AS avg_volatility
FROM public.market_positions
GROUP BY asset_class;
GRANT SELECT ON public.market_risk_summary TO authenticated;
