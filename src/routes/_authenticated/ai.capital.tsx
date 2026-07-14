import { createFileRoute } from "@tanstack/react-router";
import { AiPanel } from "@/components/ai/AiPanel";
import { PROMPTS, buildSnapshot } from "@/lib/ai";
import { loadAssets } from "@/lib/rwa";

export const Route = createFileRoute("/_authenticated/ai/capital")({
  component: () => (
    <AiPanel
      title="AI Capital Advisor"
      description="RWA optimisation and capital planning guidance."
      purpose="capital_advisor"
      system={PROMPTS.capital}
      buildUserPrompt={async () => {
        const [snap, assets] = await Promise.all([buildSnapshot(), loadAssets()]);
        const byCategory: Record<string, { exposure: number; rwa: number; count: number }> = {};
        for (const a of assets.filter((x) => x.status === "approved")) {
          const c = a.category;
          const rwa = Number(a.exposure_amount ?? 0) * Number(a.risk_weight ?? 0);
          const row = byCategory[c] ?? { exposure: 0, rwa: 0, count: 0 };
          row.exposure += Number(a.exposure_amount ?? 0);
          row.rwa += rwa;
          row.count += 1;
          byCategory[c] = row;
        }
        return `Snapshot capital:\n${JSON.stringify(snap.capital)}\n\nRWA by category:\n${JSON.stringify(byCategory)}`;
      }}
    />
  ),
});
