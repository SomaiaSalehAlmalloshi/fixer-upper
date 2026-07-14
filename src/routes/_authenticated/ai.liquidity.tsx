import { createFileRoute } from "@tanstack/react-router";
import { AiPanel } from "@/components/ai/AiPanel";
import { PROMPTS, buildSnapshot } from "@/lib/ai";
import { computeLCR, computeNSFR, listCashFlows, listFundingSources, listHqla } from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/ai/liquidity")({
  component: () => (
    <AiPanel
      title="AI Liquidity Advisor"
      description="LCR, NSFR, HQLA and funding diversification analysis."
      purpose="liquidity_advisor"
      system={PROMPTS.liquidity}
      buildUserPrompt={async () => {
        const [snap, hqla, flows, funding] = await Promise.all([buildSnapshot(), listHqla(), listCashFlows(), listFundingSources()]);
        const lcr = computeLCR(hqla, flows);
        const nsfr = computeNSFR(funding);
        return `Snapshot liquidity:\n${JSON.stringify(snap.liquidity)}\n\nLCR detail:\n${JSON.stringify(lcr)}\n\nNSFR detail:\n${JSON.stringify(nsfr)}\n\nFunding by type:\n${JSON.stringify(funding.map((f) => ({ type: f.source_type, amount: f.amount, tenor_days: f.tenor_days, stable: f.stable })))}`;
      }}
    />
  ),
});
