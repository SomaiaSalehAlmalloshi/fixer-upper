
DROP POLICY IF EXISTS "calc history insert" ON public.rwa_calculations;
CREATE POLICY "calc history insert" ON public.rwa_calculations FOR INSERT TO authenticated
  WITH CHECK (calculated_by IS NULL OR calculated_by = auth.uid());
