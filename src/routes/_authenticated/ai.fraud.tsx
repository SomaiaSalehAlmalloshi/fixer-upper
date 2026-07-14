import { createFileRoute } from "@tanstack/react-router";
import { AiPanel } from "@/components/ai/AiPanel";
import { PROMPTS, loadFraudIncidents } from "@/lib/ai";

export const Route = createFileRoute("/_authenticated/ai/fraud")({
  component: () => (
    <AiPanel
      title="AI Fraud Detection"
      description="Pattern analysis over recorded fraud incidents with recommended controls."
      purpose="fraud_detection"
      system={PROMPTS.fraud}
      buildUserPrompt={async () => {
        const incidents = await loadFraudIncidents();
        const slim = incidents.map((i) => ({
          title: i.title,
          severity: i.severity,
          status: i.status,
          event_type: i.event_type,
          business_line: i.business_line,
          gross_loss: i.gross_loss,
          net_loss: i.net_loss,
          discovered_at: i.discovered_at,
          root_cause: i.root_cause,
        }));
        return `Fraud incidents (${slim.length}):\n${JSON.stringify(slim, null, 2)}`;
      }}
    />
  ),
});
