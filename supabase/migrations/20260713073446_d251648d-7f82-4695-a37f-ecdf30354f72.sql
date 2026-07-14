
-- Tighten assets update policy
DROP POLICY IF EXISTS "assets creator or admin update" ON public.rwa_assets;
CREATE POLICY "assets update by role" ON public.rwa_assets FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid() AND status IN ('draft','rejected'))
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'approver')
  )
  WITH CHECK (
    (created_by = auth.uid() AND status IN ('draft','pending','rejected'))
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'approver')
  );

-- Revoke public execute on internal helper functions (triggers still work)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rwa_auto_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rwa_history_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
