import { describe, it, expect } from "vitest";
import {
  computeHqla,
  computeLCR,
  computeNSFR,
  computeNetOutflow30d,
  computeLiquidityGap,
  applyStress,
  ratioColor,
  fmtPct,
} from "@/lib/liquidity";
import { hqla, flow, funding } from "../helpers/factories";

describe("liquidity — pure calculators", () => {
  describe("computeHqla", () => {
    it("excludes encumbered assets", () => {
      const r = computeHqla([
        hqla({ tier: "level1", eligible_value: 100 }),
        hqla({ tier: "level1", eligible_value: 50, encumbered: true }),
      ]);
      expect(r.level1).toBe(100);
      expect(r.total).toBe(100);
    });

    it("caps Level 2B at 15% of total HQLA", () => {
      const r = computeHqla([
        hqla({ tier: "level1", eligible_value: 850 }),
        hqla({ tier: "level2b", eligible_value: 500 }),
      ]);
      // 15% cap of (850+X) yields 150 max
      expect(r.l2b_capped).toBeCloseTo(150, 5);
    });

    it("caps Level 2 total at 40% of HQLA", () => {
      const r = computeHqla([
        hqla({ tier: "level1", eligible_value: 600 }),
        hqla({ tier: "level2a", eligible_value: 1000 }),
      ]);
      expect(r.l2_total_capped).toBeCloseTo(400, 5);
    });
  });

  describe("computeNetOutflow30d", () => {
    it("caps inflows at 75% of outflows (Basel III)", () => {
      const r = computeNetOutflow30d([
        flow({ direction: "outflow", amount: 1000, stress_factor: 1, bucket: "1m" }),
        flow({ direction: "inflow", amount: 5000, stress_factor: 1, bucket: "1m" }),
      ]);
      expect(r.capped_inflow).toBe(750);
      expect(r.net).toBe(250);
    });

    it("ignores flows beyond the 30d horizon", () => {
      const r = computeNetOutflow30d([
        flow({ direction: "outflow", amount: 1000, stress_factor: 1, bucket: "1y" }),
      ]);
      expect(r.outflow).toBe(0);
    });

    it("never returns negative net outflow", () => {
      const r = computeNetOutflow30d([
        flow({ direction: "inflow", amount: 10_000, stress_factor: 1, bucket: "1m" }),
      ]);
      expect(r.net).toBeGreaterThanOrEqual(0);
    });
  });

  describe("computeLCR", () => {
    it("is Infinity when there are no net outflows", () => {
      const r = computeLCR([hqla({ eligible_value: 100 })], []);
      expect(r.lcr).toBe(Infinity);
    });

    it("matches HQLA / net-outflow", () => {
      const r = computeLCR(
        [hqla({ tier: "level1", eligible_value: 1000 })],
        [flow({ direction: "outflow", amount: 500, stress_factor: 1, bucket: "1m" })],
      );
      expect(r.lcr).toBeCloseTo(2, 5);
    });
  });

  describe("computeNSFR", () => {
    it("computes ASF/RSF ratio", () => {
      const r = computeNSFR([
        funding({ amount: 1000, asf_factor: 0.9, rsf_factor: 0.5 }),
      ]);
      expect(r.nsfr).toBeCloseTo(1.8, 5);
    });
  });

  describe("computeLiquidityGap", () => {
    it("accumulates gap across buckets", () => {
      const r = computeLiquidityGap([
        flow({ bucket: "overnight", direction: "inflow", amount: 100 }),
        flow({ bucket: "1w", direction: "outflow", amount: 50 }),
      ]);
      expect(r[0].cumulative).toBe(100);
      expect(r[1].cumulative).toBe(50);
    });
  });

  describe("applyStress", () => {
    it("worsens LCR under stress", () => {
      const assets = [hqla({ tier: "level1", eligible_value: 1000, market_value: 1000, haircut: 0 })];
      const flows = [flow({ direction: "outflow", amount: 500, stress_factor: 0.1, bucket: "1m", category: "retail_deposits" })];
      const base = computeLCR(assets, flows);
      const stressed = applyStress(assets, flows, {
        retail_runoff: 1,
        wholesale_runoff: 1,
        extra_haircut: 0.2,
        inflow_haircut: 0.5,
      });
      expect(stressed.lcr).toBeLessThan(base.lcr);
    });
  });

  it("ratioColor and fmtPct behave as expected", () => {
    expect(ratioColor(1.2)).toMatch(/emerald/);
    expect(ratioColor(1.05)).toMatch(/amber/);
    expect(ratioColor(0.9)).toMatch(/destructive/);
    expect(fmtPct(0.1234, 2)).toBe("12.34%");
  });
});
