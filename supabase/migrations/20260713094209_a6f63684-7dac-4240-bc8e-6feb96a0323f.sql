DROP POLICY IF EXISTS "insert notifications" ON public.notifications;
CREATE POLICY "insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "insert events" ON public.workflow_events;
CREATE POLICY "insert events" ON public.workflow_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'analyst') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin'));