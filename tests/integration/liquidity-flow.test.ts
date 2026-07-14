/**
 * Integration test — walks the liquidity calculators together the way
 * the UI does: HQLA → NetOutflow → LCR → Stress. No I/O, no mocks:
 * we compose real functions end-to-end.
 */
import { describe, it, expect } from "vitest";
import { computeLCR, applyStress, computeNSFR } from "@/lib/liquidity";
import { hqla, flow, funding } from "../helpers/factories";

describe("integration — liquidity dashboard chain", () => {
  const assets = [
    hqla({ tier: "level1", market_value: 5_000_000, haircut: 0, eligible_value: 5_000_000 }),
    hqla({ tier: "level2a", market_value: 2_000_000, haircut: 0.15, eligible_value: 1_700_000 }),
  ];
  const flows = [
    flow({ bucket: "1m", direction: "outflow", category: "retail_deposits", amount: 3_000_000, stress_factor: 0.05 }),
    flow({ bucket: "1m", direction: "outflow", category: "wholesale", amount: 1_000_000, stress_factor: 0.25 }),
    flow({ bucket: "1m", direction: "inflow", category: "loans", amount: 500_000, stress_factor: 0.5 }),
  ];

  it("baseline LCR > regulatory 100% threshold", () => {
    const r = computeLCR(assets, flows);
    expect(r.lcr).toBeGreaterThan(1);
  });

  it("stressed LCR degrades but stays finite", () => {
    const s = applyStress(assets, flows, {
      retail_runoff: 0.15,
      wholesale_runoff: 0.5,
      extra_haircut: 0.05,
      inflow_haircut: 0.5,
    });
    expect(Number.isFinite(s.lcr)).toBe(true);
    expect(s.lcr).toBeLessThan(computeLCR(assets, flows).lcr);
  });

  it("NSFR mixes multiple funding classes", () => {
    const r = computeNSFR([
      funding({ source_type: "retail_deposits", amount: 4_000_000, asf_factor: 0.9, rsf_factor: 0.5 }),
      funding({ source_type: "wholesale_deposits", amount: 2_000_000, asf_factor: 0.5, rsf_factor: 0.65 }),
    ]);
    expect(r.asf).toBeGreaterThan(0);
    expect(r.rsf).toBeGreaterThan(0);
    expect(r.nsfr).toBeGreaterThan(0);
  });
});
