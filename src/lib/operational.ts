import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OpCategory = Database["public"]["Enums"]["op_category"];
export type OpSeverity = Database["public"]["Enums"]["op_severity"];
export type OpStatus = Database["public"]["Enums"]["op_status"];
export type KriStatus = Database["public"]["Enums"]["kri_status"];
export type RiskStatus = Database["public"]["Enums"]["risk_status"];

export type Incident = Database["public"]["Tables"]["op_incidents"]["Row"];
export type Kri = Database["public"]["Tables"]["op_kris"]["Row"];
export type Rcsa = Database["public"]["Tables"]["op_rcsa"]["Row"];
export type RiskItem = Database["public"]["Tables"]["op_risk_register"]["Row"];
export type LossSummary = Database["public"]["Views"]["op_loss_summary"]["Row"];

export const CATEGORY_LABEL: Record<OpCategory, string> = {
  incident: "حادثة",
  loss: "حدث خسارة",
  fraud: "احتيال",
  cyber: "أمن سيبراني",
  bcp: "استمرارية الأعمال",
};

export const SEVERITY_LABEL: Record<OpSeverity, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  critical: "حرج",
};

export const SEVERITY_COLOR: Record<OpSeverity, string> = {
  low: "bg-emerald-500/15 text-emerald-500",
  medium: "bg-amber-500/15 text-amber-500",
  high: "bg-orange-500/15 text-orange-500",
  critical: "bg-destructive/15 text-destructive",
};

export const STATUS_LABEL: Record<OpStatus, string> = {
  open: "مفتوح",
  investigating: "قيد التحقيق",
  contained: "تمّت السيطرة",
  resolved: "تمّت المعالجة",
  closed: "مغلق",
};

export const KRI_COLOR: Record<KriStatus, string> = {
  green: "bg-emerald-500/15 text-emerald-500",
  amber: "bg-amber-500/15 text-amber-500",
  red: "bg-destructive/15 text-destructive",
};

export function fmtMoney(n: number | string | null | undefined, currency = "USD") {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}
export function fmtNum(n: number | string | null | undefined, digits = 2) {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

// ---------- Incidents ----------
export async function listIncidents(category?: OpCategory) {
  let q = supabase.from("op_incidents").select("*").order("occurred_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return data as Incident[];
}
export async function upsertIncident(row: Partial<Incident> & { reported_by: string }) {
  const { data, error } = await supabase.from("op_incidents").upsert(row as never).select().single();
  if (error) throw error;
  return data as Incident;
}
export async function deleteIncident(id: string) {
  const { error } = await supabase.from("op_incidents").delete().eq("id", id);
  if (error) throw error;
}

// ---------- KRIs ----------
export async function listKris() {
  const { data, error } = await supabase.from("op_kris").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Kri[];
}
export async function upsertKri(row: Partial<Kri> & { created_by: string }) {
  const { data, error } = await supabase.from("op_kris").upsert(row as never).select().single();
  if (error) throw error;
  return data as Kri;
}
export async function deleteKri(id: string) {
  const { error } = await supabase.from("op_kris").delete().eq("id", id);
  if (error) throw error;
}

// ---------- RCSA ----------
export async function listRcsa() {
  const { data, error } = await supabase.from("op_rcsa").select("*").order("residual_score", { ascending: false });
  if (error) throw error;
  return data as Rcsa[];
}
export async function upsertRcsa(row: Partial<Rcsa> & { created_by: string }) {
  const { data, error } = await supabase.from("op_rcsa").upsert(row as never).select().single();
  if (error) throw error;
  return data as Rcsa;
}
export async function deleteRcsa(id: string) {
  const { error } = await supabase.from("op_rcsa").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Risk Register ----------
export async function listRiskRegister() {
  const { data, error } = await supabase.from("op_risk_register").select("*").order("residual_score", { ascending: false });
  if (error) throw error;
  return data as RiskItem[];
}
export async function upsertRisk(row: Partial<RiskItem> & { created_by: string }) {
  const { data, error } = await supabase.from("op_risk_register").upsert(row as never).select().single();
  if (error) throw error;
  return data as RiskItem;
}
export async function deleteRisk(id: string) {
  const { error } = await supabase.from("op_risk_register").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Summary ----------
export async function loadLossSummary() {
  const { data, error } = await supabase.from("op_loss_summary").select("*");
  if (error) throw error;
  return data as LossSummary[];
}

export function riskLevel(score: number) {
  if (score >= 15) return { label: "Critical", cls: "text-destructive" };
  if (score >= 10) return { label: "High", cls: "text-orange-500" };
  if (score >= 5) return { label: "Medium", cls: "text-amber-500" };
  return { label: "Low", cls: "text-emerald-500" };
}
