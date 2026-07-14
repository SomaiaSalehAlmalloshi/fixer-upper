import { test, expect } from "@playwright/test";

/**
 * Smoke E2E — verifies the shell renders and routing is alive.
 * Deeper UAT scenarios live alongside this file (see uat/ folder).
 */
test.describe("smoke", () => {
  test("home page loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    const res = await page.goto("/");
    expect(res?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/.+/);
    expect(errors, `console errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("auth route is reachable", async ({ page }) => {
    const res = await page.goto("/auth");
    expect(res?.status()).toBeLessThan(500);
  });
});
