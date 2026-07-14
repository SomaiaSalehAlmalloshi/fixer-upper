import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { computeLCR, computeNSFR, listCashFlows, listFundingSources, listHqla } from "@/lib/liquidity";

export type Framework = Database["public"]["Enums"]["compliance_framework"];
export type Metric = Database["public"]["Enums"]["compliance_metric"];
export type Operator = Database["public"]["Enums"]["compliance_operator"];
export type Status = Database["public"]["Enums"]["compliance_status"];
export type Severity = Database["public"]["Enums"]["compliance_severity"];
export type TaskStatus = Database["public"]["Enums"]["compliance_task_status"];

export type Rule = Database["public"]["Tables"]["compliance_rules"]["Row"];
export type Check = Database["public"]["Tables"]["compliance_checks"]["Row"];
export type Task = Database["public"]["Tables"]["compliance_tasks"]["Row"];
export type Evidence = Database["public"]["Tables"]["compliance_evidence"]["Row"];
export type AuditEntry = Database["public"]["Tables"]["compliance_audit_log"]["Row"];

export const FRAMEWORK_LABEL: Record<Framework, string> = {
  basel_iii: "بازل III",
  basel_iv: "بازل IV (تجريبي)",
  local: "الجهة التنظيمية المحلية",
  other: "أخرى",
};

export const METRIC_LABEL: Record<Metric, string> = {
  lcr: "نسبة تغطية السيولة (LCR)",
  nsfr: "نسبة صافي التمويل المستقر (NSFR)",
  cet1_ratio: "نسبة CET1",
  tier1_ratio: "نسبة الشريحة الأولى",
  total_capital_ratio: "نسبة كفاية رأس المال",
  leverage_ratio: "نسبة الرافعة المالية",
  npl_ratio: "نسبة القروض المتعثّرة",
  concentration: "التركّز على مقترض واحد",
  kri_breach: "عدد تجاوزات مؤشرات المخاطر",
  custom: "مخصص",
};

export const OP_LABEL: Record<Operator, string> = { gte: "≥", lte: "≤", gt: ">", lt: "<", eq: "=" };

export const SEVERITY_COLOR: Record<Severity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/15 text-amber-500",
  high: "bg-orange-500/15 text-orange-500",
  critical: "bg-destructive/15 text-destructive",
};

export const STATUS_COLOR: Record<Status, string> = {
  pass: "bg-emerald-500/15 text-emerald-500",
  warn: "bg-amber-500/15 text-amber-500",
  fail: "bg-destructive/15 text-destructive",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "مفتوح",
  in_progress: "قيد التنفيذ",
  pending_approval: "بانتظار الاعتماد",
  approved: "معتمد",
  rejected: "مرفوض",
  closed: "مغلق",
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  open: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-500",
  pending_approval: "bg-amber-500/15 text-amber-500",
  approved: "bg-emerald-500/15 text-emerald-500",
  rejected: "bg-destructive/15 text-destructive",
  closed: "bg-muted text-muted-foreground",
};

export function fmtValue(v: number | null | undefined, unit: string, digits = 2) {
  if (v == null || !isFinite(v)) return "—";
  if (unit === "ratio") return (v * 100).toLocaleString(undefined, { maximumFractionDigits: digits }) + "%";
  if (unit === "count") return Math.round(v).toString();
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function evaluate(value: number, op: Operator, threshold: number): boolean {
  switch (op) {
    case "gte": return value >= threshold;
    case "lte": return value <= threshold;
    case "gt": return value > threshold;
    case "lt": return value < threshold;
    case "eq": return value === threshold;
  }
}

export function resolveStatus(value: number | null, rule: Pick<Rule, "operator" | "threshold_warn" | "threshold_fail">): Status {
  if (value == null || !isFinite(value)) return "warn";
  const fail = Number(rule.threshold_fail);
  if (!evaluate(value, rule.operator, fail)) return "fail";
  if (rule.threshold_warn != null && !evaluate(value, rule.operator, Number(rule.threshold_warn))) return "warn";
  return "pass";
}

// -------- CRUD --------
export async function listRules(): Promise<Rule[]> {
  const { data, error } = await supabase.from("compliance_rules").select("*").order("framework").order("code");
  if (error) throw error;
  return data as Rule[];
}
export async function upsertRule(row: Partial<Rule>) {
  const { data, error } = await supabase.from("compliance_rules").upsert(row as never).select().single();
  if (error) throw error;
  return data as Rule;
}
export async function deleteRule(id: string) {
  const { error } = await supabase.from("compliance_rules").delete().eq("id", id);
  if (error) throw error;
}

export async function listChecks(limit = 500): Promise<Check[]> {
  const { data, error } = await supabase.from("compliance_checks").select("*").order("run_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data as Check[];
}
export async function latestChecks(): Promise<Check[]> {
  const all = await listChecks(1000);
  const seen = new Map<string, Check>();
  for (const c of all) if (!seen.has(c.rule_code)) seen.set(c.rule_code, c);
  return Array.from(seen.values());
}

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from("compliance_tasks").select("*").order("priority").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Task[];
}
export async function getTask(id: string): Promise<Task> {
  const { data, error } = await supabase.from("compliance_tasks").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Task;
}
export async function upsertTask(row: Partial<Task>) {
  const { data, error } = await supabase.from("compliance_tasks").upsert(row as never).select().single();
  if (error) throw error;
  return data as Task;
}
export async function deleteTask(id: string) {
  const { error } = await supabase.from("compliance_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function listEvidence(taskId: string): Promise<Evidence[]> {
  const { data, error } = await supabase.from("compliance_evidence").select("*").eq("task_id", taskId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as Evidence[];
}
export async function addEvidence(row: Partial<Evidence> & { task_id: string; title: string; uploaded_by: string }) {
  const { data, error } = await supabase.from("compliance_evidence").insert(row as never).select().single();
  if (error) throw error;
  return data as Evidence;
}
export async function deleteEvidence(id: string) {
  const { error } = await supabase.from("compliance_evidence").delete().eq("id", id);
  if (error) throw error;
}

export async function listAudit(entityId?: string, limit = 200): Promise<AuditEntry[]> {
  let q = supabase.from("compliance_audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (entityId) q = q.eq("entity_id", entityId);
  const { data, error } = await q;
  if (error) throw error;
  return data as AuditEntry[];
}
export async function logAudit(row: { entity_type: string; entity_id?: string | null; action: string; actor: string; details?: Record<string, unknown> }) {
  const { error } = await supabase.from("compliance_audit_log").insert({
    entity_type: row.entity_type,
    entity_id: row.entity_id ?? null,
    action: row.action,
    actor: row.actor,
    details: (row.details ?? {}) as never,
  } as never);
  if (error) throw error;
}

// -------- Monitoring engine --------
export type MetricSample = {
  metric: Metric;
  value: number | null;
  details: Record<string, unknown>;
};

/** Collect current metric values from existing modules. */
export async function collectMetrics(): Promise<Record<Metric, MetricSample>> {
  const [hqla, cashflows, funding, loansRes, krisRes, rwaRes] = await Promise.all([
    listHqla(),
    listCashFlows(),
    listFundingSources(),
    supabase.from("credit_loans").select("outstanding, status, days_past_due, borrower_id"),
    supabase.from("op_kris").select("status"),
    supabase.from("rwa_assets").select("rwa_amount, exposure_amount"),
  ]);

  const lcr = computeLCR(hqla, cashflows);
  const nsfr = computeNSFR(funding);

  const loans = (loansRes.data ?? []) as { outstanding: number | string; status: string; days_past_due: number | null; borrower_id: string }[];
  const totalOut = loans.reduce((s, l) => s + Number(l.outstanding), 0);
  const nonPerf = loans.filter((l) => l.status === "default" || (l.days_past_due ?? 0) >= 90).reduce((s, l) => s + Number(l.outstanding), 0);
  const nplRatio = totalOut > 0 ? nonPerf / totalOut : 0;

  const perBorrower = new Map<string, number>();
  for (const l of loans) perBorrower.set(l.borrower_id, (perBorrower.get(l.borrower_id) ?? 0) + Number(l.outstanding));
  const largest = Math.max(0, ...Array.from(perBorrower.values()));
  const concentration = totalOut > 0 ? largest / totalOut : 0;

  const kris = (krisRes.data ?? []) as { status: string }[];
  const kriBreach = kris.filter((k) => k.status === "red").length;

  const rwa = (rwaRes.data ?? []) as { rwa_amount: number | string; exposure_amount: number | string }[];
  const totalRwa = rwa.reduce((s, r) => s + Number(r.rwa_amount), 0);
  const totalExposure = rwa.reduce((s, r) => s + Number(r.exposure_amount), 0);

  return {
    lcr: { metric: "lcr", value: isFinite(lcr.lcr) ? lcr.lcr : 999, details: { hqla: lcr.hqla.total, net_outflow: lcr.cashflows.net } },
    nsfr: { metric: "nsfr", value: isFinite(nsfr.nsfr) ? nsfr.nsfr : 999, details: { asf: nsfr.asf, rsf: nsfr.rsf } },
    // Capital ratios require the capital numerator, which is not tracked yet.
    // The rules still exist as regulator-facing thresholds; we surface them as warnings until data is provided.
    cet1_ratio: { metric: "cet1_ratio", value: null, details: { note: "CET1 capital not tracked", rwa: totalRwa } },
    tier1_ratio: { metric: "tier1_ratio", value: null, details: { note: "Tier 1 capital not tracked", rwa: totalRwa } },
    total_capital_ratio: { metric: "total_capital_ratio", value: null, details: { note: "Total capital not tracked", rwa: totalRwa } },
    leverage_ratio: { metric: "leverage_ratio", value: null, details: { note: "Tier 1 capital not tracked", exposure: totalExposure } },
    npl_ratio: { metric: "npl_ratio", value: nplRatio, details: { total_outstanding: totalOut, non_performing: nonPerf } },
    concentration: { metric: "concentration", value: concentration, details: { largest_exposure: largest, total_outstanding: totalOut } },
    kri_breach: { metric: "kri_breach", value: kriBreach, details: { red_count: kriBreach, total: kris.length } },
    custom: { metric: "custom", value: null, details: {} },
  };
}

export async function runMonitoring(userId: string): Promise<Check[]> {
  const [rules, metrics] = await Promise.all([listRules(), collectMetrics()]);
  const rows: Partial<Check>[] = [];
  for (const r of rules.filter((x) => x.active)) {
    const m = metrics[r.metric];
    const status = resolveStatus(m.value, r);
    rows.push({
      rule_id: r.id,
      rule_code: r.code,
      rule_name: r.name,
      framework: r.framework,
      metric: r.metric,
      metric_value: m.value ?? null,
      threshold_warn: r.threshold_warn,
      threshold_fail: r.threshold_fail,
      operator: r.operator,
      status,
      severity: r.severity,
      details: m.details as never,
      run_by: userId,
    });
  }
  if (!rows.length) return [];
  const { data, error } = await supabase.from("compliance_checks").insert(rows as never).select();
  if (error) throw error;
  return data as Check[];
}

/** Create a remediation task from a failing check, if one is not already open. */
export async function createTaskFromCheck(check: Check, rule: Rule | null, userId: string): Promise<Task> {
  const row: Partial<Task> = {
    rule_id: check.rule_id,
    check_id: check.id,
    title: `${check.rule_code}: ${check.rule_name}`,
    description: `Automated finding — ${METRIC_LABEL[check.metric]} is ${fmtValue(Number(check.metric_value), rule?.unit ?? "ratio")} against threshold ${OP_LABEL[check.operator]} ${fmtValue(Number(check.threshold_fail), rule?.unit ?? "ratio")}.`,
    recommendation: rule?.recommendation ?? "Review the underlying metric and design a remediation plan.",
    framework: check.framework,
    severity: check.severity,
    priority: check.severity === "critical" ? 1 : check.severity === "high" ? 2 : 3,
    status: "open",
    created_by: userId,
  };
  const task = await upsertTask(row);
  await logAudit({ entity_type: "task", entity_id: task.id, action: "created_from_check", actor: userId, details: { check_id: check.id } });
  return task;
}

// -------- Workflow --------
export async function submitForApproval(taskId: string, userId: string) {
  const patch: Partial<Task> = { id: taskId, status: "pending_approval", submitted_by: userId, submitted_at: new Date().toISOString() };
  const t = await upsertTask(patch);
  await logAudit({ entity_type: "task", entity_id: taskId, action: "submitted", actor: userId });
  return t;
}
export async function approveTask(taskId: string, userId: string, resolution?: string) {
  const patch: Partial<Task> = { id: taskId, status: "approved", approved_by: userId, approved_at: new Date().toISOString(), resolution };
  const t = await upsertTask(patch);
  await logAudit({ entity_type: "task", entity_id: taskId, action: "approved", actor: userId, details: { resolution } });
  return t;
}
export async function rejectTask(taskId: string, userId: string, reason: string) {
  const patch: Partial<Task> = { id: taskId, status: "rejected", approved_by: userId, approved_at: new Date().toISOString(), rejection_reason: reason };
  const t = await upsertTask(patch);
  await logAudit({ entity_type: "task", entity_id: taskId, action: "rejected", actor: userId, details: { reason } });
  return t;
}
export async function setTaskStatus(taskId: string, status: TaskStatus, userId: string) {
  const t = await upsertTask({ id: taskId, status });
  await logAudit({ entity_type: "task", entity_id: taskId, action: `status_${status}`, actor: userId });
  return t;
}
