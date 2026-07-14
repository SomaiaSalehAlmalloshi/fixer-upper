import { createFileRoute } from "@tanstack/react-router";
import { AiPanel } from "@/components/ai/AiPanel";
import { PROMPTS, buildSnapshot } from "@/lib/ai";
import { latestChecks, listTasks, listRules } from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/ai/compliance")({
  component: () => (
    <AiPanel
      title="AI Compliance Advisor"
      description="Basel III / IV gap analysis, task prioritisation and remediation guidance."
      purpose="compliance_advisor"
      system={PROMPTS.compliance}
      buildUserPrompt={async () => {
        const [snap, checks, tasks, rules] = await Promise.all([buildSnapshot(), latestChecks(), listTasks(), listRules()]);
        return `Snapshot:\n${JSON.stringify(snap.compliance)}\n\nRules:\n${JSON.stringify(rules.map((r) => ({ code: r.code, name: r.name, framework: r.framework, metric: r.metric })))}\n\nLatest checks:\n${JSON.stringify(checks.map((c) => ({ rule_code: c.rule_code, status: c.status, metric_value: c.metric_value, run_at: c.run_at })))}\n\nOpen tasks:\n${JSON.stringify(tasks.filter((t) => t.status !== "closed").map((t) => ({ title: t.title, priority: t.priority, status: t.status, due_date: t.due_date })))}`;
      }}
    />
  ),
});
