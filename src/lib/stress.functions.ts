import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AnalyzeInput = z.object({
  run_id: z.string().uuid(),
  scenario_name: z.string(),
  stress_type: z.string(),
  severity: z.string(),
  parameters: z.record(z.string(), z.any()),
  results: z.record(z.string(), z.any()),
});

const SYSTEM = `You are a senior bank risk officer analyzing enterprise stress test results.
Produce a concise (max 250 words) written analysis with:
1. Overall risk assessment (1-2 sentences).
2. Key vulnerabilities: market, credit, liquidity — highlight the most damaged dimension.
3. Regulatory implications (LCR/NSFR/capital adequacy).
4. Two or three prioritized mitigation actions.
Use plain text with short paragraphs. No markdown headers.`;

export const analyzeStressRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => AnalyzeInput.parse(v))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const userMsg = `Scenario: ${data.scenario_name} (${data.stress_type}, ${data.severity})
Parameters: ${JSON.stringify(data.parameters)}
Results: ${JSON.stringify(data.results)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings.");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const analysis = json.choices?.[0]?.message?.content?.trim() ?? "";

    const { error } = await context.supabase
      .from("stress_runs")
      .update({ ai_analysis: analysis })
      .eq("id", data.run_id);
    if (error) throw error;
    return { analysis };
  });
