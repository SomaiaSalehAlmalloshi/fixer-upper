ALTER VIEW public.credit_portfolio_summary SET (security_invoker = true);

-- Tighten WITH CHECK to mirror USING
DROP POLICY IF EXISTS "borrowers update" ON public.credit_borrowers;
CREATE POLICY "borrowers update" ON public.credit_borrowers FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'));

DROP POLICY IF EXISTS "loans update" ON public.credit_loans;
CREATE POLICY "loans update" ON public.credit_loans FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'));

DROP POLICY IF EXISTS "collateral update" ON public.credit_collateral;
CREATE POLICY "collateral update" ON public.credit_collateral FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'));

DROP POLICY IF EXISTS "watch update" ON public.credit_watchlist;
CREATE POLICY "watch update" ON public.credit_watchlist FOR UPDATE TO authenticated
  USING (added_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'))
  WITH CHECK (added_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver'));

DROP POLICY IF EXISTS "ews write" ON public.credit_early_warnings;
DROP POLICY IF EXISTS "ews update" ON public.credit_early_warnings;
CREATE POLICY "ews write" ON public.credit_early_warnings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ews update" ON public.credit_early_warnings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));