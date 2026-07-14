import { createFileRoute } from "@tanstack/react-router";
import { AiPanel } from "@/components/ai/AiPanel";
import { PROMPTS, buildSnapshot } from "@/lib/ai";

export const Route = createFileRoute("/_authenticated/ai/risk")({
  component: () => (
    <AiPanel
      title="AI Risk Summary"
      description="Integrated view of credit, market, operational and liquidity exposures."
      purpose="risk_summary"
      system={PROMPTS.riskSummary}
      buildUserPrompt={async () => `Snapshot:\n${JSON.stringify(await buildSnapshot(), null, 2)}`}
    />
  ),
});
