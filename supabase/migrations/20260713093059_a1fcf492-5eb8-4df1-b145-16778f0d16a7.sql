
CREATE TYPE public.report_cadence AS ENUM ('once','daily','weekly','monthly','quarterly');
CREATE TYPE public.report_format AS ENUM ('pdf','excel','csv','word');
CREATE TYPE public.report_run_status AS ENUM ('pending','success','failed');

CREATE TABLE public.report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key TEXT NOT NULL,
  report_name TEXT NOT NULL,
  audience TEXT NOT NULL,
  cadence public.report_cadence NOT NULL DEFAULT 'monthly',
  formats public.report_format[] NOT NULL DEFAULT ARRAY['pdf']::public.report_format[],
  recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_schedules TO authenticated;
GRANT ALL ON public.report_schedules TO service_role;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs_read" ON public.report_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rs_insert" ON public.report_schedules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "rs_update" ON public.report_schedules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "rs_delete" ON public.report_schedules FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.report_schedule_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER report_schedule_touch BEFORE UPDATE ON public.report_schedules
FOR EACH ROW EXECUTE FUNCTION public.report_schedule_touch();

CREATE TABLE public.report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.report_schedules(id) ON DELETE SET NULL,
  report_key TEXT NOT NULL,
  report_name TEXT NOT NULL,
  audience TEXT NOT NULL,
  format public.report_format NOT NULL,
  status public.report_run_status NOT NULL DEFAULT 'success',
  file_name TEXT,
  recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  distributed BOOLEAN NOT NULL DEFAULT false,
  distribution_note TEXT,
  error TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_by UUID REFERENCES auth.users(id),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_runs TO authenticated;
GRANT ALL ON public.report_runs TO service_role;
ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr_read" ON public.report_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "rr_insert" ON public.report_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "rr_delete" ON public.report_runs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
