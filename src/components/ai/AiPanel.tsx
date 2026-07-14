import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { askAi } from "@/lib/ai.functions";

type Props = {
  title: string;
  description: string;
  system: string;
  buildUserPrompt: () => Promise<string> | string;
  purpose: string;
  extra?: ReactNode;
};

export function AiPanel({ title, description, system, buildUserPrompt, purpose, extra }: Props) {
  const [answer, setAnswer] = useState<string>("");

  const run = useMutation({
    mutationFn: async () => {
      const user = await buildUserPrompt();
      const res = await askAi({ data: { purpose, system, user } });
      return res.answer;
    },
    onSuccess: (a) => setAnswer(a),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {answer ? "Regenerate" : "Generate"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {extra}
        {answer ? (
          <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm leading-relaxed">
            {answer}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Click Generate to run the AI advisor using live risk data.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
