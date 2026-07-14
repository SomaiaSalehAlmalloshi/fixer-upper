-- OPERATIONAL RISK MODULE
CREATE TYPE public.op_category AS ENUM ('incident','loss','fraud','cyber','bcp');
CREATE TYPE public.op_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.op_status AS ENUM ('open','investigating','contained','resolved','closed');
CREATE TYPE public.kri_status AS ENUM ('green','amber','red');
CREATE TYPE public.risk_status AS ENUM ('open','mitigated','accepted','transferred','closed');

-- Incidents (covers Incident Register, Loss Events, Fraud, Cyber, BCP)
CREATE TABLE public.op_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category public.op_category NOT NULL DEFAULT 'incident',
  severity public.op_severity NOT NULL DEFAULT 'medium',
  status public.op_status NOT NULL DEFAULT 'open',
  business_line TEXT,
  event_type TEXT,
  root_cause TEXT,
  description TEXT,
  gross_loss NUMERIC(18,2) NOT NULL DEFAULT 0,
  recovery NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_loss NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.op_incidents (category);
CREATE INDEX ON public.op_incidents (severity);
CREATE INDEX ON public.op_incidents (status);
CREATE INDEX ON public.op_incidents (occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_incidents TO authenticated;
GRANT ALL ON public.op_incidents TO service_role;
ALTER TABLE public.op_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_inc read" ON public.op_incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "op_inc write" ON public.op_incidents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "op_inc update" ON public.op_incidents FOR UPDATE TO authenticated
  USING (reported_by = auth.uid() OR public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (reported_by = auth.uid() OR public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "op_inc delete" ON public.op_incidents FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.op_incident_calc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.net_loss := GREATEST(NEW.gross_loss - NEW.recovery, 0);
  NEW.updated_at := now();
  IF NEW.status IN ('resolved','closed') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_op_incident_calc BEFORE INSERT OR UPDATE ON public.op_incidents
  FOR EACH ROW EXECUTE FUNCTION public.op_incident_calc();
REVOKE ALL ON FUNCTION public.op_incident_calc() FROM PUBLIC, anon, authenticated;

-- Key Risk Indicators
CREATE TABLE public.op_kris (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'operational',
  unit TEXT NOT NULL DEFAULT 'count',
  frequency TEXT NOT NULL DEFAULT 'monthly',
  owner TEXT,
  current_value NUMERIC(18,4) NOT NULL DEFAULT 0,
  threshold_amber NUMERIC(18,4) NOT NULL DEFAULT 0,
  threshold_red NUMERIC(18,4) NOT NULL DEFAULT 0,
  higher_is_worse BOOLEAN NOT NULL DEFAULT true,
  status public.kri_status NOT NULL DEFAULT 'green',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.op_kris (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_kris TO authenticated;
GRANT ALL ON public.op_kris TO service_role;
ALTER TABLE public.op_kris ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_kri read" ON public.op_kris FOR SELECT TO authenticated USING (true);
CREATE POLICY "op_kri write" ON public.op_kris FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "op_kri update" ON public.op_kris FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "op_kri delete" ON public.op_kris FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.op_kri_calc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.higher_is_worse THEN
    IF NEW.current_value >= NEW.threshold_red THEN NEW.status := 'red';
    ELSIF NEW.current_value >= NEW.threshold_amber THEN NEW.status := 'amber';
    ELSE NEW.status := 'green'; END IF;
  ELSE
    IF NEW.current_value <= NEW.threshold_red THEN NEW.status := 'red';
    ELSIF NEW.current_value <= NEW.threshold_amber THEN NEW.status := 'amber';
    ELSE NEW.status := 'green'; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_op_kri_calc BEFORE INSERT OR UPDATE ON public.op_kris
  FOR EACH ROW EXECUTE FUNCTION public.op_kri_calc();
REVOKE ALL ON FUNCTION public.op_kri_calc() FROM PUBLIC, anon, authenticated;

-- Risk & Control Self-Assessment
CREATE TABLE public.op_rcsa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_name TEXT NOT NULL,
  risk_description TEXT NOT NULL,
  inherent_likelihood INT NOT NULL DEFAULT 3 CHECK (inherent_likelihood BETWEEN 1 AND 5),
  inherent_impact INT NOT NULL DEFAULT 3 CHECK (inherent_impact BETWEEN 1 AND 5),
  control_description TEXT,
  control_effectiveness INT NOT NULL DEFAULT 3 CHECK (control_effectiveness BETWEEN 1 AND 5),
  residual_likelihood INT NOT NULL DEFAULT 3 CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact INT NOT NULL DEFAULT 3 CHECK (residual_impact BETWEEN 1 AND 5),
  inherent_score INT NOT NULL DEFAULT 9,
  residual_score INT NOT NULL DEFAULT 9,
  owner TEXT,
  last_reviewed DATE DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_rcsa TO authenticated;
GRANT ALL ON public.op_rcsa TO service_role;
ALTER TABLE public.op_rcsa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_rcsa read" ON public.op_rcsa FOR SELECT TO authenticated USING (true);
CREATE POLICY "op_rcsa write" ON public.op_rcsa FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "op_rcsa update" ON public.op_rcsa FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "op_rcsa delete" ON public.op_rcsa FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.op_rcsa_calc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.inherent_score := NEW.inherent_likelihood * NEW.inherent_impact;
  NEW.residual_score := NEW.residual_likelihood * NEW.residual_impact;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_op_rcsa_calc BEFORE INSERT OR UPDATE ON public.op_rcsa
  FOR EACH ROW EXECUTE FUNCTION public.op_rcsa_calc();
REVOKE ALL ON FUNCTION public.op_rcsa_calc() FROM PUBLIC, anon, authenticated;

-- Enterprise Risk Register
CREATE TABLE public.op_risk_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Operational',
  likelihood INT NOT NULL DEFAULT 3 CHECK (likelihood BETWEEN 1 AND 5),
  impact INT NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  inherent_score INT NOT NULL DEFAULT 9,
  mitigation TEXT,
  residual_likelihood INT NOT NULL DEFAULT 2 CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact INT NOT NULL DEFAULT 2 CHECK (residual_impact BETWEEN 1 AND 5),
  residual_score INT NOT NULL DEFAULT 4,
  status public.risk_status NOT NULL DEFAULT 'open',
  owner TEXT,
  review_date DATE DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.op_risk_register (status);
CREATE INDEX ON public.op_risk_register (category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_risk_register TO authenticated;
GRANT ALL ON public.op_risk_register TO service_role;
ALTER TABLE public.op_risk_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_reg read" ON public.op_risk_register FOR SELECT TO authenticated USING (true);
CREATE POLICY "op_reg write" ON public.op_risk_register FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "op_reg update" ON public.op_risk_register FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "op_reg delete" ON public.op_risk_register FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.op_risk_calc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.inherent_score := NEW.likelihood * NEW.impact;
  NEW.residual_score := NEW.residual_likelihood * NEW.residual_impact;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_op_risk_calc BEFORE INSERT OR UPDATE ON public.op_risk_register
  FOR EACH ROW EXECUTE FUNCTION public.op_risk_calc();
REVOKE ALL ON FUNCTION public.op_risk_calc() FROM PUBLIC, anon, authenticated;

-- Summary view: net loss by category
CREATE VIEW public.op_loss_summary WITH (security_invoker=true) AS
SELECT category,
  COUNT(*)::int AS incident_count,
  COALESCE(SUM(gross_loss),0) AS total_gross,
  COALESCE(SUM(recovery),0) AS total_recovery,
  COALESCE(SUM(net_loss),0) AS total_net,
  COUNT(*) FILTER (WHERE status IN ('open','investigating','contained'))::int AS open_count
FROM public.op_incidents
GROUP BY category;
GRANT SELECT ON public.op_loss_summary TO authenticated;