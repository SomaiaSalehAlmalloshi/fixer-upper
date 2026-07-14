import { describe, it, expect } from "vitest";
import { expectedLoss, fmtMoney, fmtPct } from "@/lib/credit";

describe("credit — pure helpers", () => {
  it("expectedLoss = PD × LGD × EAD", () => {
    expect(expectedLoss(0.05, 0.4, 1_000_000)).toBeCloseTo(20_000, 5);
    expect(expectedLoss(0, 0.5, 1000)).toBe(0);
  });

  it("fmtMoney formats to whole-currency units", () => {
    expect(fmtMoney(1234.56, "USD")).toMatch(/\$?1,235|1\.235/);
  });

  it("fmtPct multiplies by 100 with fixed digits", () => {
    expect(fmtPct(0.1234, 2)).toBe("12.34%");
    expect(fmtPct(null)).toBe("0.00%");
  });
});
