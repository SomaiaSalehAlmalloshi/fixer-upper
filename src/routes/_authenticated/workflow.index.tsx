import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  MODULE_LABEL, listEvents, loadUnifiedTasks, listNotifications, unreadCount, listRules,
} from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/workflow/")({
  component: WorkflowDashboard,
});

function WorkflowDashboard() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { data: tasks = [] } = useQuery({ queryKey: ["wf", "tasks"], queryFn: loadUnifiedTasks, enabled: !!uid });
  const { data: notifs = [] } = useQuery({ queryKey: ["wf", "notifs", uid], queryFn: () => listNotifications(uid, 10), enabled: !!uid });
  const { data: unread = 0 } = useQuery({ queryKey: ["wf", "unread", uid], queryFn: () => unreadCount(uid), enabled: !!uid });
  const { data: events = [] } = useQuery({ queryKey: ["wf", "events"], queryFn: () => listEvents(undefined, 10), enabled: !!uid });
  const { data: rules = [] } = useQuery({ queryKey: ["wf", "rules"], queryFn: listRules, enabled: !!uid });

  const openTasks = tasks.filter((t) => !["closed", "approved", "rejected", "resolved"].includes(t.status));
  const now = Date.now();
  const overdue = openTasks.filter((t) => t.due_date && new Date(t.due_date).getTime() < now);
  const dueSoon = openTasks.filter((t) => t.due_date && new Date(t.due_date).getTime() >= now && new Date(t.due_date).getTime() < now + 7 * 86400e3);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Open Tasks" value={openTasks.length} sub={`${tasks.length} total`} />
        <Kpi label="Overdue" value={overdue.length} sub="Requires escalation" tone={overdue.length ? "danger" : "ok"} />
        <Kpi label="Due Within 7 Days" value={dueSoon.length} sub="Reminders scheduled" tone={dueSoon.length ? "warn" : "ok"} />
        <Kpi label="Unread Notifications" value={unread} sub={`${rules.filter((r) => r.active).length} active rules`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Open Tasks by Module</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {Object.entries(groupBy(openTasks, "source_module")).map(([m, ts]) => (
                <div key={m} className="flex items-center justify-between">
                  <span>{MODULE_LABEL[m as keyof typeof MODULE_LABEL] ?? m}</span>
                  <Badge variant="secondary">{ts.length}</Badge>
                </div>
              ))}
              {openTasks.length === 0 && <p className="text-muted-foreground">No open tasks.</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {notifs.slice(0, 6).map((n) => (
              <div key={n.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                <div>
                  <div className="font-medium">{n.subject}</div>
                  <div className="text-xs text-muted-foreground">{MODULE_LABEL[n.source_module]} · {new Date(n.created_at).toLocaleString()}</div>
                </div>
                <Badge variant="outline">{n.channel}</Badge>
              </div>
            ))}
            {notifs.length === 0 && <p className="text-muted-foreground">No notifications yet.</p>}
            <Link className="text-sm text-primary hover:underline" to="/workflow/notifications">View all →</Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Workflow Events</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between border-b pb-1 last:border-0">
              <div>
                <Badge variant="outline" className="mr-2">{MODULE_LABEL[e.source_module]}</Badge>
                <span className="font-medium">{e.event_type}</span>
                {e.message && <span className="text-muted-foreground"> — {e.message}</span>}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
            </div>
          ))}
          {events.length === 0 && <p className="text-muted-foreground">No events recorded.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: "ok" | "warn" | "danger" }) {
  const color = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "";
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function groupBy<T, K extends keyof T>(rows: T[], key: K) {
  const out: Record<string, T[]> = {};
  for (const r of rows) {
    const k = String(r[key]);
    (out[k] ??= []).push(r);
  }
  return out;
}
