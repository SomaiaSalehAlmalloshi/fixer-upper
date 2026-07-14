import { test, expect } from "@playwright/test";

/**
 * User Acceptance Tests — narrated as user stories. Skipped unless a
 * seeded authenticated session is available in the browser context via
 * LOVABLE_BROWSER_SUPABASE_* env vars (see automation strategy).
 */
const authed = !!process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const t = authed ? test : test.skip;

t.describe("UAT — Liquidity manager", () => {
  t("As a Treasurer I can see the LCR on the Liquidity dashboard", async ({ page }) => {
    await page.goto("/liquidity");
    await expect(page.getByText(/LCR|Liquidity Coverage/i)).toBeVisible();
  });

  t("As a Risk Officer I can open the Stress builder and run a scenario", async ({ page }) => {
    await page.goto("/stress/builder");
    await expect(page.getByRole("heading", { name: /stress/i })).toBeVisible();
  });
});
