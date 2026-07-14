# Testing Strategy

This document is the single source of truth for how we test the platform.
It extends the existing architecture — it does not modify any domain
module. All new files live under `tests/` and `docs/`.

## 1. Goals

- Guarantee regulatory calculators (LCR, NSFR, Expected Loss, Stress) stay
  mathematically correct across refactors.
- Detect regressions in critical user flows (auth, dashboards, stress runs,
  report exports) before publish.
- Enforce security invariants (RLS on every public table, no leaked
  service-role secrets) directly from the codebase.
- Keep the test suite fast enough to run on every commit
  (`bun run test` < 10s for unit + integration).

## 2. Test Pyramid

```text
                   ┌───────────────┐
                   │   UAT / E2E   │   Playwright  (few, slow, high value)
                   ├───────────────┤
                   │  Integration  │   Vitest      (compose real modules)
                   ├───────────────┤
                   │      API      │   Vitest+fetch(contract, perf smoke)
                   ├───────────────┤
                   │  Unit / Pure  │   Vitest      (many, fast, deterministic)
                   └───────────────┘
```

## 3. Categories

| Category    | Runner            | Location                    | Purpose                                                    |
|-------------|-------------------|-----------------------------|------------------------------------------------------------|
| Unit        | Vitest + jsdom    | `tests/unit/`               | Pure functions (`src/lib/*.ts`), components in isolation.  |
| Integration | Vitest            | `tests/integration/`        | Compose multiple `src/lib` modules exactly as the UI does. |
| API         | Vitest + `fetch`  | `tests/api/`                | Contract + perf smoke for `/api/public/*` routes.          |
| Performance | Vitest            | `tests/performance/`        | Latency budgets on calculators & aggregations.             |
| Security    | Vitest (static)   | `tests/security/`           | RLS invariants, secret scanning, input validation.         |
| UAT / E2E   | Playwright        | `tests/e2e/`, `e2e/uat/`    | User-story-driven browser flows.                           |

## 4. Sample Test Cases

Real, runnable examples ship with this change:

- `tests/unit/liquidity.test.ts` — Basel III 75% inflow cap, L2/L2B caps,
  gap accumulation, stress monotonicity.
- `tests/unit/stress.test.ts` — Portfolio-wide stress preserves invariants
  (stressed HQLA ≤ baseline, severity thresholds).
- `tests/unit/credit.test.ts` — `expectedLoss = PD × LGD × EAD`, formatters.
- `tests/integration/liquidity-flow.test.ts` — Dashboard chain
  HQLA → Outflows → LCR → Stress, wired end-to-end without mocks.
- `tests/api/public-endpoints.test.ts` — `/api/public/hooks/workflow-tick`
  status + latency (skipped when `BASE_URL` is unset).
- `tests/performance/calculators.perf.test.ts` — 10k-row latency budgets:
  LCR < 100 ms, gap < 50 ms, stress < 200 ms.
- `tests/security/rls-and-input.test.ts` — Every `CREATE TABLE public.*` in
  `supabase/migrations/` has `ENABLE ROW LEVEL SECURITY`; no committed
  JWTs; calculators reject malformed input safely.
- `tests/e2e/smoke.spec.ts` — Shell loads, no console errors, `/auth` reachable.
- `tests/e2e/uat/liquidity-uat.spec.ts` — Treasurer sees LCR; Risk Officer
  opens the stress builder (runs only with a seeded session).

## 5. Automation Strategy

1. **Local loop** — `bun run test:watch` while editing calculators or
   components; `bun run test` before every commit.
2. **Pre-publish gate** — `bun run test:all` runs Vitest + Playwright.
   Publish is blocked if either fails.
3. **CI wiring** (recommended pipeline)
   - `bun install --frozen-lockfile`
   - `bun run lint`
   - `bun run test:coverage` (uploads `coverage/lcov.info`)
   - `bun run build`
   - `bun run test:e2e` against the built preview server; the reusable
     `LOVABLE_BROWSER_SUPABASE_*` session variables enable UAT specs.
4. **Regulatory calculators** get a coverage floor of **90%** in
   `vitest.config.ts` `coverage.thresholds` when CI is enabled; UI
   components target **60%**.
5. **Flakiness policy** — Playwright uses `retries: 2` on CI only;
   any flake reproducible locally is a blocker, not a retry candidate.
6. **Security scanning** — `code--dependency_scan` (bun audit) runs
   nightly; the static `tests/security/rls-and-input.test.ts` runs on
   every commit to keep RLS drift out of migrations.
7. **Performance regressions** — the perf suite runs in the standard
   Vitest job; budgets are absolute wall-clock, chosen with 3× headroom
   over current measurements so they only fire on real regressions.

## 6. Conventions

- Never import from `src/integrations/supabase/client` in unit tests —
  use `tests/helpers/factories.ts` to build DB-shaped rows.
- Never mutate production modules to make them "testable"; if a helper
  is hard to test, extract a pure function into `src/lib/` and export it.
- Prefer `describe` blocks that read like specifications
  ("caps Level 2B at 15% of total HQLA") over mechanical names.
- E2E specs assert user-visible outcomes (text, role), never DOM
  internals or CSS class names.
