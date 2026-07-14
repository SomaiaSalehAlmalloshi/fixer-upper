import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Position = Database["public"]["Tables"]["market_positions"]["Row"];
export type VarRun = Database["public"]["Tables"]["market_var_runs"]["Row"];
export type Scenario = Database["public"]["Tables"]["market_scenarios"]["Row"];
export type MarketSummaryRow = Database["public"]["Views"]["market_risk_summary"]["Row"];

export const ASSET_CLASSES = ["fx", "ir", "commodity", "equity"] as const;
export const ASSET_LABEL: Record<(typeof ASSET_CLASSES)[number], string> = {
  fx: "العملات الأجنبية",
  ir: "أسعار الفائدة",
  commodity: "السلع",
  equity: "الأسهم",
};
export const VAR_METHODS = ["parametric", "historical", "monte_carlo"] as const;

export function fmtMoney(n: number | string | null | undefined, currency = "USD") {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}
export function fmtNum(n: number | string | null | undefined, digits = 2) {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}
export function fmtPct(n: number | string | null | undefined, digits = 2) {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return `${(v * 100).toFixed(digits)}%`;
}

// Z-score for common confidence levels (one-tailed, normal)
export function zScore(confidence: number) {
  if (confidence >= 0.999) return 3.09;
  if (confidence >= 0.99) return 2.326;
  if (confidence >= 0.975) return 1.96;
  if (confidence >= 0.95) return 1.645;
  if (confidence >= 0.9) return 1.282;
  return 1.0;
}

/** Parametric (variance-covariance) VaR — assumes zero correlation across positions. */
export function parametricVaR(positions: Position[], confidence: number, horizonDays: number) {
  const z = zScore(confidence);
  const sqrtT = Math.sqrt(horizonDays);
  const variance = positions.reduce((s, p) => {
    const mv = Number(p.market_value);
    const vol = Number(p.volatility);
    return s + Math.pow(mv * vol, 2);
  }, 0);
  const sigma = Math.sqrt(variance);
  const varAmt = z * sigma * sqrtT;
  // Expected Shortfall (normal): phi(z)/(1-c) * sigma * sqrtT
  const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const es = (phi / (1 - confidence)) * sigma * sqrtT;
  const mv = positions.reduce((s, p) => s + Number(p.market_value), 0);
  const breakdown: Record<string, number> = {};
  for (const p of positions) {
    breakdown[p.asset_class] = (breakdown[p.asset_class] ?? 0) + Math.pow(Number(p.market_value) * Number(p.volatility), 2);
  }
  for (const k of Object.keys(breakdown)) breakdown[k] = z * Math.sqrt(breakdown[k]) * sqrtT;
  return { varAmount: varAmt, esAmount: es, portfolioMv: mv, sigma, breakdown };
}

/** Apply scenario shocks to positions → net P&L. */
export function scenarioPnl(positions: Position[], s: { fx_shock: number; ir_shock_bp: number; equity_shock: number; commodity_shock: number }) {
  let pnl = 0;
  for (const p of positions) {
    const mv = Number(p.market_value);
    if (p.asset_class === "fx") pnl += mv * Number(s.fx_shock);
    else if (p.asset_class === "ir") pnl += -mv * Number(p.duration) * (Number(s.ir_shock_bp) / 10000);
    else if (p.asset_class === "equity") pnl += mv * Number(p.beta) * Number(s.equity_shock);
    else if (p.asset_class === "commodity") pnl += mv * Number(s.commodity_shock);
  }
  return pnl;
}

// ---------- Positions ----------
export async function listPositions() {
  const { data, error } = await supabase.from("market_positions").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function upsertPosition(row: Partial<Position> & { created_by: string }) {
  const { data, error } = await supabase.from("market_positions").upsert(row as never).select().single();
  if (error) throw error;
  return data;
}
export async function deletePosition(id: string) {
  const { error } = await supabase.from("market_positions").delete().eq("id", id);
  if (error) throw error;
}

// ---------- VaR runs ----------
export async function listVarRuns() {
  const { data, error } = await supabase.from("market_var_runs").select("*").order("run_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function saveVarRun(row: Partial<VarRun> & { run_by: string; name: string }) {
  const { data, error } = await supabase.from("market_var_runs").insert(row as never).select().single();
  if (error) throw error;
  return data;
}

// ---------- Scenarios ----------
export async function listScenarios() {
  const { data, error } = await supabase.from("market_scenarios").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function upsertScenario(row: Partial<Scenario> & { created_by: string }) {
  const { data, error } = await supabase.from("market_scenarios").upsert(row as never).select().single();
  if (error) throw error;
  return data;
}
export async function deleteScenario(id: string) {
  const { error } = await supabase.from("market_scenarios").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Summary ----------
export async function loadMarketSummary() {
  const { data, error } = await supabase.from("market_risk_summary").select("*");
  if (error) throw error;
  return data as MarketSummaryRow[];
}