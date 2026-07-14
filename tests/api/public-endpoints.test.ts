/**
 * API contract tests — target the public HTTP endpoints exposed under
 * /api/public/*. Runs against a locally running dev server when
 * BASE_URL is set; otherwise the suite is skipped so `bun test` stays
 * green in CI without a live backend.
 */
import { describe, it, expect } from "vitest";

const BASE_URL = process.env.BASE_URL;
const hasBase = !!BASE_URL && /^https?:\/\//.test(BASE_URL);
const d = hasBase ? describe : describe.skip;

d("api — /api/public/hooks/workflow-tick", () => {
  it("rejects unauthenticated calls or returns a JSON body", async () => {
    const res = await fetch(`${BASE_URL}/api/public/hooks/workflow-tick`, { method: "POST" });
    expect([200, 401, 403]).toContain(res.status);
    const ct = res.headers.get("content-type") ?? "";
    if (res.status === 200) {
      expect(ct).toContain("application/json");
    }
  });

  it("responds within 3 seconds (perf smoke)", async () => {
    const t = performance.now();
    await fetch(`${BASE_URL}/api/public/hooks/workflow-tick`, { method: "POST" });
    expect(performance.now() - t).toBeLessThan(3000);
  });
});
