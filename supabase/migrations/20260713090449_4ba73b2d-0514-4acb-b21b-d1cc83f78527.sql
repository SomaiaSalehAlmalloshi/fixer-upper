-- BASE RWA SCHEMA
CREATE TYPE public.app_role AS ENUM ('admin', 'approver', 'analyst', 'viewer');
CREATE TYPE public.rwa_category AS ENUM ('credit', 'market', 'operational');
CREATE TYPE public.approval_status AS ENUM ('draft', 'pending', 'approved', 'rejected');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles admin manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'analyst');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.risk_weight_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.rwa_category NOT NULL,
  asset_class TEXT NOT NULL,
  counterparty_type TEXT, rating TEXT,
  risk_weight NUMERIC(6,4) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.risk_weight_rules (category, asset_class);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_weight_rules TO authenticated;
GRANT ALL ON public.risk_weight_rules TO service_role;
ALTER TABLE public.risk_weight_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules readable" ON public.risk_weight_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules admin write" ON public.risk_weight_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.rwa_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL, name TEXT NOT NULL,
  category public.rwa_category NOT NULL,
  asset_class TEXT NOT NULL,
  counterparty_type TEXT, rating TEXT,
  exposure_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  risk_weight NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  rwa_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.approval_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.rwa_assets (category);
CREATE INDEX ON public.rwa_assets (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rwa_assets TO authenticated;
GRANT ALL ON public.rwa_assets TO service_role;
ALTER TABLE public.rwa_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets readable" ON public.rwa_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets analyst insert" ON public.rwa_assets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'analyst') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "assets update by role" ON public.rwa_assets FOR UPDATE TO authenticated
  USING ((created_by = auth.uid() AND status IN ('draft','rejected')) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'approver'))
  WITH CHECK ((created_by = auth.uid() AND status IN ('draft','pending','rejected')) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'approver'));
CREATE POLICY "assets admin delete" ON public.rwa_assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.rwa_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.rwa_assets(id) ON DELETE CASCADE,
  action public.approval_status NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.rwa_approvals (asset_id);
GRANT SELECT, INSERT ON public.rwa_approvals TO authenticated;
GRANT ALL ON public.rwa_approvals TO service_role;
ALTER TABLE public.rwa_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals readable" ON public.rwa_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "approvals insert" ON public.rwa_approvals FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE TABLE public.rwa_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.rwa_assets(id) ON DELETE CASCADE,
  category public.rwa_category NOT NULL,
  exposure_amount NUMERIC(18,2) NOT NULL,
  risk_weight NUMERIC(6,4) NOT NULL,
  rwa_amount NUMERIC(18,2) NOT NULL,
  calculated_by UUID REFERENCES auth.users(id),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB
);
CREATE INDEX ON public.rwa_calculations (asset_id);
CREATE INDEX ON public.rwa_calculations (calculated_at DESC);
GRANT SELECT, INSERT ON public.rwa_calculations TO authenticated;
GRANT ALL ON public.rwa_calculations TO service_role;
ALTER TABLE public.rwa_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calc history readable" ON public.rwa_calculations FOR SELECT TO authenticated USING (true);
CREATE POLICY "calc history insert" ON public.rwa_calculations FOR INSERT TO authenticated
  WITH CHECK (calculated_by IS NULL OR calculated_by = auth.uid());

CREATE OR REPLACE FUNCTION public.rwa_auto_calc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.rwa_amount := ROUND(NEW.exposure_amount * NEW.risk_weight, 2);
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_rwa_auto_calc BEFORE INSERT OR UPDATE ON public.rwa_assets FOR EACH ROW EXECUTE FUNCTION public.rwa_auto_calc();

CREATE OR REPLACE FUNCTION public.rwa_history_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.rwa_calculations (asset_id, category, exposure_amount, risk_weight, rwa_amount, calculated_by, snapshot)
  VALUES (NEW.id, NEW.category, NEW.exposure_amount, NEW.risk_weight, NEW.rwa_amount, auth.uid(), to_jsonb(NEW));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_rwa_history AFTER INSERT OR UPDATE ON public.rwa_assets FOR EACH ROW EXECUTE FUNCTION public.rwa_history_snapshot();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rwa_auto_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rwa_history_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

INSERT INTO public.risk_weight_rules (category, asset_class, counterparty_type, rating, risk_weight, description) VALUES
  ('credit', 'Sovereign', 'Government', 'AAA to AA-', 0.00, 'Sovereign AAA-AA-'),
  ('credit', 'Sovereign', 'Government', 'A+ to A-', 0.20, 'Sovereign A'),
  ('credit', 'Sovereign', 'Government', 'BBB+ to BBB-', 0.50, 'Sovereign BBB'),
  ('credit', 'Bank', 'Financial Institution', 'AAA to AA-', 0.20, 'Bank AAA-AA-'),
  ('credit', 'Bank', 'Financial Institution', 'A+ to BBB-', 0.50, 'Bank A/BBB'),
  ('credit', 'Corporate', 'Corporate', 'AAA to AA-', 0.20, 'Corporate AAA-AA-'),
  ('credit', 'Corporate', 'Corporate', 'A+ to A-', 0.50, 'Corporate A'),
  ('credit', 'Corporate', 'Corporate', 'BBB+ to BB-', 1.00, 'Corporate BBB-BB'),
  ('credit', 'Corporate', 'Corporate', 'Below BB-', 1.50, 'Corporate speculative'),
  ('credit', 'Retail', 'Individual', NULL, 0.75, 'Retail exposures'),
  ('credit', 'Residential Mortgage', 'Individual', NULL, 0.35, 'Residential mortgage'),
  ('market', 'Equity', NULL, NULL, 0.32, 'Equity general market risk'),
  ('market', 'Interest Rate', NULL, NULL, 0.08, 'Interest rate risk'),
  ('market', 'FX', NULL, NULL, 0.08, 'Foreign exchange'),
  ('market', 'Commodity', NULL, NULL, 0.15, 'Commodity risk'),
  ('operational', 'Basic Indicator', NULL, NULL, 0.15, 'Basic indicator approach'),
  ('operational', 'Standardised', 'Retail Banking', NULL, 0.12, 'Standardised - retail banking'),
  ('operational', 'Standardised', 'Corporate Finance', NULL, 0.18, 'Standardised - corporate finance'),
  ('operational', 'Standardised', 'Trading & Sales', NULL, 0.18, 'Standardised - trading & sales');

-- CREDIT RISK MODULE
CREATE TYPE public.borrower_type AS ENUM ('individual','sme','corporate','sovereign','bank');
CREATE TYPE public.loan_status AS ENUM ('active','closed','default','written_off','restructured');
CREATE TYPE public.collateral_type AS ENUM ('real_estate','cash','securities','equipment','inventory','guarantee','other');
CREATE TYPE public.watch_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.warning_status AS ENUM ('open','acknowledged','resolved','false_positive');

CREATE TABLE public.credit_borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  borrower_type public.borrower_type NOT NULL DEFAULT 'corporate',
  industry TEXT, country TEXT, credit_rating TEXT,
  pd NUMERIC(6,5) NOT NULL DEFAULT 0.02 CHECK (pd >= 0 AND pd <= 1),
  annual_revenue NUMERIC(18,2), notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.credit_borrowers (borrower_type);
CREATE INDEX ON public.credit_borrowers (credit_rating);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_borrowers TO authenticated;
GRANT ALL ON public.credit_borrowers TO service_role;
ALTER TABLE public.credit_borrowers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "borrowers read" ON public.credit_borrowers FOR SELECT TO authenticated USING (true);
CREATE POLICY "borrowers write" ON public.credit_borrowers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "borrowers update" ON public.credit_borrowers FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'));
CREATE POLICY "borrowers delete" ON public.credit_borrowers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.credit_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number TEXT NOT NULL UNIQUE,
  borrower_id UUID NOT NULL REFERENCES public.credit_borrowers(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL DEFAULT 'Term Loan',
  currency TEXT NOT NULL DEFAULT 'USD',
  principal NUMERIC(18,2) NOT NULL DEFAULT 0,
  outstanding NUMERIC(18,2) NOT NULL DEFAULT 0,
  undrawn NUMERIC(18,2) NOT NULL DEFAULT 0,
  ccf NUMERIC(6,4) NOT NULL DEFAULT 0.75 CHECK (ccf >= 0 AND ccf <= 1),
  interest_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  disbursement_date DATE, maturity_date DATE,
  pd_override NUMERIC(6,5) CHECK (pd_override IS NULL OR (pd_override >= 0 AND pd_override <= 1)),
  lgd NUMERIC(6,5) NOT NULL DEFAULT 0.45 CHECK (lgd >= 0 AND lgd <= 1),
  ead NUMERIC(18,2) NOT NULL DEFAULT 0,
  expected_loss NUMERIC(18,2) NOT NULL DEFAULT 0,
  days_past_due INT NOT NULL DEFAULT 0,
  status public.loan_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.credit_loans (borrower_id);
CREATE INDEX ON public.credit_loans (status);
CREATE INDEX ON public.credit_loans (days_past_due);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_loans TO authenticated;
GRANT ALL ON public.credit_loans TO service_role;
ALTER TABLE public.credit_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans read" ON public.credit_loans FOR SELECT TO authenticated USING (true);
CREATE POLICY "loans write" ON public.credit_loans FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "loans update" ON public.credit_loans FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'));
CREATE POLICY "loans delete" ON public.credit_loans FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.credit_collateral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.credit_loans(id) ON DELETE CASCADE,
  collateral_type public.collateral_type NOT NULL DEFAULT 'other',
  description TEXT,
  market_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  haircut NUMERIC(6,4) NOT NULL DEFAULT 0.20 CHECK (haircut >= 0 AND haircut <= 1),
  eligible_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  valuation_date DATE DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.credit_collateral (loan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_collateral TO authenticated;
GRANT ALL ON public.credit_collateral TO service_role;
ALTER TABLE public.credit_collateral ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collateral read" ON public.credit_collateral FOR SELECT TO authenticated USING (true);
CREATE POLICY "collateral write" ON public.credit_collateral FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "collateral update" ON public.credit_collateral FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'));
CREATE POLICY "collateral delete" ON public.credit_collateral FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.credit_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.credit_borrowers(id) ON DELETE CASCADE,
  rating TEXT NOT NULL, agency TEXT NOT NULL DEFAULT 'Internal',
  outlook TEXT, pd NUMERIC(6,5),
  rated_at DATE NOT NULL DEFAULT CURRENT_DATE,
  rated_by UUID REFERENCES auth.users(id),
  comment TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.credit_ratings (borrower_id, rated_at DESC);
GRANT SELECT, INSERT ON public.credit_ratings TO authenticated;
GRANT ALL ON public.credit_ratings TO service_role;
ALTER TABLE public.credit_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings read" ON public.credit_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ratings insert" ON public.credit_ratings FOR INSERT TO authenticated
  WITH CHECK (rated_by IS NULL OR rated_by = auth.uid());

CREATE TABLE public.credit_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID REFERENCES public.credit_borrowers(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.credit_loans(id) ON DELETE CASCADE,
  severity public.watch_severity NOT NULL DEFAULT 'medium',
  reason TEXT NOT NULL,
  added_by UUID NOT NULL REFERENCES auth.users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ, resolution TEXT
);
CREATE INDEX ON public.credit_watchlist (severity);
CREATE INDEX ON public.credit_watchlist (resolved_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_watchlist TO authenticated;
GRANT ALL ON public.credit_watchlist TO service_role;
ALTER TABLE public.credit_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watch read" ON public.credit_watchlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "watch write" ON public.credit_watchlist FOR INSERT TO authenticated WITH CHECK (added_by = auth.uid());
CREATE POLICY "watch update" ON public.credit_watchlist FOR UPDATE TO authenticated
  USING (added_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'))
  WITH CHECK (added_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'));
CREATE POLICY "watch delete" ON public.credit_watchlist FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.credit_early_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID REFERENCES public.credit_borrowers(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.credit_loans(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_value NUMERIC(18,4), threshold NUMERIC(18,4),
  severity public.watch_severity NOT NULL DEFAULT 'medium',
  status public.warning_status NOT NULL DEFAULT 'open',
  message TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ
);
CREATE INDEX ON public.credit_early_warnings (status);
CREATE INDEX ON public.credit_early_warnings (severity);
CREATE INDEX ON public.credit_early_warnings (triggered_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_early_warnings TO authenticated;
GRANT ALL ON public.credit_early_warnings TO service_role;
ALTER TABLE public.credit_early_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ews read" ON public.credit_early_warnings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ews write" ON public.credit_early_warnings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ews update" ON public.credit_early_warnings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ews delete" ON public.credit_early_warnings FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.credit_loan_calc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_pd NUMERIC(6,5); v_collateral NUMERIC(18,2);
BEGIN
  SELECT COALESCE(SUM(eligible_value),0) INTO v_collateral FROM public.credit_collateral WHERE loan_id = NEW.id;
  NEW.ead := GREATEST(NEW.outstanding + NEW.undrawn * NEW.ccf - v_collateral, 0);
  IF NEW.pd_override IS NOT NULL THEN v_pd := NEW.pd_override;
  ELSE
    SELECT pd INTO v_pd FROM public.credit_borrowers WHERE id = NEW.borrower_id;
    v_pd := COALESCE(v_pd, 0.02);
  END IF;
  IF NEW.days_past_due > 90 AND NEW.status = 'active' THEN NEW.status := 'default'; v_pd := 1; END IF;
  NEW.expected_loss := ROUND(v_pd * NEW.lgd * NEW.ead, 2);
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_credit_loan_calc BEFORE INSERT OR UPDATE ON public.credit_loans
  FOR EACH ROW EXECUTE FUNCTION public.credit_loan_calc();

CREATE OR REPLACE FUNCTION public.credit_collateral_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.eligible_value := ROUND(NEW.market_value * (1 - NEW.haircut), 2);
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_credit_collateral_before BEFORE INSERT OR UPDATE ON public.credit_collateral
  FOR EACH ROW EXECUTE FUNCTION public.credit_collateral_touch();

CREATE OR REPLACE FUNCTION public.credit_collateral_recalc_loan()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_loan UUID;
BEGIN
  v_loan := COALESCE(NEW.loan_id, OLD.loan_id);
  UPDATE public.credit_loans SET updated_at = now() WHERE id = v_loan;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_credit_collateral_after AFTER INSERT OR UPDATE OR DELETE ON public.credit_collateral
  FOR EACH ROW EXECUTE FUNCTION public.credit_collateral_recalc_loan();

CREATE OR REPLACE FUNCTION public.credit_loan_ews()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.days_past_due >= 30 AND (OLD IS NULL OR OLD.days_past_due < 30) THEN
    INSERT INTO public.credit_early_warnings (borrower_id, loan_id, signal_type, signal_value, threshold, severity, message)
    VALUES (NEW.borrower_id, NEW.id, 'DPD>=30', NEW.days_past_due, 30,
      CASE WHEN NEW.days_past_due >= 90 THEN 'critical'
           WHEN NEW.days_past_due >= 60 THEN 'high' ELSE 'medium' END,
      'Loan ' || NEW.loan_number || ' is ' || NEW.days_past_due || ' days past due');
  END IF;
  IF NEW.status = 'default' AND (OLD IS NULL OR OLD.status <> 'default') THEN
    INSERT INTO public.credit_early_warnings (borrower_id, loan_id, signal_type, severity, message)
    VALUES (NEW.borrower_id, NEW.id, 'DEFAULT', 'critical', 'Loan ' || NEW.loan_number || ' has defaulted');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_credit_loan_ews AFTER INSERT OR UPDATE ON public.credit_loans
  FOR EACH ROW EXECUTE FUNCTION public.credit_loan_ews();

REVOKE ALL ON FUNCTION public.credit_loan_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_collateral_touch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_collateral_recalc_loan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_loan_ews() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE VIEW public.credit_portfolio_summary WITH (security_invoker=true) AS
SELECT b.id AS borrower_id, b.code, b.name, b.borrower_type, b.industry, b.country, b.credit_rating, b.pd,
  COUNT(l.id) AS loan_count,
  COALESCE(SUM(l.outstanding),0) AS total_outstanding,
  COALESCE(SUM(l.ead),0) AS total_ead,
  COALESCE(SUM(l.expected_loss),0) AS total_el,
  COALESCE(MAX(l.days_past_due),0) AS max_dpd,
  BOOL_OR(l.status = 'default') AS has_default
FROM public.credit_borrowers b
LEFT JOIN public.credit_loans l ON l.borrower_id = b.id
GROUP BY b.id;
GRANT SELECT ON public.credit_portfolio_summary TO authenticated;

-- MARKET RISK MODULE
CREATE TYPE public.market_asset_class AS ENUM ('fx','ir','commodity','equity');
CREATE TYPE public.var_method AS ENUM ('parametric','historical','monte_carlo');

CREATE TABLE public.market_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  asset_class public.market_asset_class NOT NULL,
  portfolio TEXT NOT NULL DEFAULT 'trading',
  currency TEXT NOT NULL DEFAULT 'USD',
  quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
  price NUMERIC(18,6) NOT NULL DEFAULT 0,
  notional NUMERIC(18,2) NOT NULL DEFAULT 0,
  market_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  duration NUMERIC(10,4) NOT NULL DEFAULT 0,
  convexity NUMERIC(10,4) NOT NULL DEFAULT 0,
  coupon_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  maturity_date DATE,
  beta NUMERIC(8,4) NOT NULL DEFAULT 1,
  volatility NUMERIC(8,4) NOT NULL DEFAULT 0.10,
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
  IF NEW.market_value = 0 THEN NEW.market_value := ROUND(NEW.quantity * NEW.price, 2); END IF;
  IF NEW.notional = 0 THEN NEW.notional := NEW.market_value; END IF;
  IF NEW.asset_class = 'ir' THEN
    NEW.dv01 := ROUND(NEW.market_value * NEW.duration * 0.0001, 2);
    NEW.sensitivity := ROUND(NEW.market_value * NEW.duration * 0.01, 2);
    NEW.delta_1pct := NEW.sensitivity;
  ELSIF NEW.asset_class = 'fx' THEN
    NEW.delta_1pct := ROUND(NEW.market_value * 0.01, 2);
    NEW.sensitivity := NEW.delta_1pct; NEW.dv01 := 0;
  ELSIF NEW.asset_class = 'equity' THEN
    NEW.delta_1pct := ROUND(NEW.market_value * NEW.beta * 0.01, 2);
    NEW.sensitivity := NEW.delta_1pct; NEW.dv01 := 0;
  ELSIF NEW.asset_class = 'commodity' THEN
    NEW.delta_1pct := ROUND(NEW.market_value * 0.01, 2);
    NEW.sensitivity := NEW.delta_1pct; NEW.dv01 := 0;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER market_position_calc_trg BEFORE INSERT OR UPDATE ON public.market_positions
  FOR EACH ROW EXECUTE FUNCTION public.market_position_calc();

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
CREATE POLICY "var_del" ON public.market_var_runs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.market_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT,
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
CREATE POLICY "scen_del" ON public.market_scenarios FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE VIEW public.market_risk_summary WITH (security_invoker=true) AS
SELECT asset_class,
  COUNT(*)::int AS position_count,
  COALESCE(SUM(market_value),0) AS total_mv,
  COALESCE(SUM(notional),0) AS total_notional,
  COALESCE(SUM(dv01),0) AS total_dv01,
  COALESCE(SUM(sensitivity),0) AS total_sensitivity,
  COALESCE(AVG(volatility),0) AS avg_volatility
FROM public.market_positions
GROUP BY asset_class;
GRANT SELECT ON public.market_risk_summary TO authenticated;