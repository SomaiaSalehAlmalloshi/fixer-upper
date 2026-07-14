/**
 * Security tests — invariants that must hold regardless of backend
 * changes. Static checks against the codebase itself (no network),
 * plus input-validation smoke tests on pure helpers.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { computeLCR, computeNetOutflow30d } from "@/lib/liquidity";
import { expectedLoss } from "@/lib/credit";

function migrations(): string[] {
  const dir = "supabase/migrations";
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"));
  } catch {
    return [];
  }
}

describe("security — schema invariants", () => {
  const sqls = migrations();

  it("every CREATE TABLE public.* has a matching ENABLE ROW LEVEL SECURITY", () => {
    for (const sql of sqls) {
      const tables = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)].map((m) => m[1]);
      for (const t of tables) {
        const enabled = new RegExp(`alter\\s+table\\s+public\\.${t}\\s+enable\\s+row\\s+level\\s+security`, "i").test(sql);
        expect(enabled, `Table public.${t} missing RLS`).toBe(true);
      }
    }
  });

  it("no service-role key or hard-coded JWT is committed", () => {
    for (const sql of sqls) {
      expect(sql).not.toMatch(/service_role_key\s*=\s*['"][A-Za-z0-9._-]+['"]/i);
      expect(sql).not.toMatch(/eyJhbGciOi[A-Za-z0-9._-]{40,}/);
    }
  });
});

describe("security — input validation on calculators", () => {
  it("computeLCR tolerates malformed inputs without throwing", () => {
    expect(() => computeLCR([], [])).not.toThrow();
    expect(() => computeLCR([], [{ /* @ts-expect-error */ } as never])).not.toThrow();
  });

  it("computeNetOutflow30d never returns negative net", () => {
    const r = computeNetOutflow30d([]);
    expect(r.net).toBeGreaterThanOrEqual(0);
  });

  it("expectedLoss is monotonic in PD", () => {
    expect(expectedLoss(0.1, 0.5, 1000)).toBeGreaterThan(expectedLoss(0.05, 0.5, 1000));
  });
});
