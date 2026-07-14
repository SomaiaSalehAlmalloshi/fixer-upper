/**
 * Performance / load tests for pure calculators. These are latency
 * budgets, not micro-benchmarks — they guard against O(n²) regressions
 * in the hot loops used by dashboards.
 */
import { describe, it, expect } from "vitest";
import { computeLCR, computeLiquidityGap } from "@/lib/liquidity";
import { runStress } from "@/lib/stress";
import { hqla, flow, stressParams } from "../helpers/factories";

const N = 10_000;

describe("perf — calculators handle 10k rows under budget", () => {
  const bigAssets = Array.from({ length: N }, (_, i) =>
    hqla({ tier: i % 3 === 0 ? "level1" : "level2a", eligible_value: 1000, market_value: 1000 }),
  );
  const bigFlows = Array.from({ length: N }, (_, i) =>
    flow({
      bucket: (["overnight", "1w", "1m", "3m", "1y"] as const)[i % 5],
      direction: i % 2 ? "inflow" : "outflow",
      amount: 100,
      stress_factor: 0.1,
    }),
  );

  it("computeLCR < 100ms for 10k assets + 10k flows", () => {
    const t = performance.now();
    computeLCR(bigAssets, bigFlows);
    expect(performance.now() - t).toBeLessThan(100);
  });

  it("computeLiquidityGap < 50ms for 10k flows", () => {
    const t = performance.now();
    computeLiquidityGap(bigFlows);
    expect(performance.now() - t).toBeLessThan(50);
  });

  it("runStress < 200ms for 10k HQLA + 10k flows", () => {
    const t = performance.now();
    runStress(stressParams(), [], [], bigAssets, bigFlows);
    expect(performance.now() - t).toBeLessThan(200);
  });
});
