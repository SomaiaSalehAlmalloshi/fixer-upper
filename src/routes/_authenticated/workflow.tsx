import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/workflow")({
  component: WorkflowLayout,
});

type Nav = { to: string; label: string; exact?: boolean };
const SUB_NAV: Nav[] = [
  { to: "/workflow", label: "لوحة التحكم", exact: true },
  { to: "/workflow/tasks", label: "المهام" },
  { to: "/workflow/approvals", label: "الاعتمادات" },
  { to: "/workflow/notifications", label: "الإشعارات" },
  { to: "/workflow/preferences", label: "Preferences" },
  { to: "/workflow/rules", label: "Escalation Rules" },
  { to: "/workflow/audit", label: "سجل التدقيق" },
];

function WorkflowLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notifications & Workflow</h1>
        <p className="text-muted-foreground">
          Cross-module tasks, approvals, notifications and escalation rules. Extends compliance, operational and RWA workflows.
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b">
        {SUB_NAV.map((n) => {
          const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to as never}
              className={cn(
                "border-b-2 px-3 py-2 text-sm transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
