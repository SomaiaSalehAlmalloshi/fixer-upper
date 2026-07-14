import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { scenarioPnl, type Position } from "@/lib/market";
import { computeLCR, type CashFlow, type Hqla } from "@/lib/liquidity";

export type StressType = Database["public"]["Enums"]["stress_type"];
export type StressSeverity = Database["public"]["Enums"]["stress_severity"];
export type StressScenario = Database["public"]["Tables"]["stress_scenarios"]["Row"];
export type StressRun = Database["public"]["Tables"]["stress_runs"]["Row"];

export type Loan = Database["public"]["Tables"]["credit_loans"]["Row"];

export const STRESS_TYPES: StressType[] = [
  "economic_crisis", "inflation", "interest_shock", "currency_collapse",
  "mass_withdrawal", "pandemic", "oil_price_crash", "political_crisis", "custom",
];

export const TYPE_LABEL: Record<StressType, string> = {
  economic_crisis: "أزمة اقتصادية",
  inflation: "تضخم",
  interest_shock: "صدمة أسعار الفائدة",
  currency_collapse: "انهيار العملة",
  mass_withdrawal: "سحوبات جماعية",
  pandemic: "جائحة",
  oil_price_crash: "انهيار أسعار النفط",
  political_crisis: "أزمة سياسية",
  custom: "مخصص",
};

export const TYPE_ICON: Record<StressType, string> = {
  economic_crisis: "🌍", inflation: "📈", interest_shock: "⚡",
  currency_collapse: "💱", mass_withdrawal: "🏃", pandemic: "🦠",
  oil_price_crash: "🛢️", political_crisis: "🏛️", custom: "⚙️",
};

export const SEVERITY_LABEL: Record<StressSeverity, string> = {
  mild: "خفيف", moderate: "متوسط", severe: "شديد", extreme: "بالغ الشدة",
};
export const SEVERITY_COLOR: Record<StressSeverity, string> = {
  mild: "bg-emerald-500/15 text-emerald-500",
  moderate: "bg-amber-500/15 text-amber-500",
  severe: "bg-orange-500/15 text-orange-500",
  extreme: "bg-destructive/15 text-destructive",
};

export type StressParams = {
  gdp_shock?: number;         // fraction, e.g. -0.05
  equity_shock?: number;
  fx_shock?: number;
  ir_shock_bp?: number;       // bp
  commodity_shock?: number;
  oil_shock?: number;
  pd_multiplier?: number;     // e.g. 2.0
  lgd_uplift?: number;        // added to LGD
  deposit_runoff?: number;    // extra outflow fraction
  hqla_haircut?: number;      // extra haircut on HQLA
};

export const DEFAULT_PARAMS: StressParams = {
  gdp_shock: 0, equity_shock: 0, fx_shock: 0, ir_shock_bp: 0,
  commodity_shock: 0, oil_shock: 0, pd_multiplier: 1, lgd_uplift: 0,
  deposit_runoff: 0, hqla_haircut: 0,
};

export function fmtMoney(n: number | null | undefined, currency = "USD") {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}
export function fmtPct(n: number | null | undefined, digits = 1) {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return (v * 100).toLocaleString(undefined, { maximumFractionDigits: digits }) + "%";
}

// ---------- Data access ----------
export async function listScenarios() {
  const { data, error } = await supabase.from("stress_scenarios").select("*").order("is_preset", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data as StressScenario[];
}
export async function getScenario(id: string) {
  const { data, error } = await supabase.from("stress_scenarios").select("*").eq("id", id).single();
  if (error) throw error;
  return data as StressScenario;
}
export async function upsertScenario(row: Partial<StressScenario>) {
  const { data, error } = await supabase.from("stress_scenarios").upsert(row as never).select().single();
  if (error) throw error;
  return data as StressScenario;
}
export async function deleteScenario(id: string) {
  const { error } = await supabase.from("stress_scenarios").delete().eq("id", id);
  if (error) throw error;
}
export async function listRuns(limit = 50) {
  const { data, error } = await supabase.from("stress_runs").select("*").order("run_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data as StressRun[];
}
export async function getRun(id: string) {
  const { data, error } = await supabase.from("stress_runs").select("*").eq("id", id).single();
  if (error) throw error;
  return data as StressRun;
}
export async function saveRun(row: Partial<StressRun>) {
  const { data, error } = await supabase.from("stress_runs").insert(row as never).select().single();
  if (error) throw error;
  return data as StressRun;
}
export async function updateRun(id: string, patch: Partial<StressRun>) {
  const { data, error } = await supabase.from("stress_runs").update(patch as never).eq("id", id).select().single();
  if (error) throw error;
  return data as StressRun;
}

// ---------- Engine ----------
export type StressResults = {
  market: {
    baseline_mv: number;
    stressed_pnl: number;
    stressed_pnl_pct: number;
  };
  credit: {
    baseline_el: number;
    stressed_el: number;
    delta_el: number;
    baseline_ead: number;
  };
  liquidity: {
    baseline_lcr: number;
    stressed_lcr: number;
    baseline_hqla: number;
    stressed_hqla: number;
    baseline_net_outflow: number;
    stressed_net_outflow: number;
  };
  totals: {
    total_loss: number;   // stressed market pnl (loss) + credit delta EL
    capital_impact_pct: number; // vs total_baseline_mv + baseline_ead
  };
};

/** Apply parameters to a portfolio snapshot. Pure function. */
export function runStress(
  params: StressParams,
  positions: Position[],
  loans: Loan[],
  hqla: Hqla[],
  flows: CashFlow[],
): StressResults {
  const p: Required<StressParams> = { ...DEFAULT_PARAMS, ...params } as Required<StressParams>;

  // ---- Market ----
  const baselineMv = positions.reduce((s, x) => s + Number(x.market_value), 0);
  const stressedPnl = scenarioPnl(positions, {
    fx_shock: p.fx_shock,
    ir_shock_bp: p.ir_shock_bp,
    equity_shock: p.equity_shock,
    commodity_shock: p.commodity_shock,
  });

  // ---- Credit ----
  let baseEL = 0, stressEL = 0, baseEAD = 0;
  for (const l of loans) {
    const ead = Number(l.ead);
    const lgd = Number(l.lgd);
    const el = Number(l.expected_loss);
    baseEL += el;
    baseEAD += ead;
    // Reconstruct implicit PD from EL, then apply multiplier + LGD uplift
    const impliedPd = ead > 0 && lgd > 0 ? el / (ead * lgd) : 0;
    const stressedPd = Math.min(1, impliedPd * p.pd_multiplier);
    const stressedLgd = Math.min(1, lgd + p.lgd_uplift);
    stressEL += stressedPd * stressedLgd * ead;
  }

  // ---- Liquidity ----
  const baseline = computeLCR(hqla, flows);
  const stressedHqla: Hqla[] = hqla.map((a) => ({
    ...a,
    eligible_value: Number(a.market_value) * (1 - Number(a.haircut) - p.hqla_haircut),
  }));
  const stressedFlows: CashFlow[] = flows.map((f) => {
    if (f.direction === "outflow") {
      const sf = Math.min(1, Number(f.stress_factor) + p.deposit_runoff);
      return { ...f, stress_factor: sf };
    }
    return f;
  });
  const stressed = computeLCR(stressedHqla, stressedFlows);

  const marketLoss = Math.min(stressedPnl, 0) * -1; // positive number = loss
  const creditDelta = Math.max(stressEL - baseEL, 0);
  const totalLoss = marketLoss + creditDelta;
  const denom = baselineMv + baseEAD;

  return {
    market: {
      baseline_mv: baselineMv,
      stressed_pnl: stressedPnl,
      stressed_pnl_pct: baselineMv > 0 ? stressedPnl / baselineMv : 0,
    },
    credit: {
      baseline_el: baseEL,
      stressed_el: stressEL,
      delta_el: stressEL - baseEL,
      baseline_ead: baseEAD,
    },
    liquidity: {
      baseline_lcr: isFinite(baseline.lcr) ? baseline.lcr : 0,
      stressed_lcr: isFinite(stressed.lcr) ? stressed.lcr : 0,
      baseline_hqla: baseline.hqla.total,
      stressed_hqla: stressed.hqla.total,
      baseline_net_outflow: baseline.cashflows.net,
      stressed_net_outflow: stressed.cashflows.net,
    },
    totals: {
      total_loss: totalLoss,
      capital_impact_pct: denom > 0 ? -totalLoss / denom : 0,
    },
  };
}

export function severityColor(r: StressResults) {
  const impact = Math.abs(r.totals.capital_impact_pct);
  if (impact >= 0.10) return "text-destructive";
  if (impact >= 0.05) return "text-orange-500";
  if (impact >= 0.02) return "text-amber-500";
  return "text-emerald-500";
}
