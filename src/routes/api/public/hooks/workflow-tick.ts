import { createFileRoute } from "@tanstack/react-router";

/**
 * Workflow tick endpoint — invoked by pg_cron every hour.
 * Scans compliance_tasks and other module tables for due-date reminders
 * and overdue escalations, then inserts notifications and workflow events.
 */
export const Route = createFileRoute("/api/public/hooks/workflow-tick")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date();
        const inserted: string[] = [];

        const { data: rules } = await supabaseAdmin.from("workflow_rules").select("*").eq("active", true);

        // Compliance tasks with due dates
        const { data: tasks } = await supabaseAdmin
          .from("compliance_tasks")
          .select("id,title,assignee,due_date,priority,status")
          .not("due_date", "is", null)
          .not("assignee", "is", null)
          .not("status", "in", '("closed","approved","rejected")');

        // Track deduplication
        const already = new Set<string>();
        const { data: recent } = await supabaseAdmin
          .from("notifications")
          .select("source_id, metadata")
          .eq("source_module", "compliance")
          .gte("created_at", new Date(now.getTime() - 24 * 3600e3).toISOString());
        for (const r of recent ?? []) {
          const kind = (r.metadata as { kind?: string } | null)?.kind;
          if (kind && r.source_id) already.add(`${r.source_id}:${kind}`);
        }

        for (const t of tasks ?? []) {
          if (!t.due_date || !t.assignee) continue;
          const due = new Date(t.due_date);
          const daysUntil = Math.floor((due.getTime() - now.getTime()) / 86400e3);

          for (const rule of rules ?? []) {
            if (rule.source_module !== "compliance") continue;

            if (rule.trigger === "reminder_before_due" && daysUntil === rule.offset_days) {
              const dedupe = `${t.id}:reminder-${rule.offset_days}d`;
              if (already.has(dedupe)) continue;
              const ins = await supabaseAdmin.from("notifications").insert({
                user_id: t.assignee,
                channel: rule.channel,
                subject: `Reminder: "${t.title}" due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
                body: `The compliance task "${t.title}" is due on ${due.toLocaleDateString()}.`,
                priority: "normal",
                source_module: "compliance",
                source_id: t.id,
                action_url: `/compliance/tasks/${t.id}`,
                metadata: { kind: `reminder-${rule.offset_days}d`, rule_id: rule.id },
                status: "sent",
                sent_at: now.toISOString(),
              }).select("id").single();
              if (ins.data) inserted.push(ins.data.id);
              await supabaseAdmin.from("workflow_events").insert({
                source_module: "compliance", source_id: t.id, event_type: "reminder_dispatched",
                target_user: t.assignee, message: `Reminder ${rule.offset_days}d before due`,
                metadata: { rule_id: rule.id },
              });
            }

            if (rule.trigger === "escalate_overdue" && daysUntil <= -rule.offset_days) {
              const dedupe = `${t.id}:escalate-${rule.offset_days}d`;
              if (already.has(dedupe)) continue;
              // Notify all users with the target role
              let recipientIds: string[] = [];
              if (rule.target_role) {
                const { data: rolesRows } = await supabaseAdmin
                  .from("user_roles").select("user_id").eq("role", rule.target_role as never);
                recipientIds = (rolesRows ?? []).map((r) => r.user_id);
              } else {
                recipientIds = [t.assignee];
              }
              for (const uid of recipientIds) {
                const ins = await supabaseAdmin.from("notifications").insert({
                  user_id: uid,
                  channel: rule.channel,
                  subject: `ESCALATION: "${t.title}" overdue by ${-daysUntil} day(s)`,
                  body: `Compliance task "${t.title}" was due on ${due.toLocaleDateString()} and is unresolved.`,
                  priority: "urgent",
                  source_module: "compliance",
                  source_id: t.id,
                  action_url: `/compliance/tasks/${t.id}`,
                  metadata: { kind: `escalate-${rule.offset_days}d`, rule_id: rule.id },
                  status: "sent",
                  sent_at: now.toISOString(),
                }).select("id").single();
                if (ins.data) inserted.push(ins.data.id);
              }
              await supabaseAdmin.from("workflow_events").insert({
                source_module: "compliance", source_id: t.id, event_type: "escalation_dispatched",
                message: `Escalated to ${rule.target_role ?? "assignee"} (${-daysUntil}d overdue)`,
                metadata: { rule_id: rule.id, recipients: recipientIds.length },
              });
            }
          }
        }

        return Response.json({ ok: true, processed: (tasks ?? []).length, notifications: inserted.length });
      },
    },
  },
});
