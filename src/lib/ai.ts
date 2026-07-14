import { supabase } from "@/integrations/supabase/client";
import { listLoans, listWarnings, listWatch } from "@/lib/credit";
import { listPositions } from "@/lib/market";
import { computeLCR, computeNSFR, listCashFlows, listFundingSources, listHqla } from "@/lib/liquidity";
import { listIncidents, listKris, listRiskRegister } from "@/lib/operational";
import { latestChecks, listTasks, listRules } from "@/lib/compliance";
import { loadAssets } from "@/lib/rwa";

export type Snapshot = {
  capital: { totalRwa: number; totalExposure: number; approvedAssets: number };
  liquidity: { lcr: number; nsfr: number; hqla: number; netOutflow: number };
  credit: { loanCount: number; totalOutstanding: number; nplRatio: number; watchlist: number; warnings: number };
  market: { positions: number; grossNotional: number; byClass: Record<string, number> };
  operational: { openIncidents: number; totalLoss: number; kriBreaches: number; risks: number };
  compliance: { failing: number; warning: number; passing: number; openTasks: number; ruleCount: number };
};

export async function buildSnapshot(): Promise<Snapshot> {
  const [assets, loans, warnings, watch, positions, hqla, flows, funding, incidents, kris, risks, checks, tasks, rules] =
    await Promise.all([
      loadAssets(),
      listLoans(),
      listWarnings(),
      listWatch(),
      listPositions(),
      listHqla(),
      listCashFlows(),
      listFundingSources(),
      listIncidents(),
      listKris(),
      listRiskRegister(),
      latestChecks(),
      listTasks(),
      listRules(),
    ]);

  const approvedAssets = assets.filter((a) => a.status === "approved");
  const totalExposure = approvedAssets.reduce((s, a) => s + Number(a.exposure_amount ?? 0), 0);
  const totalRwa = approvedAssets.reduce((s, a) => s + Number(a.exposure_amount ?? 0) * Number(a.risk_weight ?? 0), 0);

  const { lcr, hqla: hq, cashflows } = computeLCR(hqla, flows);
  const { nsfr } = computeNSFR(funding);

  const totalOutstanding = loans.reduce((s, l) => s + Number(l.outstanding ?? l.principal ?? 0), 0);
  const npl = loans.filter((l) => l.status === "default" || l.status === "written_off");
  const nplAmt = npl.reduce((s, l) => s + Number(l.outstanding ?? l.principal ?? 0), 0);
  const nplRatio = totalOutstanding > 0 ? nplAmt / totalOutstanding : 0;

  const byClass: Record<string, number> = {};
  let grossNotional = 0;
  for (const p of positions) {
    const n = Math.abs(Number(p.notional ?? 0));
    grossNotional += n;
    byClass[p.asset_class] = (byClass[p.asset_class] ?? 0) + n;
  }

  const openIncidents = incidents.filter((i) => i.status !== "closed").length;
  const totalLoss = incidents.reduce((s, i) => s + Number(i.net_loss ?? i.gross_loss ?? 0), 0);
  const kriBreaches = kris.filter((k) => k.status === "red" || k.status === "amber").length;


  const failing = checks.filter((c) => c.status === "fail").length;
  const warning = checks.filter((c) => c.status === "warn").length;
  const passing = checks.filter((c) => c.status === "pass").length;
  const openTasks = tasks.filter((t) => t.status !== "closed" && t.status !== "approved").length;

  return {
    capital: { totalRwa, totalExposure, approvedAssets: approvedAssets.length },
    liquidity: { lcr: Number(lcr), nsfr: Number(nsfr), hqla: hq.total, netOutflow: cashflows.net },
    credit: {
      loanCount: loans.length,
      totalOutstanding,
      nplRatio,
      watchlist: watch.filter((w) => !w.resolved_at).length,
      warnings: warnings.length,
    },
    market: { positions: positions.length, grossNotional, byClass },
    operational: {
      openIncidents,
      totalLoss,
      kriBreaches,
      risks: risks.filter((r) => r.status !== "closed").length,
    },
    compliance: {
      failing,
      warning,
      passing,
      openTasks,
      ruleCount: rules.length,
    },
  };
}

export async function loadFraudIncidents() {
  return listIncidents("fraud");
}

export type NlQueryContext = {
  tables: string[];
  snapshot: Snapshot;
};

/** Free-form NL query context: safely fetches small slices of data */
export async function buildNlContext(): Promise<NlQueryContext> {
  const snap = await buildSnapshot();
  return {
    tables: [
      "credit_loans", "credit_borrowers", "credit_watchlist", "credit_early_warnings",
      "market_positions", "market_var_runs",
      "liq_hqla", "liq_cashflows", "liq_funding_sources",
      "op_incidents", "op_kris", "op_risk_register",
      "compliance_rules", "compliance_checks", "compliance_tasks",
      "rwa_assets", "stress_runs",
    ],
    snapshot: snap,
  };
}

export async function fetchSample(table: string, limit = 20) {
  const { data, error } = await supabase.from(table as never).select("*").limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Prompt library
export const PROMPTS = {
  executive: `You are the Chief Risk Officer preparing a one-page executive summary for the board. Write in plain professional English, 200-300 words, structured as: Headline (1 sentence), Capital & RWA, Liquidity (LCR/NSFR), Credit portfolio, Market & Operational, Compliance status, Top 3 priorities. Use concrete numbers from the snapshot. No markdown headers.`,
  riskSummary: `You are a senior risk officer. Produce an integrated enterprise risk summary (max 250 words) covering credit, market, operational, and liquidity dimensions. Identify the most exposed dimension, key concentrations, and emerging trends. Plain paragraphs.`,
  compliance: `You are a Basel III/IV compliance advisor. Given the current compliance status (failing/warning rules, open tasks), explain the top regulatory gaps, cite the relevant framework (Basel III LCR/NSFR/CAR), and recommend remediation actions with priority order. Max 250 words.`,
  liquidity: `You are a treasury and liquidity risk advisor. Assess LCR, NSFR, HQLA composition, and funding concentration. Flag regulatory breaches (LCR<100%, NSFR<100%), suggest buffer actions, HQLA rebalancing, and funding diversification. Max 250 words.`,
  capital: `You are a capital management advisor. Analyze RWA composition, exposure vs. capital consumption, and highlight capital-intensive segments. Recommend RWA optimization (collateral, netting, model changes) and capital planning actions. Max 250 words.`,
  fraud: `You are a fraud analytics specialist. Given the list of fraud incidents, identify patterns (recurring root causes, high-loss events, control gaps), score residual fraud risk (low/medium/high), and recommend detective and preventive controls. Max 250 words.`,
  prediction: `You are a forward-looking risk analyst. Based on the current risk snapshot, project the 3-month direction of key indicators (NPL, LCR, VaR, incident loss). For each indicator give: trend (improving/stable/worsening), probability, and drivers. Max 250 words. Be explicit that these are indicative projections, not guarantees.`,
  recommendations: `You are a risk transformation advisor. Produce a prioritized action list (5-8 items) across capital, liquidity, credit, market, operational and compliance. For each item: title, one-line rationale, owner function, expected impact (low/med/high). Numbered list only.`,
  nlQuery: `You are a risk data analyst. Answer the user's question using ONLY the provided snapshot and any sampled rows. If the data is insufficient, say so and suggest which table/query would be needed. Keep answers concise, cite numbers precisely.`,
} as const;
