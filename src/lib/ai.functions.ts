import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AskInput = z.object({
  purpose: z.string().min(1).max(80),
  system: z.string().min(1).max(4000),
  user: z.string().min(1).max(20000),
  model: z.string().optional(),
});

async function callGateway(system: string, user: string, model = "google/gemini-2.5-flash") {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit — try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings.");
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export const askAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => AskInput.parse(v))
  .handler(async ({ data }) => {
    const answer = await callGateway(data.system, data.user, data.model);
    return { answer, purpose: data.purpose };
  });
