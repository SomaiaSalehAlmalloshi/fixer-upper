import { describe, it, expect } from "vitest";
import { runStress, severityColor } from "@/lib/stress";
import { hqla, flow, stressParams } from "../helpers/factories";

describe("stress — runStress engine", () => {
  it("returns a well-formed result with zero portfolio", () => {
    const r = runStress(stressParams(), [], [], [], []);
    expect(r.totals.total_loss).toBe(0);
    expect(r.totals.capital_impact_pct).toBe(0);
    expect(r.liquidity.stressed_lcr).toBe(0);
  });

  it("increases HQLA haircut reduces stressed HQLA vs baseline", () => {
    const r = runStress(
      stressParams({ hqla_haircut: 0.3, deposit_runoff: 0.5 }),
      [],
      [],
      [hqla({ market_value: 1000, haircut: 0, eligible_value: 1000 })],
      [flow({ direction: "outflow", amount: 500, stress_factor: 0.1, bucket: "1m" })],
    );
    expect(r.liquidity.stressed_hqla).toBeLessThan(r.liquidity.baseline_hqla);
    expect(r.liquidity.stressed_net_outflow).toBeGreaterThanOrEqual(r.liquidity.baseline_net_outflow);
  });

  it("severityColor escalates with impact", () => {
    const base = { market: {}, credit: {}, liquidity: {}, totals: { total_loss: 0, capital_impact_pct: 0 } } as never;
    expect(severityColor({ ...base, totals: { total_loss: 0, capital_impact_pct: -0.15 } })).toMatch(/destructive/);
    expect(severityColor({ ...base, totals: { total_loss: 0, capital_impact_pct: -0.01 } })).toMatch(/emerald/);
  });
});
