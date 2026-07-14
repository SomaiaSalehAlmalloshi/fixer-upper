
CREATE TABLE public.import_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_key TEXT NOT NULL,
  package_label TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  sheets JSONB NOT NULL DEFAULT '[]'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_history TO authenticated;
GRANT ALL ON public.import_history TO service_role;

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_history read" ON public.import_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "import_history write" ON public.import_history
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'analyst'::app_role)
      OR public.has_role(auth.uid(), 'approver'::app_role)
    )
  );

CREATE POLICY "import_history delete" ON public.import_history
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX import_history_created_at_idx ON public.import_history (created_at DESC);
CREATE INDEX import_history_package_key_idx ON public.import_history (package_key);
