-- BASE RWA SCHEMA
CREATE TYPE public.app_role AS ENUM ('admin', 'approver', 'analyst', 'viewer');
CREATE TYPE public.rwa_category AS ENUM ('credit', 'market', 'operational');
CREATE TYPE public.approval_status AS ENUM ('draft', 'pending', 'approved', 'rejected');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
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
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.risk_weight_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.rwa_category NOT NULL,
  asset_class TEXT NOT NULL,
  counterparty_type TEXT,
  rating TEXT,
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
  reference_code TEXT NOT NULL,
  name TEXT NOT NULL,
  category public.rwa_category NOT NULL,
  asset_class TEXT NOT NULL,
  counterparty_type TEXT,
  rating TEXT,
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