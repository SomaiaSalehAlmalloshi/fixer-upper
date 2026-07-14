import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Category = "credit" | "market" | "operational";
export type Status = "draft" | "pending" | "approved" | "rejected";
export type Asset = Database["public"]["Tables"]["rwa_assets"]["Row"];
export type Rule = Database["public"]["Tables"]["risk_weight_rules"]["Row"];
export type Approval = Database["public"]["Tables"]["rwa_approvals"]["Row"];
export type Calc = Database["public"]["Tables"]["rwa_calculations"]["Row"];

export function fmtMoney(n: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}
export function fmtPct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

/** Risk Weight Engine: pick the best matching rule for an asset. */
export function pickRiskWeight(
  rules: Rule[],
  category: Category,
  assetClass: string,
  counterpartyType?: string | null,
  rating?: string | null,
): Rule | null {
  const scoped = rules.filter((r) => r.active && r.category === category && r.asset_class === assetClass);
  if (!scoped.length) return null;
  // most specific match first
  const scored = scoped.map((r) => {
    let s = 0;
    if (r.counterparty_type && counterpartyType && r.counterparty_type === counterpartyType) s += 2;
    if (r.rating && rating && r.rating === rating) s += 2;
    if (!r.counterparty_type) s += 0.1;
    if (!r.rating) s += 0.1;
    return { r, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0].r;
}

export async function loadRules() {
  const { data, error } = await supabase.from("risk_weight_rules").select("*").order("category").order("asset_class");
  if (error) throw error;
  return data as Rule[];
}

export async function loadAssets(category?: Category) {
  let q = supabase.from("rwa_assets").select("*").order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return data as Asset[];
}
