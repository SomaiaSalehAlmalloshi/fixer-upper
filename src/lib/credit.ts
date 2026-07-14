import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Borrower = Database["public"]["Tables"]["credit_borrowers"]["Row"];
export type Loan = Database["public"]["Tables"]["credit_loans"]["Row"];
export type Collateral = Database["public"]["Tables"]["credit_collateral"]["Row"];
export type Rating = Database["public"]["Tables"]["credit_ratings"]["Row"];
export type Watch = Database["public"]["Tables"]["credit_watchlist"]["Row"];
export type EWS = Database["public"]["Tables"]["credit_early_warnings"]["Row"];
export type PortfolioRow = Database["public"]["Views"]["credit_portfolio_summary"]["Row"];

export const BORROWER_TYPES = ["individual", "sme", "corporate", "sovereign", "bank"] as const;
export const LOAN_STATUSES = ["active", "closed", "default", "written_off", "restructured"] as const;
export const COLLATERAL_TYPES = ["real_estate", "cash", "securities", "equipment", "inventory", "guarantee", "other"] as const;
export const RATING_SCALE = ["AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-", "BB+", "BB", "BB-", "B+", "B", "B-", "CCC", "CC", "C", "D"] as const;
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export function fmtMoney(n: number | string | null | undefined, currency = "USD") {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  const raw = (currency || "USD").toUpperCase();
  // Map common non-ISO codes to ISO 4217
  const CURRENCY_ALIASES: Record<string, string> = { LY: "LYD", SA: "SAR", AE: "AED", EG: "EGP", KW: "KWD", QA: "QAR", BH: "BHD", OM: "OMR", JO: "JOD" };
  const code = CURRENCY_ALIASES[raw] ?? raw;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency: code, maximumFractionDigits: 0,
    }).format(v);
  } catch {
    const num = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v);
    return `${num} ${code}`;
  }
}
export function fmtPct(n: number | string | null | undefined, digits = 2) {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return `${(v * 100).toFixed(digits)}%`;
}
export function fmtDate(s: string | null | undefined) {
  return s ? new Date(s).toLocaleDateString() : "—";
}

/** Expected Loss = PD × LGD × EAD */
export function expectedLoss(pd: number, lgd: number, ead: number) {
  return pd * lgd * ead;
}

// ---------- Borrowers ----------
export async function listBorrowers() {
  const { data, error } = await supabase.from("credit_borrowers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function upsertBorrower(row: Partial<Borrower> & { created_by: string }) {
  const { data, error } = await supabase.from("credit_borrowers").upsert(row as never).select().single();
  if (error) throw error;
  return data;
}
export async function deleteBorrower(id: string) {
  const { error } = await supabase.from("credit_borrowers").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Loans ----------
export async function listLoans() {
  const { data, error } = await supabase
    .from("credit_loans")
    .select("*, borrower:credit_borrowers(id, code, name, credit_rating, pd)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function upsertLoan(row: Partial<Loan> & { created_by: string }) {
  const { data, error } = await supabase.from("credit_loans").upsert(row as never).select().single();
  if (error) throw error;
  return data;
}
export async function deleteLoan(id: string) {
  const { error } = await supabase.from("credit_loans").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Collateral ----------
export async function listCollateral() {
  const { data, error } = await supabase
    .from("credit_collateral")
    .select("*, loan:credit_loans(loan_number, borrower_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function upsertCollateral(row: Partial<Collateral> & { created_by: string; loan_id: string }) {
  const { data, error } = await supabase.from("credit_collateral").upsert(row as never).select().single();
  if (error) throw error;
  return data;
}
export async function deleteCollateral(id: string) {
  const { error } = await supabase.from("credit_collateral").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Portfolio summary ----------
export async function loadPortfolio() {
  const { data, error } = await supabase.from("credit_portfolio_summary").select("*").order("total_ead", { ascending: false });
  if (error) throw error;
  return data as PortfolioRow[];
}

// ---------- Watch list ----------
export async function listWatch() {
  const { data, error } = await supabase
    .from("credit_watchlist")
    .select("*, borrower:credit_borrowers(code, name), loan:credit_loans(loan_number)")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function addWatch(row: Partial<Watch> & { added_by: string; reason: string }) {
  const { data, error } = await supabase.from("credit_watchlist").insert(row as never).select().single();
  if (error) throw error;
  return data;
}
export async function resolveWatch(id: string, resolution: string) {
  const { error } = await supabase.from("credit_watchlist").update({ resolved_at: new Date().toISOString(), resolution }).eq("id", id);
  if (error) throw error;
}

// ---------- Early warnings ----------
export async function listWarnings() {
  const { data, error } = await supabase
    .from("credit_early_warnings")
    .select("*, borrower:credit_borrowers(code, name), loan:credit_loans(loan_number)")
    .order("triggered_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function updateWarningStatus(id: string, status: "open" | "acknowledged" | "resolved" | "false_positive", userId: string) {
  const patch: Database["public"]["Tables"]["credit_early_warnings"]["Update"] = { status };
  if (status === "acknowledged" || status === "resolved") {
    patch.acknowledged_by = userId;
    patch.acknowledged_at = new Date().toISOString();
  }
  const { error } = await supabase.from("credit_early_warnings").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------- Ratings ----------
export async function listRatings(borrowerId?: string) {
  let q = supabase.from("credit_ratings").select("*").order("rated_at", { ascending: false });
  if (borrowerId) q = q.eq("borrower_id", borrowerId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
export async function addRating(row: Partial<Rating> & { borrower_id: string; rating: string }) {
  const { data, error } = await supabase.from("credit_ratings").insert(row as never).select().single();
  if (error) throw error;
  return data;
}