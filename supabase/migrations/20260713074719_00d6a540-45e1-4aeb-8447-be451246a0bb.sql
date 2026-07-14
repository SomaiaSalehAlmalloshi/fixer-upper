-- CREDIT RISK MODULE

CREATE TYPE public.borrower_type AS ENUM ('individual','sme','corporate','sovereign','bank');
CREATE TYPE public.loan_status AS ENUM ('active','closed','default','written_off','restructured');
CREATE TYPE public.collateral_type AS ENUM ('real_estate','cash','securities','equipment','inventory','guarantee','other');
CREATE TYPE public.watch_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.warning_status AS ENUM ('open','acknowledged','resolved','false_positive');

-- BORROWERS
CREATE TABLE public.credit_borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  borrower_type public.borrower_type NOT NULL DEFAULT 'corporate',
  industry TEXT,
  country TEXT,
  credit_rating TEXT,
  pd NUMERIC(6,5) NOT NULL DEFAULT 0.02 CHECK (pd >= 0 AND pd <= 1),
  annual_revenue NUMERIC(18,2),
  notes TEXT,
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
  WITH CHECK (true);
CREATE POLICY "borrowers delete" ON public.credit_borrowers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- LOANS
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
  disbursement_date DATE,
  maturity_date DATE,
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
  WITH CHECK (true);
CREATE POLICY "loans delete" ON public.credit_loans FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- COLLATERAL
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
  WITH CHECK (true);
CREATE POLICY "collateral delete" ON public.credit_collateral FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- CREDIT RATING HISTORY
CREATE TABLE public.credit_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.credit_borrowers(id) ON DELETE CASCADE,
  rating TEXT NOT NULL,
  agency TEXT NOT NULL DEFAULT 'Internal',
  outlook TEXT,
  pd NUMERIC(6,5),
  rated_at DATE NOT NULL DEFAULT CURRENT_DATE,
  rated_by UUID REFERENCES auth.users(id),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.credit_ratings (borrower_id, rated_at DESC);
GRANT SELECT, INSERT ON public.credit_ratings TO authenticated;
GRANT ALL ON public.credit_ratings TO service_role;
ALTER TABLE public.credit_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings read" ON public.credit_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ratings insert" ON public.credit_ratings FOR INSERT TO authenticated
  WITH CHECK (rated_by IS NULL OR rated_by = auth.uid());

-- WATCH LIST
CREATE TABLE public.credit_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID REFERENCES public.credit_borrowers(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.credit_loans(id) ON DELETE CASCADE,
  severity public.watch_severity NOT NULL DEFAULT 'medium',
  reason TEXT NOT NULL,
  added_by UUID NOT NULL REFERENCES auth.users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT
);
CREATE INDEX ON public.credit_watchlist (severity);
CREATE INDEX ON public.credit_watchlist (resolved_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_watchlist TO authenticated;
GRANT ALL ON public.credit_watchlist TO service_role;
ALTER TABLE public.credit_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watch read" ON public.credit_watchlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "watch write" ON public.credit_watchlist FOR INSERT TO authenticated
  WITH CHECK (added_by = auth.uid());
CREATE POLICY "watch update" ON public.credit_watchlist FOR UPDATE TO authenticated
  USING (added_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'))
  WITH CHECK (true);
CREATE POLICY "watch delete" ON public.credit_watchlist FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- EARLY WARNING SIGNALS
CREATE TABLE public.credit_early_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID REFERENCES public.credit_borrowers(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.credit_loans(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- e.g. 'DPD>30', 'RATING_DOWNGRADE', 'REVENUE_DROP', 'COVENANT_BREACH'
  signal_value NUMERIC(18,4),
  threshold NUMERIC(18,4),
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
CREATE POLICY "ews write" ON public.credit_early_warnings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ews update" ON public.credit_early_warnings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ews delete" ON public.credit_early_warnings FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- EL AUTO-CALC + EARLY WARNING TRIGGER
CREATE OR REPLACE FUNCTION public.credit_loan_calc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_pd NUMERIC(6,5);
  v_collateral NUMERIC(18,2);
BEGIN
  -- EAD = outstanding + undrawn * CCF - eligible collateral (floored at 0)
  SELECT COALESCE(SUM(eligible_value),0) INTO v_collateral FROM public.credit_collateral WHERE loan_id = NEW.id;
  NEW.ead := GREATEST(NEW.outstanding + NEW.undrawn * NEW.ccf - v_collateral, 0);

  -- PD: override or borrower default
  IF NEW.pd_override IS NOT NULL THEN
    v_pd := NEW.pd_override;
  ELSE
    SELECT pd INTO v_pd FROM public.credit_borrowers WHERE id = NEW.borrower_id;
    v_pd := COALESCE(v_pd, 0.02);
  END IF;

  -- Default if DPD > 90
  IF NEW.days_past_due > 90 AND NEW.status = 'active' THEN
    NEW.status := 'default';
    v_pd := 1;
  END IF;

  NEW.expected_loss := ROUND(v_pd * NEW.lgd * NEW.ead, 2);
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_credit_loan_calc BEFORE INSERT OR UPDATE ON public.credit_loans
  FOR EACH ROW EXECUTE FUNCTION public.credit_loan_calc();

-- Recompute EAD when collateral changes
CREATE OR REPLACE FUNCTION public.credit_collateral_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_loan UUID;
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

-- Fire early warning on loan changes
CREATE OR REPLACE FUNCTION public.credit_loan_ews()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.days_past_due >= 30 AND (OLD IS NULL OR OLD.days_past_due < 30) THEN
    INSERT INTO public.credit_early_warnings (borrower_id, loan_id, signal_type, signal_value, threshold, severity, message)
    VALUES (NEW.borrower_id, NEW.id, 'DPD>=30', NEW.days_past_due, 30,
      CASE WHEN NEW.days_past_due >= 90 THEN 'critical'
           WHEN NEW.days_past_due >= 60 THEN 'high'
           ELSE 'medium' END,
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

-- PORTFOLIO SUMMARY VIEW
CREATE OR REPLACE VIEW public.credit_portfolio_summary AS
SELECT
  b.id AS borrower_id,
  b.code,
  b.name,
  b.borrower_type,
  b.industry,
  b.country,
  b.credit_rating,
  b.pd,
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