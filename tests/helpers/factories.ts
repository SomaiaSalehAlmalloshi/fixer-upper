/**
 * Deterministic test factories that mirror the DB row shapes exposed by
 * src/integrations/supabase/types.ts. Kept in tests/ so they never ship
 * with production code and never mutate real modules.
 */
import type { Hqla, CashFlow, FundingSource } from "@/lib/liquidity";
import type { StressParams } from "@/lib/stress";

let seq = 0;
const id = () => `test-${++seq}`;

export function hqla(over: Partial<Hqla> = {}): Hqla {
  return {
    id: id(),
    tier: "level1",
    asset_name: "Sovereign Bond",
    market_value: 1_000_000,
    haircut: 0,
    eligible_value: 1_000_000,
    encumbered: false,
    currency: "USD",
    created_by: "u1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  } as unknown as Hqla;
}

export function flow(over: Partial<CashFlow> = {}): CashFlow {
  return {
    id: id(),
    bucket: "1m",
    direction: "outflow",
    category: "retail_deposits",
    amount: 100_000,
    stress_factor: 0.1,
    cashflow_date: new Date().toISOString(),
    currency: "USD",
    counterparty: null,
    notes: null,
    created_by: "u1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  } as unknown as CashFlow;
}

export function funding(over: Partial<FundingSource> = {}): FundingSource {
  return {
    id: id(),
    source_type: "retail_deposits",
    name: "Retail",
    amount: 1_000_000,
    asf_factor: 0.9,
    rsf_factor: 0.5,
    maturity_bucket: "gt1y",
    currency: "USD",
    counterparty: null,
    created_by: "u1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  } as unknown as FundingSource;
}

export const stressParams = (over: Partial<StressParams> = {}): StressParams => ({
  fx_shock: 0.1,
  ir_shock_bp: 200,
  equity_shock: -0.2,
  commodity_shock: -0.15,
  pd_multiplier: 2,
  lgd_uplift: 0.1,
  hqla_haircut: 0.1,
  deposit_runoff: 0.15,
  ...over,
});
