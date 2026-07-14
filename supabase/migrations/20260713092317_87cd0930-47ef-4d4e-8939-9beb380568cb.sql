
CREATE TYPE public.compliance_framework AS ENUM ('basel_iii','basel_iv','local','other');
CREATE TYPE public.compliance_metric AS ENUM ('lcr','nsfr','cet1_ratio','tier1_ratio','total_capital_ratio','leverage_ratio','npl_ratio','concentration','kri_breach','custom');
CREATE TYPE public.compliance_operator AS ENUM ('gte','lte','gt','lt','eq');
CREATE TYPE public.compliance_status AS ENUM ('pass','warn','fail');
CREATE TYPE public.compliance_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.compliance_task_status AS ENUM ('open','in_progress','pending_approval','approved','rejected','closed');

CREATE TABLE public.compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  framework public.compliance_framework NOT NULL DEFAULT 'basel_iii',
  category TEXT NOT NULL DEFAULT 'liquidity',
  name TEXT NOT NULL,
  description TEXT,
  metric public.compliance_metric NOT NULL,
  operator public.compliance_operator NOT NULL DEFAULT 'gte',
  threshold_warn NUMERIC(18,6),
  threshold_fail NUMERIC(18,6) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'ratio',
  severity public.compliance_severity NOT NULL DEFAULT 'high',
  recommendation TEXT,
  reference TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_rules TO authenticated;
GRANT ALL ON public.compliance_rules TO service_role;
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr_read" ON public.compliance_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "cr_insert" ON public.compliance_rules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "cr_update" ON public.compliance_rules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "cr_delete" ON public.compliance_rules FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.compliance_rules(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  framework public.compliance_framework NOT NULL,
  metric public.compliance_metric NOT NULL,
  metric_value NUMERIC(18,6),
  threshold_warn NUMERIC(18,6),
  threshold_fail NUMERIC(18,6) NOT NULL,
  operator public.compliance_operator NOT NULL,
  status public.compliance_status NOT NULL,
  severity public.compliance_severity NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_by UUID REFERENCES auth.users(id),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_checks TO authenticated;
GRANT ALL ON public.compliance_checks TO service_role;
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_read" ON public.compliance_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "cc_insert" ON public.compliance_checks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "cc_delete" ON public.compliance_checks FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.compliance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.compliance_rules(id) ON DELETE SET NULL,
  check_id UUID REFERENCES public.compliance_checks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  recommendation TEXT,
  framework public.compliance_framework NOT NULL DEFAULT 'basel_iii',
  severity public.compliance_severity NOT NULL DEFAULT 'medium',
  priority INT NOT NULL DEFAULT 3,
  status public.compliance_task_status NOT NULL DEFAULT 'open',
  assignee UUID REFERENCES auth.users(id),
  due_date DATE,
  resolution TEXT,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_tasks TO authenticated;
GRANT ALL ON public.compliance_tasks TO service_role;
ALTER TABLE public.compliance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_read" ON public.compliance_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "ct_insert" ON public.compliance_tasks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "ct_update" ON public.compliance_tasks FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver'));
CREATE POLICY "ct_delete" ON public.compliance_tasks FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.compliance_task_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER compliance_task_touch BEFORE UPDATE ON public.compliance_tasks
FOR EACH ROW EXECUTE FUNCTION public.compliance_task_touch();

CREATE TABLE public.compliance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.compliance_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_evidence TO authenticated;
GRANT ALL ON public.compliance_evidence TO service_role;
ALTER TABLE public.compliance_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_read" ON public.compliance_evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "ce_insert" ON public.compliance_evidence FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "ce_update" ON public.compliance_evidence FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "ce_delete" ON public.compliance_evidence FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.compliance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  actor UUID REFERENCES auth.users(id),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.compliance_audit_log TO authenticated;
GRANT ALL ON public.compliance_audit_log TO service_role;
ALTER TABLE public.compliance_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cal_read" ON public.compliance_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "cal_insert" ON public.compliance_audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO public.compliance_rules (code, framework, category, name, description, metric, operator, threshold_warn, threshold_fail, unit, severity, recommendation, reference, is_preset) VALUES
('B3-LCR', 'basel_iii', 'liquidity', 'Liquidity Coverage Ratio ≥ 100%', 'Stock of HQLA must cover 30-day net cash outflows under stress.', 'lcr', 'gte', 1.10, 1.00, 'ratio', 'critical', 'Increase Level 1 HQLA holdings or reduce short-term wholesale funding reliance.', 'Basel III LCR (BCBS 238)', true),
('B3-NSFR', 'basel_iii', 'liquidity', 'Net Stable Funding Ratio ≥ 100%', 'Available stable funding must cover required stable funding over 1 year.', 'nsfr', 'gte', 1.05, 1.00, 'ratio', 'critical', 'Lengthen funding tenors and grow retail deposits to raise ASF.', 'Basel III NSFR (BCBS 295)', true),
('B3-CET1', 'basel_iii', 'capital', 'CET1 Ratio ≥ 4.5%', 'Common Equity Tier 1 capital ratio floor.', 'cet1_ratio', 'gte', 0.07, 0.045, 'ratio', 'critical', 'Retain earnings, issue common equity, or reduce RWA-heavy exposures.', 'Basel III Pillar 1', true),
('B3-T1', 'basel_iii', 'capital', 'Tier 1 Ratio ≥ 6%', 'Tier 1 capital adequacy floor.', 'tier1_ratio', 'gte', 0.085, 0.06, 'ratio', 'high', 'Raise Additional Tier 1 instruments or reduce RWA.', 'Basel III Pillar 1', true),
('B3-TCR', 'basel_iii', 'capital', 'Total Capital Ratio ≥ 8%', 'Total regulatory capital adequacy floor.', 'total_capital_ratio', 'gte', 0.105, 0.08, 'ratio', 'critical', 'Issue Tier 2 subordinated debt or reduce risk-weighted assets.', 'Basel III Pillar 1', true),
('B3-LR', 'basel_iii', 'capital', 'Leverage Ratio ≥ 3%', 'Non-risk-based Tier 1 to total exposure floor.', 'leverage_ratio', 'gte', 0.04, 0.03, 'ratio', 'high', 'Reduce on- and off-balance-sheet exposures or grow Tier 1 capital.', 'Basel III Leverage', true),
('B3-NPL', 'basel_iii', 'credit', 'NPL Ratio ≤ 5%', 'Share of non-performing loans in gross portfolio.', 'npl_ratio', 'lte', 0.03, 0.05, 'ratio', 'high', 'Strengthen underwriting, accelerate workouts, and expand provisioning.', 'EBA/BIS guidance', true),
('B3-CONC', 'basel_iii', 'credit', 'Single-name concentration ≤ 25%', 'Largest single counterparty exposure vs. eligible capital.', 'concentration', 'lte', 0.20, 0.25, 'ratio', 'high', 'Enforce large-exposure limits, syndicate or hedge outsized names.', 'Basel Large Exposures (BCBS 283)', true);
