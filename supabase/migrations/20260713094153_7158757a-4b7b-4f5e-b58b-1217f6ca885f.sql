-- Enums
CREATE TYPE public.notification_channel AS ENUM ('email','sms','push','in_app');
CREATE TYPE public.notification_status AS ENUM ('pending','sent','failed','skipped','read');
CREATE TYPE public.notification_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.workflow_source_module AS ENUM ('compliance','credit','market','operational','liquidity','stress','rwa','reporting','system');
CREATE TYPE public.workflow_rule_trigger AS ENUM ('reminder_before_due','escalate_overdue','on_status_change','on_severity');
CREATE TYPE public.workflow_action AS ENUM ('notify_assignee','notify_role','reassign','change_priority','change_status');

-- notifications (outbox + in-app inbox)
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel public.notification_channel NOT NULL,
  status public.notification_status NOT NULL DEFAULT 'pending',
  priority public.notification_priority NOT NULL DEFAULT 'normal',
  subject TEXT NOT NULL,
  body TEXT,
  source_module public.workflow_source_module NOT NULL DEFAULT 'system',
  source_id UUID,
  action_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_status_idx ON public.notifications(status, channel);
CREATE INDEX notifications_source_idx ON public.notifications(source_module, source_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin delete notifications" ON public.notifications FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- notification_preferences
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel public.notification_channel NOT NULL,
  source_module public.workflow_source_module NOT NULL DEFAULT 'system',
  enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start SMALLINT,
  quiet_hours_end SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel, source_module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs" ON public.notification_preferences FOR ALL TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- workflow_rules
CREATE TABLE public.workflow_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source_module public.workflow_source_module NOT NULL,
  trigger public.workflow_rule_trigger NOT NULL,
  action public.workflow_action NOT NULL DEFAULT 'notify_assignee',
  channel public.notification_channel NOT NULL DEFAULT 'in_app',
  offset_days INTEGER NOT NULL DEFAULT 0,
  target_role TEXT,
  condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workflow_rules TO authenticated;
GRANT ALL ON public.workflow_rules TO service_role;
ALTER TABLE public.workflow_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rules" ON public.workflow_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write rules" ON public.workflow_rules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update rules" ON public.workflow_rules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete rules" ON public.workflow_rules FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- workflow_events (cross-module audit trail)
CREATE TABLE public.workflow_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_module public.workflow_source_module NOT NULL,
  source_id UUID,
  event_type TEXT NOT NULL,
  actor UUID REFERENCES auth.users(id),
  target_user UUID REFERENCES auth.users(id),
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workflow_events_source_idx ON public.workflow_events(source_module, source_id, created_at DESC);
GRANT SELECT, INSERT ON public.workflow_events TO authenticated;
GRANT ALL ON public.workflow_events TO service_role;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read events" ON public.workflow_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert events" ON public.workflow_events FOR INSERT TO authenticated WITH CHECK (true);

-- touch triggers
CREATE OR REPLACE FUNCTION public.wf_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_notifications_touch BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.wf_touch();
CREATE TRIGGER trg_notif_prefs_touch BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.wf_touch();
CREATE TRIGGER trg_workflow_rules_touch BEFORE UPDATE ON public.workflow_rules FOR EACH ROW EXECUTE FUNCTION public.wf_touch();

-- Seed default rules
INSERT INTO public.workflow_rules (name, description, source_module, trigger, action, channel, offset_days, target_role, active) VALUES
  ('Compliance task – 3 day reminder', 'Notify assignee 3 days before due date', 'compliance', 'reminder_before_due', 'notify_assignee', 'in_app', 3, NULL, true),
  ('Compliance task – overdue escalation', 'Escalate to admin if overdue by 7 days', 'compliance', 'escalate_overdue', 'notify_role', 'email', 7, 'admin', true),
  ('Operational incident – critical alert', 'Immediate email on critical incident', 'operational', 'on_severity', 'notify_role', 'email', 0, 'admin', true),
  ('RWA approval – pending reminder', 'Remind approvers 2 days after pending', 'rwa', 'escalate_overdue', 'notify_role', 'in_app', 2, 'approver', true),
  ('Credit early warning – critical', 'Immediate push on critical EWS', 'credit', 'on_severity', 'notify_role', 'push', 0, 'analyst', true);
