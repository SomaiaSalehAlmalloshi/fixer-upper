import { createFileRoute } from "@tanstack/react-router";
import { AiPanel } from "@/components/ai/AiPanel";
import { PROMPTS, buildSnapshot } from "@/lib/ai";

export const Route = createFileRoute("/_authenticated/ai/recommendations")({
  component: () => (
    <AiPanel
      title="AI Recommendations"
      description="Prioritised, cross-domain action list generated from the current risk posture."
      purpose="recommendations"
      system={PROMPTS.recommendations}
      buildUserPrompt={async () => `Enterprise snapshot:\n${JSON.stringify(await buildSnapshot(), null, 2)}`}
    />
  ),
});
