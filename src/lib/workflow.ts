import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Channel = Database["public"]["Enums"]["notification_channel"];
export type NotifStatus = Database["public"]["Enums"]["notification_status"];
export type Priority = Database["public"]["Enums"]["notification_priority"];
export type Module = Database["public"]["Enums"]["workflow_source_module"];
export type Trigger = Database["public"]["Enums"]["workflow_rule_trigger"];
export type Action = Database["public"]["Enums"]["workflow_action"];

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationPref = Database["public"]["Tables"]["notification_preferences"]["Row"];
export type WorkflowRule = Database["public"]["Tables"]["workflow_rules"]["Row"];
export type WorkflowEvent = Database["public"]["Tables"]["workflow_events"]["Row"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "البريد الإلكتروني",
  sms: "رسالة نصية",
  push: "إشعار فوري",
  in_app: "داخل التطبيق",
};

export const MODULE_LABEL: Record<Module, string> = {
  compliance: "الامتثال",
  credit: "مخاطر الائتمان",
  market: "مخاطر السوق",
  operational: "المخاطر التشغيلية",
  liquidity: "السيولة",
  stress: "اختبارات الضغط",
  rwa: "الأصول المرجّحة بالمخاطر",
  reporting: "التقارير",
  system: "النظام",
};

export const TRIGGER_LABEL: Record<Trigger, string> = {
  reminder_before_due: "تذكير قبل الاستحقاق",
  escalate_overdue: "تصعيد المتأخر",
  on_status_change: "عند تغيّر الحالة",
  on_severity: "عند مستوى الخطورة",
};

export const ACTION_LABEL: Record<Action, string> = {
  notify_assignee: "إشعار المسؤول",
  notify_role: "إشعار الدور",
  reassign: "إعادة تعيين",
  change_priority: "تغيير الأولوية",
  change_status: "تغيير الحالة",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export const STATUS_COLOR: Record<NotifStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  sent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  read: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  failed: "bg-red-500/15 text-red-700 dark:text-red-300",
  skipped: "bg-muted text-muted-foreground",
};

export async function listNotifications(userId: string, limit = 100) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function unreadCount(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("status", ["sent", "pending"]);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function listPreferences(userId: string) {
  const { data, error } = await supabase.from("notification_preferences").select("*").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function upsertPreference(row: Partial<NotificationPref> & { user_id: string; channel: Channel; source_module: Module }) {
  const { error } = await supabase.from("notification_preferences").upsert(row, { onConflict: "user_id,channel,source_module" });
  if (error) throw error;
}

export async function listRules() {
  const { data, error } = await supabase.from("workflow_rules").select("*").order("source_module").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function upsertRule(row: Database["public"]["Tables"]["workflow_rules"]["Insert"]) {
  const { error } = await supabase.from("workflow_rules").upsert(row).select().single();
  if (error) throw error;
}

export async function deleteRule(id: string) {
  const { error } = await supabase.from("workflow_rules").delete().eq("id", id);
  if (error) throw error;
}

export async function listEvents(module?: Module, limit = 200) {
  let q = supabase.from("workflow_events").select("*").order("created_at", { ascending: false }).limit(limit);
  if (module) q = q.eq("source_module", module);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function logEvent(row: {
  source_module: Module;
  source_id?: string | null;
  event_type: string;
  actor?: string | null;
  target_user?: string | null;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  const insertRow: Database["public"]["Tables"]["workflow_events"]["Insert"] = {
    source_module: row.source_module,
    source_id: row.source_id ?? null,
    event_type: row.event_type,
    actor: row.actor ?? null,
    target_user: row.target_user ?? null,
    message: row.message ?? null,
    metadata: (row.metadata ?? {}) as Database["public"]["Tables"]["workflow_events"]["Insert"]["metadata"],
  };
  const { error } = await supabase.from("workflow_events").insert(insertRow);
  if (error) throw error;
}


// Cross-module unified task view (compliance_tasks + rwa_approvals + op_incidents)
export type UnifiedTask = {
  id: string;
  source_module: Module;
  title: string;
  status: string;
  priority: string;
  severity?: string | null;
  assignee?: string | null;
  due_date?: string | null;
  created_at: string;
  action_url: string;
};

export async function loadUnifiedTasks(): Promise<UnifiedTask[]> {
  const [ct, ri, oi] = await Promise.all([
    supabase.from("compliance_tasks").select("id,title,status,priority,severity,assignee,due_date,created_at"),
    supabase.from("rwa_approvals").select("id,asset_id,action,actor_id,created_at"),
    supabase.from("op_incidents").select("id,title,status,severity,reported_by,created_at"),
  ]);
  const out: UnifiedTask[] = [];
  for (const t of ct.data ?? []) {
    out.push({
      id: t.id,
      source_module: "compliance",
      title: t.title,
      status: String(t.status),
      priority: String(t.priority),
      severity: t.severity,
      assignee: t.assignee,
      due_date: t.due_date,
      created_at: t.created_at,
      action_url: `/compliance/tasks/${t.id}`,
    });
  }
  for (const a of ri.data ?? []) {
    out.push({
      id: a.id,
      source_module: "rwa",
      title: `RWA approval — asset ${a.asset_id?.slice(0, 8) ?? ""}`,
      status: String(a.action),
      priority: "normal",
      severity: null,
      assignee: a.actor_id,
      due_date: null,
      created_at: a.created_at,
      action_url: `/approvals`,
    });
  }
  for (const i of oi.data ?? []) {
    out.push({
      id: i.id,
      source_module: "operational",
      title: i.title,
      status: String(i.status),
      priority: "normal",
      severity: i.severity,
      assignee: i.reported_by,
      due_date: null,
      created_at: i.created_at,
      action_url: `/operational/incidents`,
    });
  }
  return out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

