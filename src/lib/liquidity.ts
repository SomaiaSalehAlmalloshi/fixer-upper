import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type HqlaTier = Database["public"]["Enums"]["hqla_tier"];
export type LiqBucket = Database["public"]["Enums"]["liq_bucket"];
export type LiqDirection = Database["public"]["Enums"]["liq_direction"];
export type FundingSourceType = Database["public"]["Enums"]["funding_source_type"];

export type Hqla = Database["public"]["Tables"]["liq_hqla"]["Row"];
export type CashFlow = Database["public"]["Tables"]["liq_cashflows"]["Row"];
export type FundingSource = Database["public"]["Tables"]["liq_funding_sources"]["Row"];
export type StressScenario = Database["public"]["Tables"]["liq_stress_scenarios"]["Row"];

export const BUCKETS: LiqBucket[] = ["overnight", "1w", "1m", "3m", "6m", "1y", "gt1y"];
export const BUCKET_LABEL: Record<LiqBucket, string> = {
  overnight: "ليلة واحدة",
  "1w": "≤ أسبوع",
  "1m": "≤ شهر",
  "3m": "≤ 3 أشهر",
  "6m": "≤ 6 أشهر",
  "1y": "≤ سنة",
  gt1y: "> سنة",
};
export const BUCKET_DAYS: Record<LiqBucket, number> = {
  overnight: 1, "1w": 7, "1m": 30, "3m": 90, "6m": 180, "1y": 365, gt1y: 3650,
};

export const TIER_LABEL: Record<HqlaTier, string> = {
  level1: "المستوى 1", level2a: "المستوى 2A", level2b: "المستوى 2B",
};
export const TIER_CAP: Record<HqlaTier, number> = { level1: 1.0, level2a: 0.4, level2b: 0.15 };
export const TIER_COLOR: Record<HqlaTier, string> = {
  level1: "bg-emerald-500/15 text-emerald-500",
  level2a: "bg-blue-500/15 text-blue-500",
  level2b: "bg-amber-500/15 text-amber-500",
};

export const SOURCE_LABEL: Record<FundingSourceType, string> = {
  retail_deposits: "ودائع الأفراد",
  wholesale_deposits: "ودائع الجملة",
  repo: "إعادة الشراء",
  interbank: "بين البنوك",
  bond: "إصدار سندات",
  equity: "حقوق ملكية",
  other: "أخرى",
};

export function fmtMoney(n: number | string | null | undefined, currency = "USD") {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}
export function fmtPct(n: number | null | undefined, digits = 1) {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return (v * 100).toLocaleString(undefined, { maximumFractionDigits: digits }) + "%";
}
export function fmtNum(n: number | string | null | undefined, digits = 2) {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

// ---------- HQLA ----------
export async function listHqla() {
  const { data, error } = await supabase.from("liq_hqla").select("*").order("tier");
  if (error) throw error;
  return data as Hqla[];
}
export async function upsertHqla(row: Partial<Hqla>) {
  const { data, error } = await supabase.from("liq_hqla").upsert(row as never).select().single();
  if (error) throw error;
  return data as Hqla;
}
export async function deleteHqla(id: string) {
  const { error } = await supabase.from("liq_hqla").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Cash flows ----------
export async function listCashFlows() {
  const { data, error } = await supabase.from("liq_cashflows").select("*").order("cashflow_date");
  if (error) throw error;
  return data as CashFlow[];
}
export async function upsertCashFlow(row: Partial<CashFlow>) {
  const { data, error } = await supabase.from("liq_cashflows").upsert(row as never).select().single();
  if (error) throw error;
  return data as CashFlow;
}
export async function deleteCashFlow(id: string) {
  const { error } = await supabase.from("liq_cashflows").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Funding sources ----------
export async function listFundingSources() {
  const { data, error } = await supabase.from("liq_funding_sources").select("*").order("amount", { ascending: false });
  if (error) throw error;
  return data as FundingSource[];
}
export async function upsertFundingSource(row: Partial<FundingSource>) {
  const { data, error } = await supabase.from("liq_funding_sources").upsert(row as never).select().single();
  if (error) throw error;
  return data as FundingSource;
}
export async function deleteFundingSource(id: string) {
  const { error } = await supabase.from("liq_funding_sources").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Stress scenarios ----------
export async function listStressScenarios() {
  const { data, error } = await supabase.from("liq_stress_scenarios").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as StressScenario[];
}
export async function upsertStressScenario(row: Partial<StressScenario>) {
  const { data, error } = await supabase.from("liq_stress_scenarios").upsert(row as never).select().single();
  if (error) throw error;
  return data as StressScenario;
}
export async function deleteStressScenario(id: string) {
  const { error } = await supabase.from("liq_stress_scenarios").delete().eq("id", id);
  if (error) throw error;
}

// ============ Calculations ============

/** HQLA net eligible after tier caps (Basel III) */
export function computeHqla(assets: Hqla[]) {
  const active = assets.filter((a) => !a.encumbered);
  const bytier = { level1: 0, level2a: 0, level2b: 0 };
  for (const a of active) bytier[a.tier] += Number(a.eligible_value);

  const l1 = bytier.level1;
  // level2b capped at 15% of total HQLA
  const l2bCap = (l1 + bytier.level2a) * (0.15 / 0.85);
  const l2b = Math.min(bytier.level2b, l2bCap);
  // level2 total capped at 40% of HQLA
  const l2Cap = l1 * (0.4 / 0.6);
  const l2 = Math.min(bytier.level2a + l2b, l2Cap);

  return { level1: l1, level2a: bytier.level2a, level2b: bytier.level2b, l2b_capped: l2b, l2_total_capped: l2, total: l1 + l2 };
}

/** Net cash outflows over the next 30 days (LCR) */
export function computeNetOutflow30d(flows: CashFlow[]) {
  const within30 = flows.filter((f) => ["overnight", "1w", "1m"].includes(f.bucket));
  let outflow = 0, inflow = 0;
  for (const f of within30) {
    const stressed = Number(f.amount) * Number(f.stress_factor);
    if (f.direction === "outflow") outflow += stressed;
    else inflow += stressed;
  }
  // Cap inflows at 75% of outflows (Basel III)
  const cappedInflow = Math.min(inflow, outflow * 0.75);
  return { outflow, inflow, capped_inflow: cappedInflow, net: Math.max(outflow - cappedInflow, 0) };
}

/** LCR = HQLA / Net cash outflows (30d) */
export function computeLCR(assets: Hqla[], flows: CashFlow[]) {
  const hqla = computeHqla(assets);
  const co = computeNetOutflow30d(flows);
  const lcr = co.net > 0 ? hqla.total / co.net : Infinity;
  return { hqla, cashflows: co, lcr };
}

/** NSFR = ASF / RSF from funding sources */
export function computeNSFR(sources: FundingSource[]) {
  let asf = 0, rsf = 0;
  for (const s of sources) {
    asf += Number(s.amount) * Number(s.asf_factor);
    rsf += Number(s.amount) * Number(s.rsf_factor);
  }
  return { asf, rsf, nsfr: rsf > 0 ? asf / rsf : Infinity };
}

/** Cumulative liquidity gap per bucket */
export function computeLiquidityGap(flows: CashFlow[]) {
  const map = new Map<LiqBucket, { inflow: number; outflow: number }>();
  for (const b of BUCKETS) map.set(b, { inflow: 0, outflow: 0 });
  for (const f of flows) {
    const cur = map.get(f.bucket)!;
    if (f.direction === "inflow") cur.inflow += Number(f.amount);
    else cur.outflow += Number(f.amount);
  }
  let cum = 0;
  return BUCKETS.map((b) => {
    const { inflow, outflow } = map.get(b)!;
    const gap = inflow - outflow;
    cum += gap;
    return { bucket: b, label: BUCKET_LABEL[b], inflow, outflow, gap, cumulative: cum };
  });
}

/** Apply a stress scenario to HQLA + cash flows and recompute LCR */
export function applyStress(
  assets: Hqla[],
  flows: CashFlow[],
  sc: Pick<StressScenario, "retail_runoff" | "wholesale_runoff" | "extra_haircut" | "inflow_haircut">,
) {
  const stressedAssets: Hqla[] = assets.map((a) => ({
    ...a,
    eligible_value: Number(a.market_value) * (1 - Number(a.haircut) - Number(sc.extra_haircut)),
  }));
  const stressedFlows: CashFlow[] = flows.map((f) => {
    let sf = Number(f.stress_factor);
    if (f.direction === "outflow") {
      if (/retail/i.test(f.category)) sf = Math.max(sf, Number(sc.retail_runoff));
      else if (/wholesale|corp/i.test(f.category)) sf = Math.max(sf, Number(sc.wholesale_runoff));
    } else {
      sf = sf * (1 - Number(sc.inflow_haircut));
    }
    return { ...f, stress_factor: sf };
  });
  return computeLCR(stressedAssets, stressedFlows);
}

export function ratioColor(r: number, thresholdOk = 1, thresholdWarn = 1.1) {
  if (r >= thresholdWarn) return "text-emerald-500";
  if (r >= thresholdOk) return "text-amber-500";
  return "text-destructive";
}
