import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askAi } from "@/lib/ai.functions";
import { PROMPTS, buildNlContext } from "@/lib/ai";

export const Route = createFileRoute("/_authenticated/ai/query")({
  component: NlQuery,
});

const SUGGESTIONS = [
  "What is our current LCR and are we below the 100% regulatory floor?",
  "Which credit segment has the highest NPL exposure?",
  "Summarise open compliance tasks by priority.",
  "What are our top three operational risks by loss?",
];

function NlQuery() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");

  const ask = useMutation({
    mutationFn: async (question: string) => {
      if (!question.trim()) throw new Error("Enter a question first.");
      const ctx = await buildNlContext();
      const user = `Question: ${question}\n\nAvailable tables: ${ctx.tables.join(", ")}\n\nEnterprise snapshot:\n${JSON.stringify(ctx.snapshot, null, 2)}`;
      const res = await askAi({ data: { purpose: "nl_query", system: PROMPTS.nlQuery, user } });
      return res.answer;
    },
    onSuccess: setAnswer,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Natural Language Query
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ask a question in plain English about capital, credit, market, liquidity, operational, or compliance data.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Which loans are on the watchlist and why?"
          rows={3}
        />
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s} type="button" variant="outline" size="sm" onClick={() => setQ(s)}>
              {s}
            </Button>
          ))}
        </div>
        <div>
          <Button onClick={() => ask.mutate(q)} disabled={ask.isPending}>
            {ask.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Ask AI
          </Button>
        </div>
        {answer && (
          <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm leading-relaxed">
            {answer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
