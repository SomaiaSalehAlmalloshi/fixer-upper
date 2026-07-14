import { createFileRoute } from "@tanstack/react-router";
import { AiPanel } from "@/components/ai/AiPanel";
import { PROMPTS, buildSnapshot } from "@/lib/ai";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ai/prediction")({
  component: () => (
    <AiPanel
      title="AI Risk Prediction"
      description="Forward-looking directional projections for key risk indicators."
      purpose="risk_prediction"
      system={PROMPTS.prediction}
      buildUserPrompt={async () => {
        const snap = await buildSnapshot();
        const { data: stressRuns } = await supabase
          .from("stress_runs")
          .select("scenario_name, severity, results, run_at")
          .order("run_at", { ascending: false })
          .limit(5);
        const { data: varRuns } = await supabase
          .from("market_var_runs")
          .select("method, confidence, horizon_days, var_value, run_at")
          .order("run_at", { ascending: false })
          .limit(5);
        return `Current snapshot:\n${JSON.stringify(snap)}\n\nRecent stress runs:\n${JSON.stringify(stressRuns ?? [])}\n\nRecent VaR runs:\n${JSON.stringify(varRuns ?? [])}`;
      }}
    />
  ),
});
